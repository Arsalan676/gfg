import json
import logging
import math
import re

from langchain_google_genai import ChatGoogleGenerativeAI

from .agents.prompt_templates import AI_TEXT_DETECTION

logger = logging.getLogger(__name__)


# ── Linguistic heuristics ────────────────────────────────────────────────────

def _entropy(text: str) -> float:
    """Shannon entropy of character distribution."""
    if not text:
        return 0.0
    freq: dict[str, int] = {}
    for c in text:
        freq[c] = freq.get(c, 0) + 1
    total = len(text)
    return -sum((v / total) * math.log2(v / total) for v in freq.values())


def _type_token_ratio(text: str) -> float:
    """Unique words / total words. Low TTR → repetitive vocabulary."""
    words = re.findall(r'\b\w+\b', text.lower())
    return len(set(words)) / len(words) if words else 0.0


def _sentence_length_variance(text: str) -> float:
    """Variance of per-sentence word counts. Low variance → uniform structure."""
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if s.strip()]
    if len(sentences) < 2:
        return 0.0
    lengths = [len(s.split()) for s in sentences]
    mean = sum(lengths) / len(lengths)
    return sum((length - mean) ** 2 for length in lengths) / len(lengths)


def _heuristic_score(text: str) -> tuple[float, list[str]]:
    """
    Return (probability_score, indicators) based purely on linguistic features.
    Each indicator adds to the score; final value is clamped to [0.0, 1.0].
    """
    indicators: list[str] = []
    score = 0.0

    entropy = _entropy(text)
    ttr = _type_token_ratio(text)
    variance = _sentence_length_variance(text)
    words = re.findall(r'\b\w+\b', text)
    word_count = len(words)

    if entropy > 4.5:
        score += 0.2
        indicators.append("High character entropy")

    if ttr < 0.4:
        score += 0.2
        indicators.append("Low type-token ratio (repetitive vocabulary)")

    if variance < 10.0:
        score += 0.2
        indicators.append("Low sentence length variance (uniform structure)")

    contraction_count = len(re.findall(r"\b\w+'\w+\b", text))
    if word_count > 50 and contraction_count / word_count < 0.01:
        score += 0.1
        indicators.append("Absence of contractions")

    if not re.search(r'[!?]{2,}|\.{4,}', text):
        score += 0.1
        indicators.append("Suspiciously perfect punctuation")

    return min(score, 1.0), indicators


# ── Public API ───────────────────────────────────────────────────────────────

def detect_ai_text(text: str) -> dict:
    """
    Hybrid AI text detection: LLM analysis (60%) + linguistic heuristics (40%).

    Returns:
        dict with keys: ai_probability (float), reasoning (str), indicators (list[str])
        Returns empty dict if text is too short or detection fails entirely.
    """
    if not text or len(text.strip()) < 100:
        return {}

    heuristic_prob, heuristic_indicators = _heuristic_score(text)

    try:
        llm = ChatGoogleGenerativeAI(model="gemini-1.5-pro", temperature=0)
        prompt = AI_TEXT_DETECTION.format(text=text[:3000])
        response = llm.invoke([{"role": "user", "content": prompt}])

        content = response.content
        if '```json' in content:
            content = content.split('```json')[1].split('```')[0].strip()
        elif '```' in content:
            content = content.split('```')[1].split('```')[0].strip()

        llm_result = json.loads(content)
        llm_prob = float(llm_result.get('ai_probability', 0.5))
        llm_indicators = llm_result.get('indicators', [])

        combined_prob = round(0.6 * llm_prob + 0.4 * heuristic_prob, 3)
        all_indicators = list(set(heuristic_indicators + llm_indicators))

        logger.info(f"AI detection: probability={combined_prob} "
                    f"(LLM={llm_prob:.2f}, heuristic={heuristic_prob:.2f})")
        return {
            'ai_probability': combined_prob,
            'reasoning': llm_result.get('reasoning', ''),
            'indicators': all_indicators,
        }

    except Exception as e:
        logger.warning(f"LLM AI detection failed, using heuristics only: {e}")
        return {
            'ai_probability': round(heuristic_prob, 3),
            'reasoning': 'Heuristic analysis only (LLM unavailable)',
            'indicators': heuristic_indicators,
        }
