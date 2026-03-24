import json
import logging
from typing import Tuple

from langchain_google_genai import ChatGoogleGenerativeAI

from .prompt_templates import VERIFICATION_SYSTEM

logger = logging.getLogger(__name__)

VALID_VERDICTS = {'true', 'false', 'partially_true', 'unverifiable'}

_UNVERIFIABLE_DEFAULT = {
    "verdict": "unverifiable",
    "confidence_score": 0.0,
    "reasoning": "No evidence available to verify this claim.",
    "supporting_sources": [],
    "contradicting_sources": [],
    "conflict_note": None,
}


def _parse_verdict_json(content: str) -> dict:
    """Extract and parse JSON from an LLM response string."""
    if '```json' in content:
        content = content.split('```json')[1].split('```')[0].strip()
    elif '```' in content:
        content = content.split('```')[1].split('```')[0].strip()
    return json.loads(content)


def _sanitize_verdict(verdict_dict: dict) -> dict:
    """Validate and clamp fields to safe values in-place, then return."""
    if verdict_dict.get('verdict') not in VALID_VERDICTS:
        logger.warning(f"Invalid verdict '{verdict_dict.get('verdict')}', defaulting to 'unverifiable'")
        verdict_dict['verdict'] = 'unverifiable'

    try:
        confidence = float(verdict_dict.get('confidence_score', 0.0))
    except (TypeError, ValueError):
        confidence = 0.0
    verdict_dict['confidence_score'] = max(0.0, min(1.0, confidence))

    verdict_dict.setdefault('supporting_sources', [])
    verdict_dict.setdefault('contradicting_sources', [])
    verdict_dict.setdefault('conflict_note', None)
    return verdict_dict


def verify_claim(claim: str, evidence_list: list[dict], max_retries: int = 2) -> Tuple[bool, dict, str]:
    """
    Verify a claim against evidence using Gemini 1.5 Pro.

    Args:
        claim: The claim text to verify.
        evidence_list: List of evidence dicts with 'url', 'title', 'content' keys.
        max_retries: Number of JSON self-reflection retries.

    Returns:
        tuple: (success: bool, verdict_dict: dict, error_msg: str)

    Verdict dict structure:
        {
            "verdict": "true|false|partially_true|unverifiable",
            "confidence_score": 0.0-1.0,
            "reasoning": "...",
            "supporting_sources": [...],
            "contradicting_sources": [...],
            "conflict_note": "..." | null
        }
    """
    if not evidence_list:
        logger.warning(f"No evidence provided for claim: {claim[:80]}...")
        return True, dict(_UNVERIFIABLE_DEFAULT), ""

    try:
        logger.info(f"Starting verification for claim: {claim[:80]}...")

        llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0)

        evidence_text = "\n".join([
            f"[Source {i + 1}] {e.get('title', 'Untitled')}\n"
            f"URL: {e.get('url', 'N/A')}\n"
            f"Content: {e.get('content', 'No content')[:500]}...\n"
            for i, e in enumerate(evidence_list)
        ])

        user_prompt = f"""CLAIM TO VERIFY:
{claim}

EVIDENCE:
{evidence_text}

Analyze the evidence carefully and provide your verdict in the specified JSON format.
"""

        response = llm.invoke([
            {"role": "system", "content": VERIFICATION_SYSTEM},
            {"role": "user", "content": user_prompt}
        ])

        try:
            verdict_dict = _parse_verdict_json(response.content)
            required = {'verdict', 'confidence_score', 'reasoning'}
            if not required.issubset(verdict_dict):
                raise KeyError(f"Missing required fields: {required - verdict_dict.keys()}")

            verdict_dict = _sanitize_verdict(verdict_dict)
            logger.info(f"Verification complete: {verdict_dict['verdict']} "
                        f"(confidence: {verdict_dict['confidence_score']})")
            return True, verdict_dict, ""

        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.warning(f"JSON parse failed on first attempt: {e}")

            if max_retries > 0:
                reflection_prompt = f"""Your previous output was not valid JSON or had missing fields.

Original response:
{response.content}

Error: {str(e)}

Return ONLY the corrected JSON object with NO additional text. Ensure:
1. "verdict" is one of: true, false, partially_true, unverifiable
2. "confidence_score" is a number between 0.0 and 1.0
3. All string fields are properly quoted
"""
                retry_response = llm.invoke([
                    {"role": "system", "content": VERIFICATION_SYSTEM},
                    {"role": "user", "content": reflection_prompt}
                ])

                try:
                    verdict_dict = _parse_verdict_json(retry_response.content)
                    verdict_dict = _sanitize_verdict(verdict_dict)
                    logger.info(f"Verification complete on retry: {verdict_dict['verdict']}")
                    return True, verdict_dict, ""
                except Exception as retry_err:
                    logger.error(f"JSON parsing failed on retry: {retry_err}")
                    fallback = dict(_UNVERIFIABLE_DEFAULT)
                    fallback['reasoning'] = f"Could not parse verification response: {retry_err}"
                    return True, fallback, f"Verification parsing failed: {retry_err}"

            fallback = dict(_UNVERIFIABLE_DEFAULT)
            fallback['reasoning'] = f"JSON parsing failed: {e}"
            return True, fallback, f"JSON parsing failed: {e}"

    except Exception as e:
        logger.error(f"Verification failed: {e}", exc_info=True)
        return False, {}, f"Verification error: {str(e)}"
