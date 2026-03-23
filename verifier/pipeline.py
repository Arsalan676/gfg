import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Generator

from django.db import transaction
from django.utils import timezone

from .agents.claim_extractor import extract_claims
from .agents.evidence_retriever import EvidenceRetriever
from .agents.image_detector import ImageDetector
from .agents.report_builder import build_report
from .agents.url_scraper import extract_text_from_url
from .agents.verifier_agent import verify_claim
from .ai_detector import detect_ai_text
from .models import AccuracyReport, Claim, ImageAnalysis, VerificationJob

logger = logging.getLogger(__name__)


def _emit(event_type: str, data: dict) -> str:
    """Format a single SSE event string."""
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


def run_verification_pipeline(job_id: str) -> Generator[str, None, None]:
    """
    Main pipeline orchestrator. Yields SSE-formatted event strings.

    Steps:
        1. Extract text from URL (if input_type == 'url')
        2. Extract atomic claims from text
        3. Retrieve evidence for each claim (parallel, Tavily)
        4. Verify each claim against evidence (parallel, Gemini)
        5. AI-text detection (bonus, hybrid)
        6. Build and save AccuracyReport
    """
    yield ": heartbeat\n\n"  # keep-alive before any DB work

    try:
        job = VerificationJob.objects.get(id=job_id)
    except VerificationJob.DoesNotExist:
        yield _emit('error', {'message': f'Job {job_id} not found'})
        return

    try:
        # ── Step 1: URL scraping ─────────────────────────────────────────────
        extracted_text = job.raw_input

        if job.input_type == 'url':
            job.status = 'extracting'
            job.save(update_fields=['status', 'updated_at'])
            yield _emit('status', {
                'status': 'extracting',
                'message': 'Scraping article and extracting text...',
            })

            success, text, error_msg = extract_text_from_url(job.raw_input)
            if not success:
                job.status = 'failed'
                job.error_message = error_msg
                job.save(update_fields=['status', 'error_message', 'updated_at'])
                yield _emit('error', {'message': error_msg})
                return

            extracted_text = text
            job.extracted_text = extracted_text
            job.save(update_fields=['extracted_text', 'updated_at'])

            # ── Step 1b: Image detection (URL input only) ────────────────────
            yield _emit('status', {
                'status': 'extracting',
                'message': 'Detecting AI-generated images...',
            })
            try:
                import requests as _requests
                html_resp = _requests.get(
                    job.raw_input,
                    headers={'User-Agent': 'Mozilla/5.0'},
                    timeout=10,
                )
                detector = ImageDetector(min_image_size=100_000, max_images=10)
                _, img_analyses, _ = detector.detect_images_in_url(
                    job.raw_input, html_resp.text
                )
                for analysis in img_analyses:
                    with transaction.atomic():
                        ImageAnalysis.objects.create(
                            job=job,
                            image_url=analysis['image_url'],
                            status=analysis.get('status', 'analyzed'),
                            is_ai_generated=analysis.get('is_ai_generated'),
                            confidence=analysis.get('confidence'),
                            deepfake_probability=analysis.get('deepfake_probability'),
                            indicators=analysis.get('indicators', []),
                            skip_reason=analysis.get('skip_reason'),
                        )
                    if analysis.get('status') == 'analyzed':
                        yield _emit('image_analyzed', {
                            'image_url': analysis['image_url'][:120],
                            'is_ai_generated': analysis.get('is_ai_generated'),
                            'confidence': analysis.get('confidence'),
                        })
            except Exception as e:
                logger.warning(f"Image detection failed (non-fatal): {e}")

        # ── Step 2: Claim extraction ─────────────────────────────────────────
        job.status = 'extracting'
        job.save(update_fields=['status', 'updated_at'])
        yield _emit('status', {
            'status': 'extracting',
            'message': 'Extracting factual claims from text...',
        })

        success, claims, _ = extract_claims(extracted_text)
        if not success or not claims:
            claims = []

        logger.info(f"Extracted {len(claims)} claims for job {job_id}")
        for claim in claims:
            yield _emit('claim_extracted', {'claim': claim})

        if not claims:
            yield _emit('status', {
                'status': 'complete',
                'message': 'No verifiable claims found in the provided content.',
            })
            build_report(str(job.id), [])
            job.status = 'complete'
            job.completed_at = timezone.now()
            job.save(update_fields=['status', 'completed_at', 'updated_at'])
            yield _emit('complete', {'overall_score': 0.0, 'true_count': 0,
                                     'false_count': 0, 'partially_true_count': 0,
                                     'unverifiable_count': 0})
            return

        # ── Step 3: Evidence retrieval (parallel) ────────────────────────────
        job.status = 'searching'
        job.save(update_fields=['status', 'updated_at'])
        yield _emit('status', {
            'status': 'searching',
            'message': f'Searching web for evidence on {len(claims)} claims...',
        })

        retriever = EvidenceRetriever(max_workers=5, tavily_max_results=5)
        evidence_map: dict[str, list[dict]] = {}

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {
                executor.submit(retriever.retrieve_evidence, claim): claim
                for claim in claims
            }
            for future in as_completed(futures):
                claim = futures[future]
                try:
                    ok, evidence, _ = future.result()
                    evidence_map[claim] = evidence if ok else []
                    yield _emit('evidence_found', {
                        'claim': claim[:120],
                        'source_count': len(evidence_map[claim]),
                    })
                except Exception as e:
                    logger.error(f"Evidence retrieval exception for claim: {e}")
                    evidence_map[claim] = []

        # ── Step 4: Verification (parallel) ─────────────────────────────────
        job.status = 'verifying'
        job.save(update_fields=['status', 'updated_at'])
        yield _emit('status', {
            'status': 'verifying',
            'message': f'Verifying {len(claims)} claims with Gemini...',
        })

        verified_claims: list[dict] = []

        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = {
                executor.submit(verify_claim, claim, evidence_map.get(claim, [])): claim
                for claim in claims
            }
            for future in as_completed(futures):
                claim = futures[future]
                try:
                    ok, verdict_dict, _ = future.result()
                    if not ok:
                        continue

                    with transaction.atomic():
                        Claim.objects.create(
                            job=job,
                            claim_text=claim,
                            verdict=verdict_dict['verdict'],
                            confidence_score=verdict_dict['confidence_score'],
                            reasoning=verdict_dict['reasoning'],
                            sources=evidence_map.get(claim, []),
                        )

                    verdict_dict['claim_text'] = claim
                    verified_claims.append(verdict_dict)

                    yield _emit('claim_verified', {
                        'claim': claim[:120],
                        'verdict': verdict_dict['verdict'],
                        'confidence_score': verdict_dict['confidence_score'],
                    })
                except Exception as e:
                    logger.error(f"Verification exception for claim '{claim[:60]}': {e}")

        # ── Step 5: AI text detection (bonus) ────────────────────────────────
        yield _emit('status', {
            'status': 'verifying',
            'message': 'Running AI-text detection...',
        })
        ai_result = detect_ai_text(extracted_text)

        # ── Step 6: Build report ─────────────────────────────────────────────
        success, report_dict, _ = build_report(str(job.id), verified_claims)

        if success and ai_result:
            try:
                with transaction.atomic():
                    report = AccuracyReport.objects.get(job=job)
                    report.ai_text_probability = ai_result.get('ai_probability')
                    report.ai_text_indicators = ai_result.get('indicators', [])
                    report.save(update_fields=['ai_text_probability', 'ai_text_indicators'])
                report_dict['ai_text_probability'] = ai_result.get('ai_probability')
                report_dict['ai_text_indicators'] = ai_result.get('indicators', [])
            except Exception as e:
                logger.warning(f"Could not persist AI detection results: {e}")

        job.status = 'complete'
        job.completed_at = timezone.now()
        job.save(update_fields=['status', 'completed_at', 'updated_at'])

        yield _emit('complete', report_dict)

    except Exception as e:
        logger.error(f"Pipeline failed for job {job_id}: {e}", exc_info=True)
        try:
            job.status = 'failed'
            job.error_message = str(e)
            job.save(update_fields=['status', 'error_message', 'updated_at'])
        except Exception:
            pass
        yield _emit('error', {'message': str(e)})
