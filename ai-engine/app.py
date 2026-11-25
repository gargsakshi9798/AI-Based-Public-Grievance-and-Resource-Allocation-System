"""Flask AI microservice (report §11 / §20.3). Default port 5001."""
from flask import Flask, jsonify, request

from predict import classify

app = Flask(__name__)


@app.get("/health")
def health():
    return jsonify({"success": True, "service": "pgs-ai-engine"})


@app.post("/classify")
def classify_route():
    body = request.get_json(force=True) or {}
    result = classify(body.get("title", ""), body.get("description", ""))
    return jsonify({"success": True, "data": result})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
