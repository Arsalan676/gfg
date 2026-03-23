import json
import logging
from typing import Tuple
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class ClaimsOutput(BaseModel):
    claims: list[str] = Field(description="List of atomic, falsifiable factual claims")


def extract_claims(text: str, max_retries: int = 2) -> Tuple[bool, list[str], str]:
    """
    Extract atomic, verifiable claims from input text using Gemini 1.5 Pro.

    Returns:
        tuple: (success: bool, claims: list[str], error_msg: str)
    """
    if not text or len(text.strip()) < 50:
        logger.warning("Input text too short for claim extraction")
        return False, [], "Input text must be at least 50 characters"

    try:
        logger.info(f"Starting claim extraction on {len(text)} characters")

        llm = ChatGoogleGenerativeAI(model="gemini-1.5-pro", temperature=0)
        parser = PydanticOutputParser(pydantic_object=ClaimsOutput)

        system_prompt = """You are an expert fact-checker. Your task is to identify specific, atomic, falsifiable factual claims from the provided text.

RULES:
1. Only extract claims that are:
   - Specific and measurable (not vague or subjective)
   - Falsifiable (can be proven true or false with evidence)
   - Factual (not opinions, beliefs, or subjective statements)

2. Ignore:
   - Opinions, predictions, and subjective statements
   - Quotes without context
   - Rhetorical questions
   - Normative statements (should, ought)

3. Each claim must be a complete, standalone sentence
4. Extract between 1-20 claims maximum

OUTPUT FORMAT:
Return ONLY valid JSON matching this schema:
{
  "claims": ["claim1", "claim2", "claim3"]
}

Examples of GOOD claims:
- "The Eiffel Tower is 330 meters tall"
- "Paris is the capital of France"
- "COVID-19 was first identified in 2019"

Examples of BAD claims:
- "The Eiffel Tower is beautiful" (subjective)
- "Paris should be the capital" (normative)
- "COVID might have started earlier" (uncertain)
"""

        user_prompt = f"""Extract all atomic, verifiable factual claims from this text:

TEXT:
{text}

{parser.get_format_instructions()}
"""

        response = llm.invoke([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ])

        try:
            parsed = parser.parse(response.content)
            claims = parsed.claims

            if not claims:
                logger.warning("No claims extracted from text")
                return True, [], ""

            logger.info(f"Successfully extracted {len(claims)} claims")
            return True, claims, ""

        except (json.JSONDecodeError, Exception) as e:
            logger.warning(f"JSON parse failed on first attempt: {e}")

            if max_retries > 0:
                reflection_prompt = f"""Your previous output was not valid JSON.

Original output:
{response.content}

Return ONLY the corrected JSON object with no additional text:
{{
  "claims": [...]
}}
"""
                retry_response = llm.invoke([
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": reflection_prompt}
                ])

                try:
                    parsed = parser.parse(retry_response.content)
                    claims = parsed.claims
                    logger.info(f"Successfully extracted {len(claims)} claims on retry")
                    return True, claims, ""
                except Exception as retry_err:
                    logger.error(f"JSON parsing failed on retry: {retry_err}")
                    return False, [], f"Failed to parse LLM output: {retry_err}"

            return False, [], f"JSON parsing failed: {e}"

    except Exception as e:
        logger.error(f"Claim extraction failed: {e}", exc_info=True)
        return False, [], f"Claim extraction error: {str(e)}"
