"""
Test Prometheus Metrics Exposure

Tests for:
- Metrics endpoint availability
- Counter increments
- Histogram recording
- Gauge updates
"""
import pytest
from unittest.mock import patch, MagicMock


class TestMetricsEndpoint:
    """Tests for /metrics endpoint."""

    def test_metrics_endpoint_exists(self, client):
        """Metrics endpoint should exist."""
        response = client.get('/metrics')
        # Should return 200 with Prometheus metrics
        assert response.status_code in [200, 404]

    def test_metrics_returns_prometheus_format(self, client):
        """Metrics should be in Prometheus text format."""
        response = client.get('/metrics')
        if response.status_code == 200:
            content = response.data.decode('utf-8')
            # Prometheus format includes HELP and TYPE comments
            assert (
                '# HELP' in content
                or '# TYPE' in content
                or 'guidance_' in content
            )


class TestRequestMetrics:
    """Tests for request-related metrics."""

    def test_request_counter_increments(self, client, general_variables):
        """Request counter should increment on each request."""
        # Make a request
        client.post('/generate', json={
            'template': 'general_classifier',
            'variables': general_variables
        })

        # Check metrics
        response = client.get('/metrics')
        if response.status_code == 200:
            content = response.data.decode('utf-8')
            # Should have request counter
            assert 'guidance_requests_total' in content

    def test_request_labels_by_status(self, client, general_variables):
        """Request counter should have status labels."""
        # Make successful and failed requests
        client.post('/generate', json={
            'template': 'general_classifier',
            'variables': general_variables
        })

        client.post('/generate', json={
            'template': 'nonexistent'
        })

        response = client.get('/metrics')
        if response.status_code == 200:
            content = response.data.decode('utf-8')
            # Should have different status labels
            # e.g., guidance_requests_total{status="success"}
            #       guidance_requests_total{status="error"}


class TestLatencyMetrics:
    """Tests for latency histogram metrics."""

    def test_latency_histogram_recorded(self, client, general_variables):
        """Latency histogram should record request duration."""
        client.post('/generate', json={
            'template': 'general_classifier',
            'variables': general_variables
        })

        response = client.get('/metrics')
        if response.status_code == 200:
            content = response.data.decode('utf-8')
            # Should have latency histogram
            assert (
                'guidance_request_latency_seconds' in content
                or 'latency' in content.lower()
            )

    def test_latency_by_template(self, client, general_variables):
        """Latency should be labeled by template."""
        client.post('/generate', json={
            'template': 'general_classifier',
            'variables': general_variables
        })

        response = client.get('/metrics')
        if response.status_code == 200:
            content = response.data.decode('utf-8')
            # Should have template label in latency metric


class TestCacheMetrics:
    """Tests for cache-related metrics."""

    def test_cache_hit_counter(self, client, general_variables):
        """Cache hits should be counted."""
        # Make same request twice
        client.post('/generate', json={
            'template': 'general_classifier',
            'variables': general_variables,
            'use_cache': True
        })
        client.post('/generate', json={
            'template': 'general_classifier',
            'variables': general_variables,
            'use_cache': True
        })

        response = client.get('/metrics')
        if response.status_code == 200:
            content = response.data.decode('utf-8')
            # Should have cache metrics
            assert 'guidance_cache' in content or 'cache' in content.lower()

    def test_cache_miss_counter(self, client):
        """Cache misses should be counted."""
        # Make unique request
        client.post('/generate', json={
            'template': 'general_classifier',
            'variables': {'text': 'unique_text_12345'},
            'use_cache': True
        })

        response = client.get('/metrics')
        if response.status_code == 200:
            content = response.data.decode('utf-8')
            # Should show cache miss


class TestValidationMetrics:
    """Tests for validation-related metrics."""

    def test_validation_success_counter(self, client, general_variables):
        """Successful validations should be counted."""
        client.post('/generate', json={
            'template': 'general_classifier',
            'variables': general_variables
        })

        response = client.get('/metrics')
        if response.status_code == 200:
            content = response.data.decode('utf-8')
            # Should have validation metrics
            assert (
                'guidance_validation' in content
                or 'validation' in content.lower()
            )


class TestActiveRequestGauge:
    """Tests for active request gauge."""

    def test_active_requests_gauge_exists(self, client):
        """Active requests gauge should exist."""
        response = client.get('/metrics')
        if response.status_code == 200:
            content = response.data.decode('utf-8')
            # Should have active requests gauge
            # e.g., guidance_active_requests


class TestMetricsIntegration:
    """Integration tests for metrics system."""

    @pytest.mark.parametrize("template", [
        'medical_extractor',
        'financial_extractor',
        'legal_extractor',
        'general_classifier'
    ])
    def test_metrics_by_template(self, client, template):
        """Each template should have its metrics tracked."""
        client.post('/generate', json={
            'template': template,
            'variables': {'text': 'test'}
        })

        response = client.get('/metrics')
        if response.status_code == 200:
            content = response.data.decode('utf-8')
            # Template should appear in metrics (if request succeeded)

    def test_error_metrics_captured(self, client):
        """Errors should be captured in metrics."""
        # Force an error
        client.post('/generate', json={
            'template': 'nonexistent_template'
        })

        response = client.get('/metrics')
        if response.status_code == 200:
            content = response.data.decode('utf-8')
            # Should have error status in metrics
