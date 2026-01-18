"""
Practical Integration Test: BiasEngine + Guidance Templates

This script demonstrates how to use the BiasEngine gRPC service
with your existing guidance templates for constrained generation.

Run this from the paperless-ai root directory:
    python guidance-bias-engine/examples/integration_test.py
"""

import os
import sys
import json
import subprocess
import re

# ============================================================================
# CONFIGURATION
# ============================================================================

BIAS_ENGINE_URL = "localhost:50051"
OLLAMA_URL = "http://localhost:11434"
GUIDANCE_SERVICE_URL = "http://localhost:8002"

# ============================================================================
# PART 1: Direct BiasEngine Test (gRPC)
# ============================================================================

def test_bias_engine_grpcurl():
    """Test the BiasEngine gRPC service using grpcurl."""
    print("\n" + "="*60)
    print("TEST 1: BiasEngine gRPC Direct Test")
    print("="*60)

    print(f"\n📡 Testing BiasEngine at {BIAS_ENGINE_URL}...")

    try:
        # Health check
        print("\n🏥 Health Check:")
        result = subprocess.run(
            ["grpcurl", "-plaintext", BIAS_ENGINE_URL, 
             "guidance.ipc.LogitBiasService/HealthCheck"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            print(f"   ✅ {result.stdout.strip()}")
        else:
            print(f"   ❌ Error: {result.stderr}")
            return False

        # Test: Compute biases for date pattern
        print(
            "\n📅 Computing biases for date pattern "
            "[0-9]{4}-[0-9]{2}-[0-9]{2}:"
        )

        test_cases = [
            ("", "Empty (start)"),
            ("2026", "After year"),
            ("2026-", "After dash"),
            ("2026-01", "After month"),
            ("2026-01-0", "Almost done"),
        ]

        for text, desc in test_cases:
            payload = json.dumps({
                "regex_pattern": "[0-9]{4}-[0-9]{2}-[0-9]{2}",
                "generated_text": text,
                "vocab_size": 50257
            })

            result = subprocess.run(
                [
                    "grpcurl",
                    "-plaintext",
                    "-d",
                    payload,
                    BIAS_ENGINE_URL,
                    "guidance.ipc.LogitBiasService/ComputeBiases",
                ],
                capture_output=True,
                text=True,
                timeout=10,
            )

            if result.returncode == 0:
                response = json.loads(result.stdout)
                num_tokens = len(response.get("tokenBiases", {}))
                time_ms = response.get("computationTimeMs", "?")
                print(
                    f"   '{text}' ({desc}): "
                    f"{num_tokens} valid tokens, {time_ms}ms"
                )
            else:
                print(f"   ❌ Error for '{text}': {result.stderr}")

        # Test: Phone number pattern
        print(
            "\n📱 Computing biases for phone pattern "
            "[0-9]{3}-[0-9]{4}:"
        )

        phone_tests = [
            ("", "Start"),
            ("555", "Area code"),
            ("555-", "After dash"),
            ("555-12", "Partial"),
            ("555-1234", "Complete"),
        ]

        for text, desc in phone_tests:
            payload = json.dumps({
                "regex_pattern": "[0-9]{3}-[0-9]{4}",
                "generated_text": text,
                "vocab_size": 50257
            })

            result = subprocess.run(
                [
                    "grpcurl",
                    "-plaintext",
                    "-d",
                    payload,
                    BIAS_ENGINE_URL,
                    "guidance.ipc.LogitBiasService/ComputeBiases",
                ],
                capture_output=True,
                text=True,
                timeout=10,
            )

            if result.returncode == 0:
                response = json.loads(result.stdout)
                num_tokens = len(response.get("tokenBiases", {}))
                # Show which tokens are valid (first few)
                biases = response.get("tokenBiases", {})
                token_ids = list(biases.keys())[:5]
                print(
                    f"   '{text}' ({desc}): "
                    f"{num_tokens} tokens, first IDs: {token_ids}"
                )
            else:
                print(f"   ❌ Error: {result.stderr}")

        print("\n✅ BiasEngine gRPC test PASSED!")
        return True

    except FileNotFoundError:
        print("❌ grpcurl not found. Install with: choco install grpcurl")
        return False
    except subprocess.TimeoutExpired:
        print("❌ Request timed out")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


# ============================================================================
# PART 2: Test Guidance Service
# ============================================================================

def test_guidance_service():
    """Test the existing Guidance service."""
    print("\n" + "="*60)
    print("TEST 2: Guidance Service Templates")
    print("="*60)

    try:
        import requests
    except ImportError:
        print("❌ requests module not installed")
        return False

    print(f"\n📡 Testing Guidance Service at {GUIDANCE_SERVICE_URL}...")

    # Health check
    try:
        response = requests.get(f"{GUIDANCE_SERVICE_URL}/health", timeout=5)
        if response.status_code == 200:
            health = response.json()
            print(f"   ✅ Status: {health.get('status')}")
            print(f"   📦 Cache: {health.get('cache_enabled')}")
            print(f"   🤖 Model loaded: {health.get('model_loaded', 'N/A')}")
        else:
            print(f"   ❌ Health check failed: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("   ❌ Guidance service not running at localhost:8002")
        return False

    # List available templates
    try:
        response = requests.get(f"{GUIDANCE_SERVICE_URL}/templates", timeout=5)
        if response.status_code == 200:
            data = response.json()
            templates = data.get("templates", [])
            print(f"\n📋 Available Templates ({len(templates)}):")
            for t in templates[:10]:  # Show first 10
                print(f"      • {t}")
            if len(templates) > 10:
                print(f"      ... and {len(templates) - 10} more")
    except Exception as e:
        print(f"   ⚠️ Could not list templates: {e}")

    print("\n✅ Guidance Service test PASSED!")
    return True


# ============================================================================
# PART 3: Test Ollama
# ============================================================================

def test_ollama():
    """Test Ollama connectivity."""
    print("\n" + "="*60)
    print("TEST 3: Ollama LLM Service")
    print("="*60)

    try:
        import requests
    except ImportError:
        print("❌ requests module not installed")
        return False

    print(f"\n📡 Testing Ollama at {OLLAMA_URL}...")

    try:
        # List models
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        if response.status_code == 200:
            models = response.json().get("models", [])
            print(f"   ✅ Connected! {len(models)} models available:")
            for m in models[:5]:
                name = m.get("name", "unknown")
                size = m.get("size", 0) / 1e9
                print(f"      • {name} ({size:.1f}GB)")
            if len(models) > 5:
                print(f"      ... and {len(models) - 5} more")

            print("\n✅ Ollama test PASSED!")
            return True
        else:
            print(f"   ❌ Error: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("   ❌ Ollama not running at localhost:11434")
        return False


# ============================================================================
# PART 4: Metrics Check
# ============================================================================

def test_metrics():
    """Test Prometheus metrics endpoint."""
    print("\n" + "="*60)
    print("TEST 4: BiasEngine Metrics")
    print("="*60)

    try:
        import requests
    except ImportError:
        print("❌ requests module not installed")
        return False

    metrics_url = "http://localhost:8003"
    print(f"\n📊 Checking metrics at {metrics_url}...")

    try:
        response = requests.get(metrics_url, timeout=5)
        if response.status_code == 200:
            text = response.text

            # Parse key metrics
            lines = text.split('\n')
            for line in lines:
                if line.startswith('bias_requests_total'):
                    print(f"   📈 {line}")
                elif line.startswith('bias_computation_seconds_count'):
                    print(f"   ⏱️  {line}")
                elif 'process_resident_memory' in line \
                        and not line.startswith('#'):
                    mem_mb = float(line.split()[-1]) / 1e6
                    print(f"   💾 Memory: {mem_mb:.1f} MB")

            print("\n✅ Metrics test PASSED!")
            return True
        else:
            print(f"   ❌ Error: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("   ❌ Metrics endpoint not available at localhost:8003")
        return False


# ============================================================================
# PART 5: Show Architecture
# ============================================================================

def show_architecture():
    """Display the integration architecture."""
    print("\n" + "="*60)
    print("INTEGRATION ARCHITECTURE")
    print("="*60)

    print("""
    ┌─────────────────────────────────────────────────────────────┐
    │                    paperless-ai                             │
    │              ExpertPipelineExecutor                         │
    └─────────────────────┬───────────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
    ┌───────────────────┐      ┌───────────────────┐
    │  guidance-service │      │   BiasEngine      │
    │  :8002 (HTTP)     │      │   :50051 (gRPC)   │
    │                   │      │                   │
    │  Templates:       │      │  Regex FSM:       │
    │  • general_class  │      │  • [0-9]{3}-...   │
    │  • medical_class  │      │  • Token biases   │
    │  • invoice_parser │      │  • LRU Cache      │
    └─────────┬─────────┘      └─────────┬─────────┘
              │                          │
              └──────────┬───────────────┘
                         ▼
              ┌───────────────────┐
              │      Ollama       │
              │   :11434 (HTTP)   │
              │                   │
              │  Models:          │
              │  • llama3.2       │
              │  • sauerkraut     │
              └───────────────────┘

    WHEN TO USE EACH:

    ┌────────────────────────────────────────────────────────────┐
    │ guidance-service          │ BiasEngine                     │
    │ (Guidance + JSON Schema)  │ (Regex FSM + Logit Bias)       │
    ├───────────────────────────┼────────────────────────────────┤
    │ Complex JSON structures   │ Strict string formats          │
    │ Natural language fields   │ Phone: [0-9]{3}-[0-9]{4}       │
    │ Classification tasks      │ Dates: YYYY-MM-DD              │
    │ Multi-field extraction    │ Codes: [A-Z]{2}[0-9]{4}        │
    │ German document types     │ IBANs, VAT numbers, etc.       │
    └───────────────────────────┴────────────────────────────────┘
    """)


# ============================================================================
# PART 6: Practical Usage Example
# ============================================================================

def show_usage_example():
    """Show practical code examples."""
    print("\n" + "="*60)
    print("PRACTICAL USAGE EXAMPLES")
    print("="*60)

    print("""
    EXAMPLE 1: Python gRPC Client
    ─────────────────────────────

    ```python
    import grpc
    from guidance.ipc.proto import bias_service_pb2, bias_service_pb2_grpc

    # Connect
    channel = grpc.insecure_channel('localhost:50051')
    stub = bias_service_pb2_grpc.LogitBiasServiceStub(channel)

    # Get biases for phone pattern
    response = stub.ComputeBiases(bias_service_pb2.BiasRequest(
        regex_pattern=r"[0-9]{3}-[0-9]{4}",
        generated_text="555-",
        vocab_size=50257
    ))

    print(f"Valid tokens: {len(response.token_biases)}")
    ```


    EXAMPLE 2: grpcurl (Command Line)
    ─────────────────────────────────

    ```bash
    # Health check
    grpcurl -plaintext localhost:50051 \\
        guidance.ipc.LogitBiasService/HealthCheck

    # Compute biases
    grpcurl -plaintext -d '{
        "regex_pattern": "[0-9]{4}-[0-9]{2}-[0-9]{2}",
        "generated_text": "2026-",
        "vocab_size": 50257
    }' localhost:50051 guidance.ipc.LogitBiasService/ComputeBiases
    ```


    EXAMPLE 3: Integration with Guidance Template
    ─────────────────────────────────────────────

    ```python
    # In guidance_service/templates/invoice_strict.py

    @guidance
    def extract_invoice(lm, text: str):
        # Free-text field: use gen()
        lm += "Vendor: " + gen(name="vendor", max_tokens=50)

        # Strict date: use BiasEngine
        date = bias_engine_generate(
            pattern=r"[0-9]{4}-[0-9]{2}-[0-9]{2}",
            max_tokens=10
        )
        lm += f"Date: {date}"

        # Amount: use gen with regex
        lm += "Amount: €" + gen(name="amount", regex=r"[0-9]+\\.[0-9]{2}")

        return lm
    ```
    """)


# ============================================================================
# MAIN
# ============================================================================

def main():
    print("""
╔══════════════════════════════════════════════════════════════════╗
║         BiasEngine Integration Test Suite                        ║
╠══════════════════════════════════════════════════════════════════╣
║  Testing integration between:                                    ║
║  • BiasEngine gRPC    (localhost:50051)                          ║
║  • Guidance Service   (localhost:8002)                           ║
║  • Ollama LLM         (localhost:11434)                          ║
║  • Prometheus Metrics (localhost:8003)                           ║
╚══════════════════════════════════════════════════════════════════╝
    """)

    results = {}

    # Run tests
    results['BiasEngine gRPC'] = test_bias_engine_grpcurl()
    results['Guidance Service'] = test_guidance_service()
    results['Ollama'] = test_ollama()
    results['Metrics'] = test_metrics()

    # Show architecture and examples
    show_architecture()
    show_usage_example()

    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)

    all_passed = True
    for test, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        if not passed:
            all_passed = False
        print(f"   {test}: {status}")

    print("\n" + "-"*60)
    if all_passed:
        print("🎉 All tests passed! BiasEngine is ready for integration.")
    else:
        print("⚠️  Some tests failed. Check the services above.")

    print("""

QUICK REFERENCE:
────────────────
• BiasEngine gRPC:  localhost:50051
• BiasEngine Metrics: http://localhost:8003
• Guidance Service: http://localhost:8002
• Prometheus:       http://localhost:9091
• Grafana:          http://localhost:3001 (admin/admin)
• Ollama:           http://localhost:11434
    """)

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
