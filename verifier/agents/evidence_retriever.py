import json
import logging
import time
from typing import Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.tools import TavilySearchResults

from .prompt_templates import SEARCH_QUERY_GENERATION

logger = logging.getLogger(__name__)

CREDIBILITY_DOMAINS = {
    '.gov': 0.95,
    '.edu': 0.90,
    'wikipedia.org': 0.85,
    'bbc.com': 0.85,
    'reuters.com': 0.85,
    'apnews.com': 0.85,
    'theguardian.com': 0.80,
    'nytimes.com': 0.80,
    'washingtonpost.com': 0.80,
    'nature.com': 0.85,
    'science.org': 0.85,
}


class EvidenceRetriever:
    def __init__(self, max_workers: int = 5, tavily_max_results: int = 5):
        """
        Initialize the evidence retriever.

        Args:
            max_workers: Max parallel workers for evidence retrieval
            tavily_max_results: Number of results per Tavily search
        """
        self.llm = ChatGoogleGenerativeAI(model="gemini-1.5-pro", temperature=0)
        self.tavily = TavilySearchResults(
            max_results=tavily_max_results,
            search_depth="advanced"
        )
        self.max_workers = max_workers
        self.tavily_call_count = 0

    def generate_search_queries(self, claim: str) -> Tuple[bool, list[str], str]:
        """
        Generate optimized search queries for a claim using Gemini.

        Returns:
            tuple: (success: bool, queries: list[str], error_msg: str)
        """
        try:
            logger.info(f"Generating search queries for claim: {claim[:80]}...")

            prompt = SEARCH_QUERY_GENERATION.format(claim=claim)
            response = self.llm.invoke([{"role": "user", "content": prompt}])

            content = response.content
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0].strip()
            elif '```' in content:
                content = content.split('```')[1].split('```')[0].strip()

            data = json.loads(content)
            queries = data.get('queries', [])

            if not queries:
                logger.warning("Generated zero queries, using claim as fallback")
                return True, [claim], ""

            logger.info(f"Generated {len(queries)} search queries")
            return True, queries, ""

        except Exception as e:
            logger.warning(f"Search query generation failed: {e}, using claim as fallback")
            return True, [claim], ""

    def _assess_credibility(self, url: str) -> float:
        """Return a credibility score (0.0–1.0) for a source URL."""
        url_lower = url.lower()
        for domain, score in CREDIBILITY_DOMAINS.items():
            if domain in url_lower:
                return score
        return 0.5

    def search_with_retry(self, query: str, max_retries: int = 3) -> Tuple[bool, list[dict], str]:
        """
        Execute a Tavily search with exponential backoff retry.

        Returns:
            tuple: (success: bool, results: list[dict], error_msg: str)
        """
        for attempt in range(max_retries):
            try:
                logger.info(f"Tavily search (attempt {attempt + 1}/{max_retries}): {query[:60]}...")

                raw_results = self.tavily.invoke({"query": query})
                self.tavily_call_count += 1

                if isinstance(raw_results, str):
                    try:
                        raw_results = json.loads(raw_results)
                    except Exception:
                        logger.warning("Could not parse Tavily string response")
                        return True, [], ""

                results = []
                if isinstance(raw_results, list):
                    for item in raw_results:
                        if isinstance(item, dict):
                            results.append({
                                'url': item.get('url', ''),
                                'title': item.get('title', ''),
                                'content': item.get('content', ''),
                                'source': 'tavily',
                                'relevance_score': item.get('score', 0.5),
                                'credibility_score': self._assess_credibility(item.get('url', '')),
                            })

                logger.info(f"Retrieved {len(results)} results for: {query[:60]}...")
                return True, results, ""

            except Exception as e:
                logger.warning(f"Tavily attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    logger.info(f"Waiting {wait_time}s before retry...")
                    time.sleep(wait_time)
                else:
                    logger.error(f"Tavily search failed after {max_retries} attempts")
                    return False, [], f"Search failed after {max_retries} retries: {str(e)}"

        return False, [], "Search failed"

    def deduplicate_results(self, all_results: list[dict]) -> list[dict]:
        """Deduplicate evidence results by URL."""
        seen_urls: set[str] = set()
        deduped = []
        for result in all_results:
            url = result.get('url', '')
            if url and url not in seen_urls:
                seen_urls.add(url)
                deduped.append(result)
        return deduped

    def retrieve_evidence(self, claim: str) -> Tuple[bool, list[dict], str]:
        """
        Generate search queries and retrieve evidence for a claim in parallel.

        Returns:
            tuple: (success: bool, evidence: list[dict], error_msg: str)
        """
        logger.info(f"Starting evidence retrieval for claim: {claim[:80]}...")

        success, queries, error_msg = self.generate_search_queries(claim)
        if not success or not queries:
            return False, [], f"Failed to generate search queries: {error_msg}"

        all_results: list[dict] = []
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {
                executor.submit(self.search_with_retry, query): query
                for query in queries
            }
            for future in as_completed(futures):
                query = futures[future]
                try:
                    ok, results, error = future.result()
                    if ok and results:
                        all_results.extend(results)
                    elif not ok:
                        logger.warning(f"Search failed for '{query}': {error}")
                except Exception as e:
                    logger.error(f"Future execution failed for '{query}': {e}")

        deduped = self.deduplicate_results(all_results)

        if not deduped:
            logger.warning(f"No evidence found for claim: {claim[:80]}...")
            return True, [], ""  # success=True but empty → unverifiable

        logger.info(f"Retrieved {len(deduped)} unique evidence sources")
        return True, deduped, ""
