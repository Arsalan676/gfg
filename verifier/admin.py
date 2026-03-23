from django.contrib import admin

from .models import AccuracyReport, Claim, ImageAnalysis, VerificationJob


@admin.register(VerificationJob)
class VerificationJobAdmin(admin.ModelAdmin):
    list_display = ('id', 'input_type', 'status', 'created_at', 'completed_at')
    list_filter = ('status', 'input_type')
    search_fields = ('id', 'raw_input')
    readonly_fields = ('id', 'created_at', 'updated_at', 'completed_at')
    ordering = ('-created_at',)


@admin.register(Claim)
class ClaimAdmin(admin.ModelAdmin):
    list_display = ('id', 'job', 'verdict', 'confidence_score', 'created_at')
    list_filter = ('verdict',)
    search_fields = ('claim_text',)
    readonly_fields = ('id', 'created_at')


@admin.register(AccuracyReport)
class AccuracyReportAdmin(admin.ModelAdmin):
    list_display = ('job', 'overall_score', 'true_count', 'false_count',
                    'partially_true_count', 'unverifiable_count', 'ai_text_probability', 'report_generated_at')
    readonly_fields = ('report_generated_at',)


@admin.register(ImageAnalysis)
class ImageAnalysisAdmin(admin.ModelAdmin):
    list_display = ('id', 'job', 'status', 'is_ai_generated', 'confidence', 'deepfake_probability', 'created_at')
    list_filter = ('status', 'is_ai_generated')
    readonly_fields = ('id', 'created_at')
