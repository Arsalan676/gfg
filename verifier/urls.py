from django.urls import path
from .views import VerificationCreateView, VerificationDetailView, VerificationStreamView

app_name = 'verifier'

urlpatterns = [
    path('verify/', VerificationCreateView.as_view(), name='verify_create'),
    path('jobs/<uuid:job_id>/', VerificationDetailView.as_view(), name='job_detail'),
    path('jobs/<uuid:job_id>/stream/', VerificationStreamView.as_view(), name='job_stream'),
]
