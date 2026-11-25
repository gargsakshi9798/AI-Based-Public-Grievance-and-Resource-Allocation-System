"""CLI classifier used by the Node backend. Reads JSON from stdin."""
import json
import sys
from pathlib import Path

from joblib import load

MODEL = Path(__file__).resolve().parent / "models" / "complaint_nb.joblib"

CRITICAL = ["manhole", "danger", "dangerous", "fire", "emergency", "collapse"]
HIGH = ["no water", "leakage", "three days", "four days", "five days", "outage", "overflow"]
LOW = ["minor", "small", "slight"]


def priority_from_text(text: str) -> str:
    blob = text.lower()
    if any(t in blob for t in CRITICAL):
        return "critical"
    if any(t in blob for t in HIGH):
        return "high"
    if any(t in blob for t in LOW):
        return "low"
    return "medium"


def classify(title: str, description: str) -> dict:
    combined = f"{title} {description}".strip()
    if not MODEL.exists():
        return {
            "category": "other",
            "priority": priority_from_text(combined),
            "confidenceScore": 0.0,
            "summary": "Sklearn model not trained. Run: python train.py",
            "method": "untrained",
        }
    pipeline = load(MODEL)
    category = pipeline.predict([combined])[0]
    proba = pipeline.predict_proba([combined])[0]
    confidence = float(max(proba))
    return {
        "category": category,
        "priority": priority_from_text(combined),
        "confidenceScore": round(confidence, 2),
        "summary": f"Sklearn Naive Bayes classified this as {category.replace('_', ' ')}.",
        "method": "sklearn_nb",
    }


if __name__ == "__main__":
    payload = json.load(sys.stdin)
    result = classify(payload.get("title", ""), payload.get("description", ""))
    json.dump(result, sys.stdout)
