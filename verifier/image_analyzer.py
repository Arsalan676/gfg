import json
import logging

import requests
import google.generativeai as genai
from django.conf import settings

from .agents.prompt_templates import IMAGE_ANALYSIS
from .models import ImageAnalysis, VerificationJob

logger = logging.getLogger(__name__)

SUPPORTED_MIME_TYPES = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}


def analyze_image_url(image_url: str, job: VerificationJob) -> ImageAnalysis:
    """
    Analyze a single image URL for AI generation / deepfake indicators
    using Gemini 1.5 Pro Vision.

    Saves the result to the database and returns the ImageAnalysis instance.
    """
    try:
        response = requests.get(image_url, timeout=10)
        response.raise_for_status()

        content_type = response.headers.get('Content-Type', 'image/jpeg').split(';')[0].strip()
        if content_type not in SUPPORTED_MIME_TYPES:
            logger.warning(f"Skipping image with unsupported type '{content_type}': {image_url}")
            return ImageAnalysis.objects.create(
                job=job,
                image_url=image_url,
                status='skipped',
                skip_reason=f"Unsupported content type: {content_type}",
            )

        image_data = response.content

        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-1.5-pro')

        gemini_response = model.generate_content([
            IMAGE_ANALYSIS,
            {"mime_type": content_type, "data": image_data},
        ])

        content = gemini_response.text
        if '```json' in content:
            content = content.split('```json')[1].split('```')[0].strip()
        elif '```' in content:
            content = content.split('```')[1].split('```')[0].strip()

        result = json.loads(content)

        analysis = ImageAnalysis.objects.create(
            job=job,
            image_url=image_url,
            status='analyzed',
            is_ai_generated=bool(result.get('is_ai_generated', False)),
            confidence=float(result.get('confidence', 0.5)),
            deepfake_probability=float(result.get('deepfake_probability', 0.0)),
            indicators=result.get('indicators', []),
        )
        logger.info(f"Image analyzed: ai_generated={analysis.is_ai_generated}, "
                    f"confidence={analysis.confidence:.2f}")
        return analysis

    except requests.exceptions.RequestException as e:
        logger.warning(f"Could not download image {image_url}: {e}")
        return ImageAnalysis.objects.create(
            job=job,
            image_url=image_url,
            status='failed',
            skip_reason=f"Download failed: {str(e)}",
        )
    except Exception as e:
        logger.error(f"Image analysis failed for {image_url}: {e}", exc_info=True)
        return ImageAnalysis.objects.create(
            job=job,
            image_url=image_url,
            status='failed',
            skip_reason=f"Analysis error: {str(e)}",
        )
