import os
import time
from pathlib import Path
from statistics import mean

import requests


def _load_env_file(env_path):
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if (
            len(value) >= 2
            and value[0] == value[-1]
            and value[0] in ("'", '"')
        ):
            value = value[1:-1]
        if key and key not in os.environ:
            os.environ[key] = value


MEDICAL_TEXT = (
    "Patient Max Mustermann, geb. 01.01.1980. Diagnose: "
    "Diabetes mellitus Typ 2 (E11.9). Medikation: Metformin 500mg 1-0-1."
)
FINANCIAL_TEXT = (
    "Rechnung Nr. 123. Rechnungssteller: Beispiel GmbH, UID ATU12345678. "
    "Netto 100, Steuer 20, Brutto 120."
)
LEGAL_TEXT = (
    "Arbeitsvertrag zwischen Beispiel GmbH und Max Mustermann. "
    "Gueltig ab 01.01.2024. Kuendigung mit 3 Monaten."
)
GENERAL_TEXT = (
    "Allgemeines Schreiben mit Informationen zu einem Termin und Kontaktdaten."
)


def _resolve_model_names():
    repo_root = Path(__file__).resolve().parents[1]
    _load_env_file(repo_root / "data" / ".env")

    router_model = (
        os.getenv("ROUTER_MODEL")
        or os.getenv("OLLAMA_ROUTER_MODEL")
        or os.getenv("PLANNER_MODEL")
        or os.getenv("OLLAMA_PLANNER_MODEL")
        or os.getenv("OLLAMA_VISION_MODEL")
        or "qwen3-vl:8b"
    )
    orchestrator_model = os.getenv(
        "ORCHESTRATOR_MODEL",
        "nemotron-orchestrator:8b",
    )
    medical_imaging = os.getenv("MEDICAL_VISION_MODEL", "llava-med-v1.6")
    medical_text = os.getenv("MEDICAL_ANALYSIS_MODEL", "medtext-llama3")
    finance_general = os.getenv("FINANCIAL_VISION_MODEL", "llm-pro-finance-8b")
    finance_reasoning = os.getenv("FINANCIAL_ANALYSIS_MODEL", "fino1-8b")
    vat_expert = (
        os.getenv("VAT_EXPERT_MODEL")
        or os.getenv("FINANCIAL_VAT_EXPERT")
        or os.getenv("FINANCIAL_VISION_MODEL")
        or "llm-pro-finance-8b"
    )
    legal_expert = (
        os.getenv("LEGAL_EXPERT_MODEL")
        or os.getenv("LEGAL_ANALYSIS_MODEL")
        or "llm-pro-finance-8b"
    )
    general_model = (
        os.getenv("GENERAL_MODEL")
        or os.getenv("OLLAMA_MODEL")
        or "sauerkraut-llama3.1:8b"
    )

    return {
        "router": router_model,
        "orchestrator": orchestrator_model,
        "medicalImaging": medical_imaging,
        "medicalText": medical_text,
        "financeGeneral": finance_general,
        "financeReasoning": finance_reasoning,
        "vatExpert": vat_expert,
        "legalExpert": legal_expert,
        "general": general_model,
    }


def _build_template_cases(model_names):
    orchestrator_model = model_names["orchestrator"] or model_names["router"]
    return [
        {
            "template": "medical_classifier",
            "label": "medical_visual",
            "model": model_names["medicalImaging"],
            "variables": {"text_chunk": MEDICAL_TEXT},
        },
        {
            "template": "medical_extractor",
            "label": "medical_text",
            "model": model_names["medicalText"],
            "variables": {"medical_text": MEDICAL_TEXT},
        },
        {
            "template": "medical_integrator",
            "label": "medical_integration",
            "model": model_names["medicalText"],
            "variables": {
                "imaging_analysis": "Radiology report: no acute findings.",
                "text_extraction": "Diagnose: Diabetes mellitus Typ 2.",
                "prior_context": "Patient history: stable on Metformin.",
            },
        },
        {
            "template": "financial_extractor",
            "label": "financial_visual",
            "model": model_names["router"],
            "variables": {"text_chunk": FINANCIAL_TEXT},
        },
        {
            "template": "financial_extractor",
            "label": "financial_extraction",
            "model": model_names["financeGeneral"],
            "variables": {"text_chunk": FINANCIAL_TEXT},
        },
        {
            "template": "financial_reasoner",
            "label": "financial_reasoning",
            "model": model_names["financeReasoning"],
            "variables": {
                "netto": "100.00",
                "steuerbetrag": "20.00",
                "brutto": "120.00",
            },
        },
        {
            "template": "vat_expert_analyzer",
            "label": "financial_vat_analysis",
            "model": model_names["vatExpert"],
            "variables": {
                "total": "120.00",
                "tax_rate": "20",
                "from_party": "Beispiel GmbH",
                "text_chunk": FINANCIAL_TEXT,
            },
        },
        {
            "template": "legal_classifier",
            "label": "legal_orchestrator",
            "model": orchestrator_model,
            "variables": {"text_chunk": LEGAL_TEXT},
        },
        {
            "template": "legal_extractor",
            "label": "legal_extraction",
            "model": model_names["legalExpert"],
            "variables": {
                "text_chunk": LEGAL_TEXT,
                "legal_context": "ABGB/BGB Kontext fuer Arbeitsvertraege.",
            },
        },
        {
            "template": "legal_validator",
            "label": "legal_validation",
            "model": model_names["general"],
            "variables": {"text_chunk": LEGAL_TEXT},
        },
        {
            "template": "general_extractor",
            "label": "general_extraction",
            "model": model_names["general"],
            "variables": {"text_chunk": GENERAL_TEXT},
        },
        {
            "template": "cross_pipeline_router",
            "label": "cross_pipeline_router",
            "model": model_names["general"],
            "variables": {
                "doc_type": "Korrespondenz",
                "summary": "Brief ueber einen Termin und eine Rechnung.",
                "themes": ["Termin", "Rechnung"],
                "has_financial": "ja",
                "has_medical": "nein",
                "has_legal": "nein",
            },
        },
    ]


