import logging
from typing import Tuple

from verifier.ai_detector import detect_ai_text

logger = logging.getLogger(__name__)


class AITextDetector:
    """
    Class-based agent for AI-generated text detection.
    Delegates to the hybrid LLM + heuristics implementation in verifier.ai_detector.
    """

    def detect_ai_text(self, text: str) -> Tuple[bool, dict, str]:
        """
        Detect AI-generated text using hybrid LLM + linguistic heuristics.

        Returns:
            tuple: (success: bool, detection_dict: dict, error_msg: str)

        detection_dict keys:
            ai_probability  (float 0.0–1.0)
            reasoning       (str)
            indicators      (list[str])
            llm_score       (float)   — when LLM ran successfully
            heuristic_score (float)   — always present
        """
        if not text or len(text.strip()) < 50:
            return True, {
                "ai_probability": 0.0,
                "reasoning": "Text too short for reliable detection",
                "indicators": [],
                "llm_score": 0.0,
                "heuristic_score": 0.0,
            }, ""

        try:
            result = detect_ai_text(text)
            if not result:
                return True, {
                    "ai_probability": 0.0,
                    "reasoning": "Detection returned no result",
                    "indicators": [],
                    "llm_score": 0.0,
                    "heuristic_score": 0.0,
                }, ""

            # Normalise to the expected dict shape (add llm/heuristic fields if absent)
            result.setdefault("llm_score", result.get("ai_probability", 0.0))
            result.setdefault("heuristic_score", 0.0)

            logger.info(f"AI text detection complete: probability={result['ai_probability']}")
            return True, result, ""

        except Exception as e:
            logger.error(f"AITextDetector failed: {e}", exc_info=True)
            return False, {}, f"Detection error: {str(e)}"
