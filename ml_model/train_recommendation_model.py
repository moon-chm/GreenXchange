"""
Trains the plant-recommendation classifier used by
backend/app/services/recommendation/ml_model.py.

Fixes the previous train/serve mismatch: the old plant_model.pkl was trained
with per-column LabelEncoder (in-place integer codes, e.g. SpaceType -> 0/1/2)
but the backend served it with pd.get_dummies() one-hot encoding — a
completely different feature space. Every categorical input (SpaceType,
MaintenanceLevel, SoilType, ...) was silently zeroed out at inference and
replaced by whichever category happened to be label-code 0, regardless of
what the user actually selected.

This script trains a single scikit-learn Pipeline that bundles preprocessing
(OneHotEncoder for categoricals, passthrough for numerics) together with the
classifier, so the exact same transform always runs at both train and serve
time — the class of bug above becomes structurally impossible. The pipeline
also uses handle_unknown="ignore" so a category never seen in training (or a
future new value) degrades gracefully instead of crashing.

Usage:
    python train_recommendation_model.py
Outputs (next to this script):
    plant_recommendation_pipeline.joblib
    plant_label_encoder.pkl
"""

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, OneHotEncoder, StandardScaler
from sklearn.svm import SVC

DATASET_PATH = "greenxchange_dataset_20000.csv"
TARGET_COL = "RecommendedPlant"

CATEGORICAL_COLS = [
    "AreaType", "TrafficDensity", "Sunlight", "SoilType", "Drainage",
    "SpaceType", "AreaSize", "MaintenanceLevel", "WateringPreference", "Purpose",
]
NUMERIC_COLS = [
    "AQI", "PM2.5", "PM10", "NO2", "SO2", "CO", "O3", "RoadDistance",
    "DustIndex", "Temperature", "Humidity", "Rainfall", "WindSpeed", "SoilPH",
]


def build_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_COLS),
            ("num", StandardScaler(), NUMERIC_COLS),
        ]
    )


def main():
    df = pd.read_csv(DATASET_PATH)
    assert not df.isnull().any().any(), "Dataset has nulls — clean before training."

    X = df[CATEGORICAL_COLS + NUMERIC_COLS]
    y_raw = df[TARGET_COL]

    label_encoder = LabelEncoder()
    y = label_encoder.fit_transform(y_raw)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    candidates = {
        "LogisticRegression": LogisticRegression(max_iter=2000),
        "RandomForest": RandomForestClassifier(
            n_estimators=300, max_depth=None, random_state=42, n_jobs=-1
        ),
        "KNN": KNeighborsClassifier(n_neighbors=15),
        "SVM (RBF, calibrated)": SVC(probability=True, random_state=42),
    }

    print(f"Dataset: {len(df)} rows, {len(label_encoder.classes_)} plant classes")
    print(f"{'Model':<25} {'Accuracy':>10} {'Macro-F1':>10}")
    print("-" * 47)

    best_name, best_pipeline, best_score = None, None, -1.0
    for name, clf in candidates.items():
        pipeline = Pipeline([("preprocess", build_preprocessor()), ("clf", clf)])
        pipeline.fit(X_train, y_train)
        y_pred = pipeline.predict(X_test)
        acc = accuracy_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred, average="macro")
        print(f"{name:<25} {acc:>10.4f} {f1:>10.4f}")

        if f1 > best_score:
            best_name, best_pipeline, best_score = name, pipeline, f1

    print(f"\nBest model: {best_name} (macro-F1={best_score:.4f})")

    # Refit the winning pipeline on the full dataset for production use.
    final_pipeline = Pipeline([
        ("preprocess", build_preprocessor()),
        ("clf", type(best_pipeline.named_steps["clf"])(**best_pipeline.named_steps["clf"].get_params())),
    ])
    final_pipeline.fit(X, y)

    joblib.dump(final_pipeline, "plant_recommendation_pipeline.joblib")
    joblib.dump(label_encoder, "plant_label_encoder.pkl")
    print("\nSaved plant_recommendation_pipeline.joblib and plant_label_encoder.pkl")


if __name__ == "__main__":
    main()
