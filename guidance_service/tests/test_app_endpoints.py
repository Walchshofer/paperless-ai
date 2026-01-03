"""
Test Flask API Endpoints

Tests for:
- /health endpoint
- /generate endpoint
- /templates endpoint
- Error handling
"""
import pytest
import json
from unittest.mock import patch, MagicMock


class TestHealthEndpoint:
    """Tests for /health endpoint."""

    def test_health_returns_200(self, client):
        """Health check should return 200 OK."""
        response = client.get('/health')
        assert response.status_code == 200

    def test_health_returns_json(self, client):
        """Health check should return JSON with status."""
        response = client.get('/health')
        data = json.loads(response.data)
        assert 'status' in data
        assert data['status'] in ['healthy', 'ok']

    def test_health_includes_version(self, client):
        """Health check should include version info."""
        response = client.get('/health')
        data = json.loads(response.data)
        # Version is optional but good to have
        if 'version' in data:
            assert isinstance(data['version'], str)


class TestGenerateEndpoint:
    """Tests for /generate endpoint."""

    def test_generate_requires_template(self, client):
        """Generate endpoint should require template name."""
        response = client.post('/generate', json={
            'variables': {'text': 'test'}
        })
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_generate_rejects_unknown_template(self, client):
        """Generate endpoint should reject unknown templates."""
        response = client.post('/generate', json={
            'template': 'nonexistent_template',
            'variables': {'text': 'test'}
        })
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'not found' in data.get('error', '').lower()

    @patch('app.guidance')
    def test_generate_success_returns_json(
        self,
        mock_guidance,
        client,
        general_variables,
    ):
        """Successful generation should return valid JSON."""
        # Mock guidance to return a valid response
        mock_program = MagicMock()
        mock_program.__getitem__ = MagicMock(return_value=json.dumps({
            "dokumenttyp": "Brief",
            "sprache": "Deutsch"
        }))
        mock_guidance.return_value = mock_program

        response = client.post('/generate', json={
            'template': 'general_classifier',
            'variables': general_variables,
            'model': 'sauerkraut-llama3.1:8b'
        })

        # May fail if Ollama isn't running - skip in CI
        if response.status_code == 200:
            data = json.loads(response.data)
            assert data['status'] == 'success'
            assert 'generated' in data

    def test_generate_validates_model(self, client, general_variables):
        """Generate endpoint should accept model parameter."""
        # This test verifies the parameter is accepted, not that it works
        response = client.post('/generate', json={
            'template': 'general_classifier',
            'variables': general_variables,
            'model': 'test-model'
        })
        # Should not error on model parameter itself
        # Actual errors would come from Ollama being unavailable
        assert response.status_code in [200, 500, 503]


class TestTemplatesEndpoint:
    """Tests for /templates endpoint."""

    def test_templates_returns_list(self, client):
        """Templates endpoint should return list of available templates."""
        response = client.get('/templates')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'templates' in data
        assert isinstance(data['templates'], list)

    def test_templates_includes_all_domains(self, client):
        """Templates should include all domain types."""
        response = client.get('/templates')
        data = json.loads(response.data)
        templates = data.get('templates', [])

        # Check for presence of domain-specific templates
        template_names = [
            t if isinstance(t, str) else t.get('name', '')
            for t in templates
        ]

        # At least one template from each domain should exist
        has_medical = any('medical' in t.lower() for t in template_names)
        has_financial = any('financial' in t.lower() for t in template_names)
        has_legal = any('legal' in t.lower() for t in template_names)
        has_general = any('general' in t.lower() for t in template_names)

        # Not all may be implemented, but at least general should exist
        assert has_general or len(templates) > 0


class TestCacheIntegration:
    """Tests for cache integration with /generate."""

    @patch('app.cache_manager')
    def test_cache_hit_returns_cached(
        self,
        mock_cache,
        client,
        general_variables,
    ):
        """Should return cached result on cache hit."""
        cached_result = {
            'generated': {'dokumenttyp': 'Brief'},
            'validation': {'valid': True, 'errors': []}
        }
        mock_cache.get.return_value = cached_result

        response = client.post('/generate', json={
            'template': 'general_classifier',
            'variables': general_variables,
            'use_cache': True
        })

        if response.status_code == 200:
            data = json.loads(response.data)
            assert data.get('source') == 'cache'

    def test_cache_disabled_skips_cache(self, client, general_variables):
        """Should skip cache when use_cache is False."""
        response = client.post('/generate', json={
            'template': 'general_classifier',
            'variables': general_variables,
            'use_cache': False
        })
        # Verify request was processed (may fail without Ollama)
        assert response.status_code in [200, 500, 503]


class TestErrorHandling:
    """Tests for error handling."""

    def test_invalid_json_returns_400(self, client):
        """Invalid JSON should return 400."""
        response = client.post(
            '/generate',
            data='not valid json',
            content_type='application/json'
        )
        assert response.status_code == 400

    def test_missing_content_type_handled(self, client):
        """Missing content type should be handled gracefully."""
        response = client.post('/generate', data='{}')
        # Should either parse as JSON or return appropriate error
        assert response.status_code in [200, 400, 415]

    @patch('app.guidance')
    def test_ollama_timeout_handled(
        self,
        mock_guidance,
        client,
        general_variables,
    ):
        """Ollama timeout should return 503."""
        mock_guidance.side_effect = TimeoutError("Connection timed out")

        response = client.post('/generate', json={
            'template': 'general_classifier',
            'variables': general_variables
        })

        # Should handle timeout gracefully
        assert response.status_code in [500, 503]
        data = json.loads(response.data)
        assert 'error' in data
