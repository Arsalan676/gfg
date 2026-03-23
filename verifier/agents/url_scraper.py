import logging
from typing import Tuple
from urllib.parse import urlparse
import requests
from requests.exceptions import Timeout, ConnectionError
import trafilatura
from newspaper import Article
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SCRAPER_TIMEOUT = 10
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
INTERNAL_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '192.168.', '10.', '172.16.']


def extract_text_from_url(url: str) -> Tuple[bool, str, str]:
    """
    Extract text content from a URL using multiple scraping strategies.

    Priority order:
    1. trafilatura (fastest, best for news)
    2. newspaper3k (good for articles)
    3. requests + BeautifulSoup (final fallback)

    Returns:
        tuple: (success: bool, text: str, error_msg: str)
    """
    if not url.startswith(('http://', 'https://')):
        logger.warning(f"Invalid URL scheme: {url}")
        return False, "", "URL must start with http:// or https://"

    parsed = urlparse(url)
    if any(parsed.netloc.startswith(host) for host in INTERNAL_HOSTS):
        logger.warning(f"Rejected internal IP URL: {url}")
        return False, "", "Cannot access internal/local URLs"

    logger.info(f"Starting text extraction from {url}")
    headers = {'User-Agent': USER_AGENT}

    # Verify URL is reachable
    try:
        head_response = requests.head(url, headers=headers, timeout=5, allow_redirects=True)
        if head_response.status_code == 403:
            logger.warning(f"Access forbidden (paywall?): {url}")
            return False, "", "URL appears to be behind a paywall or access is restricted"
        if head_response.status_code >= 400:
            logger.warning(f"URL returned status {head_response.status_code}: {url}")
            return False, "", f"URL returned HTTP {head_response.status_code}"
    except (Timeout, ConnectionError) as e:
        logger.warning(f"URL unreachable: {e}")
        return False, "", f"URL is unreachable: {str(e)}"

    # Strategy 1: trafilatura
    try:
        logger.info("Attempting trafilatura extraction")
        response = requests.get(url, headers=headers, timeout=SCRAPER_TIMEOUT)
        response.raise_for_status()
        text = trafilatura.extract(response.text, include_comments=False)

        if text and len(text.strip()) >= 100:
            logger.info(f"trafilatura extracted {len(text)} chars")
            return True, text, ""
        logger.warning("trafilatura returned insufficient text")
    except Exception as e:
        logger.warning(f"trafilatura failed: {e}")

    # Strategy 2: newspaper3k
    try:
        logger.info("Attempting newspaper3k extraction")
        article = Article(url, headers=headers, request_timeout=SCRAPER_TIMEOUT)
        article.download()
        article.parse()
        text = article.text

        if text and len(text.strip()) >= 100:
            logger.info(f"newspaper3k extracted {len(text)} chars")
            return True, text, ""
        logger.warning("newspaper3k returned insufficient text")
    except Exception as e:
        logger.warning(f"newspaper3k failed: {e}")

    # Strategy 3: BeautifulSoup fallback
    try:
        logger.info("Attempting BeautifulSoup fallback")
        response = requests.get(url, headers=headers, timeout=SCRAPER_TIMEOUT)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')

        for tag in soup(['script', 'style', 'nav', 'footer']):
            tag.decompose()

        text = soup.get_text(separator=' ', strip=True)
        text = ' '.join(text.split())

        if text and len(text.strip()) >= 100:
            logger.info(f"BeautifulSoup extracted {len(text)} chars")
            return True, text, ""
    except Exception as e:
        logger.warning(f"BeautifulSoup fallback failed: {e}")

    logger.error(f"All extraction strategies failed for {url}")
    return False, "", "Could not extract text from URL (paywall, blocked, or insufficient content)"
