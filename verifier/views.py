import json

from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import VerificationJob
from .pipeline import run_verification_pipeline
from .rate_limiter import check_rate_limit, get_client_ip
from .serializers import (
    VerificationJobCreateSerializer,
    VerificationJobDetailSerializer,
    VerificationJobListSerializer,
)


class VerificationJobListView(APIView):
    """GET /api/jobs/ — list all verification jobs, newest first."""

    def get(self, _request):
        jobs = VerificationJob.objects.order_by('-created_at')
        return Response(VerificationJobListSerializer(jobs, many=True).data)


class VerificationCreateView(APIView):
    """
    POST /api/verify/

    Accept plain text or a URL, create a VerificationJob, and return the
    job_id. The client should then open GET /api/jobs/<job_id>/stream/ to
    receive real-time pipeline updates via SSE.
    """

    def post(self, request):
        ip = get_client_ip(request)
        if not check_rate_limit(ip):
            return Response(
                {'detail': 'Rate limit exceeded. Max 10 requests per minute.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        serializer = VerificationJobCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        job = VerificationJob.objects.create(
            input_type=serializer.validated_data['input_type'],
            raw_input=serializer.validated_data['content'],
            status='pending',
        )

        return Response(
            {'job_id': str(job.id), 'status': 'pending'},
            status=status.HTTP_201_CREATED,
        )


class VerificationDetailView(APIView):
    """GET /api/jobs/<job_id>/ — retrieve a completed job with full report."""

    def get(self, _request, job_id):
        try:
            job = VerificationJob.objects.get(id=job_id)
        except VerificationJob.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(VerificationJobDetailSerializer(job).data)


class VerificationStreamView(APIView):
    """
    GET /api/jobs/<job_id>/stream/

    Opens an SSE connection and runs the full verification pipeline, streaming
    real-time status events to the client.

    Event types emitted:
        status          — pipeline stage changes
        claim_extracted — a new atomic claim was found
        evidence_found  — search results retrieved for a claim
        claim_verified  — a claim has been classified with a verdict
        complete        — pipeline finished; payload is the AccuracyReport summary
        error           — unrecoverable pipeline failure
    """

    def get(self, _request, job_id):
        try:
            job = VerificationJob.objects.get(id=job_id)
        except VerificationJob.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        # If already complete, stream the final result immediately
        if job.status == 'complete':
            def instant_stream():
                data = VerificationJobDetailSerializer(job).data
                yield f"event: complete\ndata: {json.dumps(data)}\n\n"
            response = StreamingHttpResponse(instant_stream(), content_type='text/event-stream')
            response['Cache-Control'] = 'no-cache'
            response['X-Accel-Buffering'] = 'no'
            return response

        if job.status == 'failed':
            def error_stream():
                yield f"event: error\ndata: {json.dumps({'message': job.error_message or 'Job failed'})}\n\n"
            response = StreamingHttpResponse(error_stream(), content_type='text/event-stream')
            response['Cache-Control'] = 'no-cache'
            response['X-Accel-Buffering'] = 'no'
            return response

        response = StreamingHttpResponse(
            run_verification_pipeline(str(job_id)),
            content_type='text/event-stream',
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response
