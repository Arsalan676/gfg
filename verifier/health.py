from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone


class HealthCheckView(APIView):
    def get(self, request):
        return Response({
            'status': 'ok',
            'version': '1.0.0',
            'timestamp': timezone.now().isoformat()
        })
