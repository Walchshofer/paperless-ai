"""
Prometheus Metrics for Guidance Service

Provides metrics for:
- Request throughput and status
- Latency histograms by template
- Cache hit/miss rates
- Validation success rates
- Active request gauges

Usage:
    from metrics.guidance_metrics import (
        track_request, track_cache_operation, track_validation,
        get_metrics_endpoint
    )

    # In request handler:
    with track_request('medical_extractor') as tracker:
        result = process_template(...)
        tracker.set_status('success')
"""
import time
from functools import wraps
from contextlib import contextmanager
from prometheus_client import (
    Counter, Histogram, Gauge, Summary,
    generate_latest, CONTENT_TYPE_LATEST,
    REGISTRY, CollectorRegistry
)


# ============================================================================
# METRIC DEFINITIONS
# ============================================================================

# Request metrics
guidance_requests_total = Counter(
    'guidance_requests_total',
    'Total number of guidance generation requests',
    ['template', 'model', 'status']
)

guidance_request_latency_seconds = Histogram(
    'guidance_request_latency_seconds',
    'Request latency in seconds',
    ['template'],
    buckets=(0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0)
)

guidance_active_requests = Gauge(
    'guidance_active_requests',
    'Number of currently active requests',
    ['template']
)

# Cache metrics
guidance_cache_ops_total = Counter(
    'guidance_cache_ops_total',
    'Total cache operations',
    ['operation', 'status']
)

guidance_cache_size_bytes = Gauge(
    'guidance_cache_size_bytes',
    'Current cache size in bytes'
)

# Validation metrics
guidance_validation_total = Counter(
    'guidance_validation_total',
    'Total validation attempts',
    ['template', 'valid']
)

guidance_validation_errors = Counter(
    'guidance_validation_errors_total',
    'Total validation errors by type',
    ['template', 'error_type']
)

# Model metrics
guidance_model_calls_total = Counter(
    'guidance_model_calls_total',
    'Total calls to LLM models',
    ['model']
)

guidance_model_latency_seconds = Histogram(
    'guidance_model_latency_seconds',
    'LLM model call latency in seconds',
    ['model'],
    buckets=(0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0)
)

# Token metrics
guidance_tokens_processed = Counter(
    'guidance_tokens_processed_total',
    'Total tokens processed',
    ['template', 'direction']  # direction: input or output
)


# ============================================================================
# TRACKING HELPERS
# ============================================================================

class RequestTracker:
    """Context manager for tracking request metrics."""

    def __init__(self, template: str, model: str = 'unknown'):
        self.template = template
        self.model = model
        self.status = 'error'  # Default to error
        self.start_time = None

    def set_status(self, status: str):
        """Set the final status of the request."""
        self.status = status

    def __enter__(self):
        self.start_time = time.time()
        guidance_active_requests.labels(template=self.template).inc()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = time.time() - self.start_time

        # Record metrics
        guidance_request_latency_seconds.labels(
            template=self.template
        ).observe(duration)

        guidance_requests_total.labels(
            template=self.template,
            model=self.model,
            status=self.status
        ).inc()

        guidance_active_requests.labels(template=self.template).dec()

        # Don't suppress exceptions
        return False


@contextmanager
def track_request(template: str, model: str = 'unknown'):
    """
    Context manager to track request metrics.

    Usage:
        with track_request('medical_extractor', 'llama3') as tracker:
            result = process(...)
            tracker.set_status('success' if result else 'error')
    """
    tracker = RequestTracker(template, model)
    with tracker:
        yield tracker


def track_cache_operation(operation: str, hit: bool):
    """
    Track a cache operation.

    Args:
        operation: 'get' or 'set'
        hit: True for cache hit, False for miss
    """
    status = 'hit' if hit else 'miss'
    guidance_cache_ops_total.labels(operation=operation, status=status).inc()


