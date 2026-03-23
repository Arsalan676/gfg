from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import VerificationJob
from .serializers import VerificationJobDetailSerializer, VerificationJobCreateSerializer


class VerificationCreateView(APIView):
    """POST /api/verify/ — create a new verification job."""

    def post(self, request):
        # Full implementation in Phase 6 (pipeline orchestration)
        serializer = VerificationJobCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        return Response({'detail': 'Not yet implemented'}, status=status.HTTP_501_NOT_IMPLEMENTED)


class VerificationDetailView(APIView):
    """GET /api/jobs/<job_id>/ — retrieve a completed job with its report."""

    def get(self, request, job_id):
        try:
            job = VerificationJob.objects.get(id=job_id)
        except VerificationJob.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = VerificationJobDetailSerializer(job)
        return Response(serializer.data)


class VerificationStreamView(APIView):
    """GET /api/jobs/<job_id>/stream/ — SSE stream of pipeline events."""

    def get(self, _request, _job_id):
        # Full SSE implementation in Phase 6
        return Response({'detail': 'Not yet implemented'}, status=status.HTTP_501_NOT_IMPLEMENTED)
