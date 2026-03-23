from django.db import models
import uuid


class VerificationJob(models.Model):
    INPUT_CHOICES = [('text', 'Text'), ('url', 'URL')]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('extracting', 'Extracting'),
        ('searching', 'Searching'),
        ('verifying', 'Verifying'),
        ('complete', 'Complete'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    input_type = models.CharField(max_length=10, choices=INPUT_CHOICES)
    raw_input = models.TextField()
    extracted_text = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Job {self.id} - {self.status}"

    def __repr__(self):
        return f"<VerificationJob id={self.id} status={self.status}>"


class Claim(models.Model):
    VERDICT_CHOICES = [
        ('true', 'True'),
        ('false', 'False'),
        ('partially_true', 'Partially True'),
        ('unverifiable', 'Unverifiable'),
    ]

    job = models.ForeignKey(VerificationJob, on_delete=models.CASCADE, related_name='claims')
    claim_text = models.TextField()
    verdict = models.CharField(max_length=20, choices=VERDICT_CHOICES)
    confidence_score = models.FloatField()  # 0.0-1.0
    reasoning = models.TextField()  # Chain-of-thought explanation
    sources = models.JSONField(default=list)  # [{url, title, content, source, relevance_score, credibility_score}]
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Claim: {self.claim_text[:50]}... ({self.verdict})"

    def __repr__(self):
        return f"<Claim id={self.id} verdict={self.verdict}>"


class AccuracyReport(models.Model):
    job = models.OneToOneField(VerificationJob, on_delete=models.CASCADE, related_name='report')
    overall_score = models.FloatField()  # Weighted average of confidence scores
    true_count = models.IntegerField(default=0)
    false_count = models.IntegerField(default=0)
    partially_true_count = models.IntegerField(default=0)
    unverifiable_count = models.IntegerField(default=0)
    ai_text_probability = models.FloatField(null=True, blank=True)  # 0.0-1.0, Bonus
    ai_text_indicators = models.JSONField(default=list, blank=True)  # Bonus: ["Low variance", "High entropy"]
    report_generated_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Report for {self.job.id}: {self.overall_score:.2f}"

    def __repr__(self):
        return f"<AccuracyReport job={self.job.id} score={self.overall_score}>"


class ImageAnalysis(models.Model):
    STATUS_CHOICES = [
        ('analyzed', 'Analyzed'),
        ('skipped', 'Skipped'),
        ('failed', 'Failed'),
    ]

    job = models.ForeignKey(VerificationJob, on_delete=models.CASCADE, related_name='image_analyses')
    image_url = models.URLField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='analyzed')
    is_ai_generated = models.BooleanField(null=True, blank=True)
    confidence = models.FloatField(null=True, blank=True)  # 0.0-1.0
    deepfake_probability = models.FloatField(null=True, blank=True)  # 0.0-1.0
    indicators = models.JSONField(default=list, blank=True)
    skip_reason = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image: {self.image_url[:50]}... ({self.status})"

    def __repr__(self):
        return f"<ImageAnalysis id={self.id} status={self.status}>"
