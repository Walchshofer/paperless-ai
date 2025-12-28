import requests
import time
import json
from statistics import mean

class ModelComparator:
    """
    Benchmarks different models against the same Guidance templates
    to measure latency, JSON validity, and extraction consistency.
    """
    def __init__(self, endpoint="http://localhost:8002/generate"):
        self.endpoint = endpoint
        # The models we want to compare (Sauerkraut is our baseline)
        self.models = [
            "sauerkraut-llama3.1:8b",
            "llama3.1:8b",
            "mistral:latest"
        ]

    def run_benchmark(self, template, variables, iterations=3):
        """Run a comparison for a specific template."""
        results = {}

        print(f"\nBenchmarking Template: {template}")
        print("-" * 40)

        for model in self.models:
            print(f"Testing Model: {model}...", end="", flush=True)
            latencies = []
            valid_count = 0
            
            for _ in range(iterations):
                start_time = time.time()
                try:
                    response = requests.post(
                        self.endpoint,
                        json={
                            "template": template,
                            "model": model,
                            "variables": variables,
                            "temperature": 0.1 # Keep it deterministic
                        },
                        timeout=90
                    )
                    data = response.json()
                    
                    if response.status_code == 200 and data.get("status") == "success":
                        latencies.append(time.time() - start_time)
                        if data.get("validation", {}).get("valid"):
                            valid_count += 1
                except Exception as e:
                    print(f"X", end="")
            
            if latencies:
                results[model] = {
                    "avg_latency": mean(latencies),
                    "validity_rate": (valid_count / iterations) * 100
                }
                print(f" Done. (Avg: {results[model]['avg_latency']:.2f}s)")
            else:
                print(" Failed.")

        self._print_comparison(results)

    def _print_comparison(self, results):
        print("\n" + "="*50)
        print(f"{'MODEL':25} | {'LATENCY':10} | {'VALIDITY'}")
        print("-" * 50)
        for model, stats in results.items():
            print(f"{model:25} | {stats['avg_latency']:8.2f}s | {stats['validity_rate']:.1f}%")
        print("="*50)

if __name__ == "__main__":
    comparator = ModelComparator()
    
    # Example Medical Test Data
    medical_test_vars = {
        "medical_text": "Patient Max Mustermann, geb. 01.01.1980. Diagnose: Diabetes mellitus Typ 2 (E11.9). Medikation: Metformin 500mg 1-0-1."
    }
    
    comparator.run_benchmark("medical_extractor", medical_test_vars)