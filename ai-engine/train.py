"""Train TF-IDF + Multinomial Naive Bayes (report §16.4 / §20.5)."""
import csv
from pathlib import Path

from joblib import dump
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "complaints.csv"
MODEL = ROOT / "models" / "complaint_nb.joblib"


def load_rows():
    texts, labels = [], []
    with DATA.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            texts.append(row["text"])
            labels.append(row["category"])
    return texts, labels


def main():
    texts, labels = load_rows()
    x_train, x_test, y_train, y_test = train_test_split(
        texts, labels, test_size=0.25, random_state=42
    )
    pipeline = Pipeline(
        [
            ("tfidf", TfidfVectorizer(stop_words="english", ngram_range=(1, 2))),
            ("clf", MultinomialNB()),
        ]
    )
    pipeline.fit(x_train, y_train)
    pred = pipeline.predict(x_test)
    acc = accuracy_score(y_test, pred)
    MODEL.parent.mkdir(parents=True, exist_ok=True)
    dump(pipeline, MODEL)
    print(f"Saved {MODEL}  test_accuracy={acc:.2f}")


if __name__ == "__main__":
    main()
