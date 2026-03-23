import logging

from django.http import JsonResponse

logger = logging.getLogger(__name__)


class GlobalExceptionMiddleware:
    """
    Catches all unhandled exceptions and returns a structured JSON response
    instead of Django's default HTML error page.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            return self.get_response(request)
        except Exception as e:
            logger.error(f"Unhandled exception: {e}", exc_info=True)
            return JsonResponse(
                {'error': 'Internal Server Error', 'detail': str(e)},
                status=500,
            )