class ModelComparator:
    """
    Benchmarks Guidance templates with the pipeline's configured models.
    """
    def __init__(self, endpoint="http://localhost:8002/generate"):
        self.endpoint = endpoint
        self.base_url = endpoint.rsplit("/", 1)[0]
        self.model_names = _resolve_model_names()
        self.cases = _build_template_cases(self.model_names)

    def run_benchmarks(self, iterations=3):
        available_templates = self._list_templates()
        results = []

        for case in self.cases:
            template = case["template"]
            label = case["label"]
            if (
                available_templates is not None
                and template not in available_templates
            ):
                print(
                    f"Skipping {template} ({label}): not registered in "
                    "guidance service."
                )
                results.append({
                    "template": template,
                    "label": label,
                    "model": case["model"],
                    "status": "missing_template",
                    "avg_latency": None,
                    "validity_rate": None,
                })
                continue

            results.append(self._run_case(case, iterations))

        self._print_summary(results)

    def _list_templates(self):
        try:
            response = requests.get(f"{self.base_url}/templates", timeout=10)
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            print(f"Warning: could not list templates ({exc}).")
            return None

        templates = data.get("templates", [])
        return set(templates)

    def _run_case(self, case, iterations):
        template = case["template"]
        label = case["label"]
        model = case["model"]

        print(f"\nTemplate: {template} ({label})")
        print(f"Model: {model}")
        latencies = []
        valid_count = 0
        print("Running...", end="", flush=True)

        for _ in range(iterations):
            start_time = time.time()
            try:
                response = requests.post(
                    self.endpoint,
                    json={
                        "template": template,
                        "model": model,
                        "variables": case["variables"],
                        "temperature": 0.1,
                    },
                    timeout=90,
                )
                data = response.json()
                if (
                    response.status_code == 200
                    and data.get("status") == "success"
                ):
                    latencies.append(time.time() - start_time)
                    if data.get("validation", {}).get("valid"):
                        valid_count += 1
            except Exception:
                print("X", end="")

        if latencies:
            avg_latency = mean(latencies)
            validity_rate = (valid_count / iterations) * 100
            print(f" Done. (Avg: {avg_latency:.2f}s)")
            status = "ok"
        else:
            avg_latency = None
            validity_rate = None
            print(" Failed.")
            status = "failed"

        return {
            "template": template,
            "label": label,
            "model": model,
            "status": status,
            "avg_latency": avg_latency,
            "validity_rate": validity_rate,
        }

    def _print_summary(self, results):
        print("\n" + "=" * 72)
        header = (
            f"{'TEMPLATE':22} | {'STAGE':18} | {'MODEL':18} | {'STATUS':7} | "
            f"{'LAT':6} | {'VALID'}"
        )
        print(header)
        print("-" * 72)
        for result in results:
            model = (result["model"] or "unknown")[:18]
            latency = (
                f"{result['avg_latency']:.2f}s"
                if result["avg_latency"] is not None
                else "n/a"
            )
            validity = (
                f"{result['validity_rate']:.1f}%"
                if result["validity_rate"] is not None
                else "n/a"
            )
            print(
                f"{result['template'][:22]:22} | "
                f"{result['label'][:18]:18} | "
                f"{model:18} | "
                f"{result['status'][:7]:7} | "
                f"{latency:6} | {validity}"
            )
        print("=" * 72)


if __name__ == "__main__":
    comparator = ModelComparator()
    comparator.run_benchmarks()
