import base64
import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Tuple
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from django.conf import settings

from .prompt_templates import IMAGE_ANALYSIS

logger = logging.getLogger(__name__)

SUPPORTED_MIME_TYPES = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}


def _detect_mime(data: bytes) -> str:
    if data[:3] == b'\xff\xd8\xff':
        return 'image/jpeg'
    if data[:4] == b'\x89PNG':
        return 'image/png'
    if data[:4] in (b'GIF8', b'GIF9'):
        return 'image/gif'
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return 'image/webp'
    return 'image/jpeg'


class ImageDetector:
    def __init__(self, min_image_size: int = 100_000, max_images: int = 10):
        """
        Args:
            min_image_size: Minimum image byte size — skips thumbnails/icons.
            max_images:     Maximum images to analyse per URL.
        """
        self.min_image_size = min_image_size
        self.max_images = max_images

    # ── HTML image extraction ────────────────────────────────────────────────

    def extract_image_urls(self, html_content: str, base_url: str) -> list[str]:
        """Return up to `max_images` absolute image URLs found in HTML."""
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            urls = []
            for img in soup.find_all('img'):
                src = img.get('src') or img.get('data-src') or img.get('data-lazy-src')
                if not src:
                    continue
                if not src.startswith('http'):
                    src = urljoin(base_url, src)
                if src not in urls:
                    urls.append(src)
                if len(urls) >= self.max_images * 2:
                    break
            logger.info(f"Extracted {len(urls)} image URLs from HTML")
            return urls[:self.max_images]
        except Exception as e:
            logger.warning(f"Image URL extraction failed: {e}")
            return []

    # ── Image download ────────────────────────────────────────────────────────

    def download_image(self, image_url: str) -> Tuple[bool, bytes, str]:
        """
        Download image bytes from URL.

        Returns:
            tuple: (success: bool, image_bytes: bytes, error_msg: str)
        """
        try:
            # Quick size check before full download
            try:
                head = requests.head(image_url, timeout=5, allow_redirects=True)
                content_length = int(head.headers.get('Content-Length', 0))
                if 0 < content_length < self.min_image_size:
                    return False, b'', f"Image too small ({content_length} bytes)"
            except Exception:
                pass  # HEAD not supported by all servers — proceed anyway

            response = requests.get(image_url, timeout=10)
            response.raise_for_status()

            if len(response.content) < self.min_image_size:
                return False, b'', f"Image too small ({len(response.content)} bytes)"

            logger.info(f"Downloaded {len(response.content)} bytes from {image_url[:80]}")
            return True, response.content, ""

        except Exception as e:
            logger.warning(f"Image download failed for {image_url[:80]}: {e}")
            return False, b'', str(e)

    # ── Single-image analysis ─────────────────────────────────────────────────

    def analyze_image(self, image_bytes: bytes, image_url: str) -> Tuple[bool, dict, str]:
        """
        Analyse image bytes with Gemini 1.5 Pro Vision.

        Returns:
            tuple: (success: bool, analysis_dict: dict, error_msg: str)

        analysis_dict keys:
            is_ai_generated     (bool)
            confidence          (float 0.0–1.0)
            deepfake_probability (float 0.0–1.0)
            indicators          (list[str])
        """
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel('gemini-2.5-flash')

            mime_type = _detect_mime(image_bytes)
            image_b64 = base64.b64encode(image_bytes).decode('utf-8')

            response = model.generate_content([
                IMAGE_ANALYSIS,
                {"mime_type": mime_type, "data": image_b64},
            ])

            content = response.text
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0].strip()
            elif '```' in content:
                content = content.split('```')[1].split('```')[0].strip()

            result = json.loads(content)
            result.setdefault('is_ai_generated', False)
            result.setdefault('confidence', 0.5)
            result.setdefault('deepfake_probability', 0.0)
            result.setdefault('indicators', [])

            logger.info(f"Image analysis: ai={result['is_ai_generated']} "
                        f"confidence={result['confidence']:.2f} url={image_url[:60]}")
            return True, result, ""

        except Exception as e:
            logger.error(f"Image analysis failed for {image_url[:60]}: {e}", exc_info=True)
            return False, {}, str(e)

    # ── Batch URL analysis ────────────────────────────────────────────────────

    def _analyse_single(self, image_url: str) -> dict:
        """Download and analyse one image; returns a result dict."""
        ok, image_bytes, err = self.download_image(image_url)
        if not ok:
            return {'image_url': image_url, 'status': 'skipped', 'skip_reason': err}

        ok, analysis, err = self.analyze_image(image_bytes, image_url)
        if not ok:
            return {'image_url': image_url, 'status': 'failed', 'skip_reason': err}

        return {'image_url': image_url, 'status': 'analyzed', **analysis}

    def detect_images_in_url(
        self, url: str, html_content: str
    ) -> Tuple[bool, list[dict], str]:
        """
        Extract images from HTML and analyse each one in parallel.

        Args:
            url:          The source page URL (used to resolve relative paths).
            html_content: Raw HTML of the page.

        Returns:
            tuple: (success: bool, analyses: list[dict], error_msg: str)
        """
        try:
            image_urls = self.extract_image_urls(html_content, url)
            if not image_urls:
                logger.info("No images found in page HTML")
                return True, [], ""

            logger.info(f"Analysing {len(image_urls)} images from {url[:80]}")
            analyses: list[dict] = []

            with ThreadPoolExecutor(max_workers=3) as executor:
                futures = {
                    executor.submit(self._analyse_single, img_url): img_url
                    for img_url in image_urls
                }
                for future in as_completed(futures):
                    try:
                        analyses.append(future.result())
                    except Exception as e:
                        img_url = futures[future]
                        logger.error(f"Future failed for {img_url[:60]}: {e}")
                        analyses.append({
                            'image_url': img_url,
                            'status': 'failed',
                            'skip_reason': str(e),
                        })

            analyzed = sum(1 for a in analyses if a['status'] == 'analyzed')
            logger.info(f"Image detection complete: {analyzed}/{len(analyses)} analyzed")
            return True, analyses, ""

        except Exception as e:
            logger.error(f"detect_images_in_url failed: {e}", exc_info=True)
            return False, [], str(e)