def track_validation(template: str, valid: bool, errors: list = None):
    """
    Track a validation result.

    Args:
        template: Template name
        valid: Whether validation passed
        errors: List of error messages (optional)
    """
    guidance_validation_total.labels(
        template=template,
        valid=str(valid).lower()
    ).inc()

    if errors:
        for error in errors:
            # Extract error type from message
            error_type = _classify_error(error)
            guidance_validation_errors.labels(
                template=template,
                error_type=error_type
            ).inc()


def track_model_call(model: str, duration_seconds: float):
    """
    Track an LLM model call.

    Args:
        model: Model name
        duration_seconds: Call duration
    """
    guidance_model_calls_total.labels(model=model).inc()
    guidance_model_latency_seconds.labels(model=model).observe(duration_seconds)


def track_tokens(template: str, input_tokens: int, output_tokens: int):
    """
    Track token usage.

    Args:
        template: Template name
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens
    """
    guidance_tokens_processed.labels(
        template=template,
        direction='input'
    ).inc(input_tokens)

    guidance_tokens_processed.labels(
        template=template,
        direction='output'
    ).inc(output_tokens)


def update_cache_size(size_bytes: int):
    """Update the cache size gauge."""
    guidance_cache_size_bytes.set(size_bytes)


# ============================================================================
# DECORATORS
# ============================================================================

def metrics_tracked(template: str = None, model: str = None):
    """
    Decorator to automatically track function metrics.

    Usage:
        @metrics_tracked(template='medical_extractor')
        def process_medical(document):
            ...
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            tpl = template or func.__name__
            mdl = model or kwargs.get('model', 'unknown')

            with track_request(tpl, mdl) as tracker:
                try:
                    result = func(*args, **kwargs)
                    tracker.set_status('success')
                    return result
                except Exception as e:
                    tracker.set_status('error')
                    raise

        return wrapper
    return decorator


# ============================================================================
# FLASK INTEGRATION
# ============================================================================

def get_metrics_response():
    """
    Generate Prometheus metrics response for Flask.

    Usage:
        @app.route('/metrics')
        def metrics():
            return get_metrics_response()
    """
    from flask import Response
    return Response(
        generate_latest(REGISTRY),
        mimetype=CONTENT_TYPE_LATEST
    )


def init_metrics_endpoint(app):
    """
    Initialize the /metrics endpoint on a Flask app.

    Args:
        app: Flask application instance
    """
    @app.route('/metrics')
    def metrics():
        return get_metrics_response()


# ============================================================================
# HELPERS
# ============================================================================

def _classify_error(error_message: str) -> str:
    """Classify an error message into a category."""
    error_lower = error_message.lower()

    if 'icd' in error_lower or 'code' in error_lower:
        return 'icd10_format'
    elif 'atu' in error_lower or 'uid' in error_lower:
        return 'atu_format'
    elif 'date' in error_lower or 'datum' in error_lower:
        return 'date_format'
    elif 'confidence' in error_lower or 'vertrauen' in error_lower:
        return 'confidence_range'
    elif 'missing' in error_lower or 'required' in error_lower:
        return 'missing_field'
    elif 'type' in error_lower:
        return 'type_mismatch'
    else:
        return 'other'


def reset_metrics():
    """Reset all metrics (useful for testing)."""
    # Note: This is a simplified reset - in production you might
    # need a more sophisticated approach
    pass


# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    # Metric objects
    'guidance_requests_total',
    'guidance_request_latency_seconds',
    'guidance_active_requests',
    'guidance_cache_ops_total',
    'guidance_cache_size_bytes',
    'guidance_validation_total',
    'guidance_validation_errors',
    'guidance_model_calls_total',
    'guidance_model_latency_seconds',
    'guidance_tokens_processed',

    # Tracking functions
    'track_request',
    'track_cache_operation',
    'track_validation',
    'track_model_call',
    'track_tokens',
    'update_cache_size',

    # Decorators
    'metrics_tracked',

    # Flask integration
    'get_metrics_response',
    'init_metrics_endpoint',
]
