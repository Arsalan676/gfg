import logging
from typing import Tuple

from django.db import transaction

from verifier.models import VerificationJob, AccuracyReport

logger = logging.getLogger(__name__)


def build_report(job_id: str, claims_data: list[dict]) -> Tuple[bool, dict, str]:
    """
    Build and save the final AccuracyReport from verified claims.

    Args:
        job_id: UUID string of the VerificationJob.
        claims_data: List of verified claim dicts, each containing 'verdict'
                     and 'confidence_score' keys.

    Returns:
        tuple: (success: bool, report_dict: dict, error_msg: str)
    """
    try:
        logger.info(f"Building report for job {job_id} with {len(claims_data)} claims")

        true_count = sum(1 for c in claims_data if c.get('verdict') == 'true')
        false_count = sum(1 for c in claims_data if c.get('verdict') == 'false')
        partially_true_count = sum(1 for c in claims_data if c.get('verdict') == 'partially_true')
        unverifiable_count = sum(1 for c in claims_data if c.get('verdict') == 'unverifiable')

        total = len(claims_data)
        overall_score = (
            sum(c.get('confidence_score', 0.0) for c in claims_data) / total
            if total > 0 else 0.0
        )

        with transaction.atomic():
            job = VerificationJob.objects.get(id=job_id)

            report, created = AccuracyReport.objects.get_or_create(
                job=job,
                defaults={
                    'overall_score': overall_score,
                    'true_count': true_count,
                    'false_count': false_count,
                    'partially_true_count': partially_true_count,
                    'unverifiable_count': unverifiable_count,
                }
            )

            if not created:
                report.overall_score = overall_score
                report.true_count = true_count
                report.false_count = false_count
                report.partially_true_count = partially_true_count
                report.unverifiable_count = unverifiable_count
                report.save()

        logger.info(
            f"Report saved — True: {true_count}, False: {false_count}, "
            f"Partially True: {partially_true_count}, Unverifiable: {unverifiable_count}, "
            f"Overall score: {overall_score:.2f}"
        )

        return True, {
            'overall_score': overall_score,
            'true_count': true_count,
            'false_count': false_count,
            'partially_true_count': partially_true_count,
            'unverifiable_count': unverifiable_count,
            'report_id': str(report.id) if hasattr(report, 'id') else None,
        }, ""

    except VerificationJob.DoesNotExist:
        logger.error(f"Job {job_id} not found")
        return False, {}, f"Job {job_id} not found"

    except Exception as e:
        logger.error(f"Report building failed: {e}", exc_info=True)
        return False, {}, f"Report building error: {str(e)}"
