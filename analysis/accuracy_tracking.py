import json
import os
from pathlib import Path
from datetime import datetime
from collections import Counter, defaultdict

class AccuracyTracker:
    """
    Analyzes user feedback JSON files to calculate accuracy metrics
    and identify common extraction failures.
    """
    def __init__(self, feedback_dir="./data/feedback"):
        self.feedback_path = Path(feedback_dir)
        self.results = []

    def load_feedback(self):
        """Load all feedback files from the target directory."""
        if not self.feedback_path.exists():
            print(f"Warning: Feedback directory {self.feedback_path} not found.")
            return

        for feedback_file in self.feedback_path.glob("*.json"):
            try:
                with open(feedback_file, 'r', encoding='utf-8') as f:
                    self.results.append(json.load(f))
            except Exception as e:
                print(f"Error loading {feedback_file.name}: {e}")

    def calculate_metrics(self):
        """Compute aggregate metrics across all pipelines."""
        if not self.results:
            print("No feedback data available to analyze.")
            return

        total_docs = len(self.results)
        avg_rating = sum(r['rating'] for r in self.results) / total_docs
        avg_accuracy = sum(r['accuracyScore'] for r in self.results) / total_docs

        # Breakdown by pipeline
        pipeline_stats = defaultdict(lambda: {"total": 0, "acc_sum": 0, "rating_sum": 0})
        corrections_counter = Counter()

        for r in self.results:
            pid = r.get('pipelineId', 'unknown')
            pipeline_stats[pid]["total"] += 1
            pipeline_stats[pid]["acc_sum"] += r.get('accuracyScore', 0)
            pipeline_stats[pid]["rating_sum"] += r.get('rating', 0)
            
            for field in r.get('corrections', []):
                corrections_counter[field] += 1

        self._print_report(total_docs, avg_rating, avg_accuracy, pipeline_stats, corrections_counter)

    def _print_report(self, total, rating, acc, p_stats, corrections):
        print("="*60)
        print(f"PAPERLESS-AI ACCURACY REPORT - {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        print("="*60)
        print(f"Total Documents Reviewed: {total}")
        print(f"Overall User Rating:     {rating:.2f} / 5.0")
        print(f"Overall AI Accuracy:     {acc * 100:.2f}%")
        print("-" * 60)
        
        print("PIPELINE PERFORMANCE:")
        for pid, stats in p_stats.items():
            p_acc = (stats["acc_sum"] / stats["total"]) * 100
            p_rat = stats["rating_sum"] / stats["total"]
            print(f" -> {pid:25} | Accuracy: {p_acc:6.2f}% | Rating: {p_rat:.2f}")

        print("-" * 60)
        print("TOP 5 FIELDS REQUIRING CORRECTION:")
        for field, count in corrections.most_common(5):
            print(f" -> {field:25} | Corrections: {count}")
        print("="*60)

if __name__ == "__main__":
    # Ensure we are looking in the right place relative to the project root
    tracker = AccuracyTracker(feedback_dir="../data/feedback")
    tracker.load_feedback()
    tracker.calculate_metrics()
    