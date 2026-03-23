from rest_framework import serializers
from .models import VerificationJob, Claim, AccuracyReport, ImageAnalysis


class ClaimSerializer(serializers.ModelSerializer):
    class Meta:
        model = Claim
        fields = ['id', 'claim_text', 'verdict', 'confidence_score', 'reasoning', 'sources', 'created_at']


class ImageAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImageAnalysis
        fields = ['id', 'image_url', 'status', 'is_ai_generated', 'confidence', 'deepfake_probability', 'indicators', 'skip_reason']


class AccuracyReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccuracyReport
        fields = ['job', 'overall_score', 'true_count', 'false_count', 'partially_true_count', 'unverifiable_count', 'ai_text_probability', 'ai_text_indicators', 'report_generated_at']


class VerificationJobDetailSerializer(serializers.ModelSerializer):
    claims = ClaimSerializer(many=True, read_only=True)
    report = AccuracyReportSerializer(read_only=True)
    image_analyses = ImageAnalysisSerializer(many=True, read_only=True)

    class Meta:
        model = VerificationJob
        fields = ['id', 'input_type', 'raw_input', 'extracted_text', 'status', 'created_at', 'updated_at', 'completed_at', 'error_message', 'claims', 'report', 'image_analyses']


class VerificationJobCreateSerializer(serializers.Serializer):
    input_type = serializers.ChoiceField(choices=['text', 'url'])
    content = serializers.CharField(max_length=50000, min_length=50)

    def validate_content(self, value):
        if self.initial_data.get('input_type') == 'url':
            if not (value.startswith('http://') or value.startswith('https://')):
                raise serializers.ValidationError("URL must start with http:// or https://")
        return value


class VerificationJobListSerializer(serializers.ModelSerializer):
    class Meta:
        model = VerificationJob
        fields = ['id', 'input_type', 'status', 'created_at', 'completed_at']
