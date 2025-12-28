Analysis & Evaluation Tools

This directory contains Python-based utility scripts for monitoring the performance and accuracy of the paperless-ai extraction pipelines. These tools close the feedback loop between user corrections and model optimization.

Directory Structure

accuracy_tracking.py: Aggregates user feedback to compute real-world accuracy scores.

model_comparison.py: Benchmarks different LLMs against Guidance templates to measure latency and validity.

1. Accuracy Tracking (accuracy_tracking.py)

This script analyzes the ground-truth data collected via the FeedbackForm and stored by the FeedbackService. It identifies which document fields (e.g., IBAN, ICD-10, Dates) are most prone to errors.

Prerequisites

Feedback data must exist in ../data/feedback/ (JSON format).

Usage

python accuracy_tracking.py


Metrics Produced

Overall Accuracy: Percentage of fields correctly extracted across all reviewed documents.

Pipeline Breakdown: Comparison of accuracy between Medical, Financial, and Legal pipelines.

Correction Frequency: A "Top 5" list of fields that users corrected most often, highlighting where the prompt templates need refinement.

2. Model Comparison (model_comparison.py)

Use this tool to evaluate different Ollama models (e.g., sauerkraut-llama3.1, mistral, llama3.1) against your specific German/Austrian Guidance templates.

Prerequisites

The Guidance Service must be running (usually on port 8002).

The models being tested must be pulled in Ollama.

Usage

python model_comparison.py


Benchmarks

Average Latency: Time in seconds to complete a structured extraction.

Validity Rate: Percentage of requests where the model successfully adhered to the JSON schema enforced by the Guidance framework.

Setup & Requirements

These scripts are intended to be run in a local Python environment.

Install Dependencies:

pip install requests


Configuration:

Ensure the feedback_dir in accuracy_tracking.py correctly points to your project's data storage.

Ensure the endpoint in model_comparison.py matches your guidance-service URL.

Integration with Phase 5

These tools support the Optimization & Monitoring phase of the roadmap. By regularly running these analyses, you can make data-driven decisions on when to switch models or update prompt instructions in the guidance_service/templates/ directory.