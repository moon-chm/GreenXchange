import os
import logging
import numpy as np
import pandas as pd
from scipy.special import softmax

from app.services.recommendation.models import ScoringModel
from app.models.plants import PlantSpecies
from typing import Dict, Any

logger = logging.getLogger(__name__)


class PickleScoringModel(ScoringModel):
    """
    Scoring model backed by the SVC .pkl trained in ml_model/app.py.

    Since the SVC was trained without probability=True we use decision_function()
    scores (one per class) converted via softmax into a [0,1] probability-like
    distribution.  The first call per unique env-profile computes and caches the
    full score vector; subsequent calls are O(1) dict lookups.
    """

    def __init__(self, model_path: str):
        import joblib
        import warnings

        self.model_path = model_path
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            self.model = joblib.load(model_path)

        # Load label encoder from sibling path (or LABEL_ENCODER_PATH env var)
        encoder_path = os.getenv(
            "LABEL_ENCODER_PATH",
            os.path.join(os.path.dirname(model_path), "label_encoder.pkl"),
        )
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            self.label_encoder = joblib.load(encoder_path)

        # Build lookup: class_name (lowercase) -> index in decision_function output
        self.class_index: Dict[str, int] = {
            name.lower(): idx
            for idx, name in enumerate(self.label_encoder.classes_)
        }

        self._score_cache: Dict[str, float] | None = None
        self._cache_key: str | None = None

        has_proba = hasattr(self.model, "predict_proba")
        logger.info(
            "PickleScoringModel loaded — %s, %d plant classes, predict_proba=%s, from %s",
            type(self.model).__name__,
            len(self.class_index),
            has_proba,
            model_path,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def score(
        self,
        species: PlantSpecies,
        env_profile: Dict[str, Any],
        filters: Dict[str, Any],
    ) -> float:
        """
        Returns a [0,1] score for this species given the current environment.
        Uses softmax over SVC decision_function scores so all plants get a
        meaningful relative ranking (not just winner-takes-all).
        """
        cache_key = self._build_cache_key(env_profile, filters)
        if self._cache_key != cache_key:
            self._score_cache = self._compute_scores(env_profile, filters)
            self._cache_key = cache_key

        name_lower = (species.common_name or "").strip().lower()
        base = self._score_cache.get(name_lower, 0.0)  # type: ignore[union-attr]

        # Small absorption bonus so ties between unknown plants are broken sensibly
        absorption_bonus = min(
            0.05,
            ((species.pm25_absorption_rate or 0) + (species.co2_absorption_rate or 0))
            / 2000,
        )
        return min(1.0, base + absorption_bonus)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_cache_key(
        self, env_profile: Dict[str, Any], filters: Dict[str, Any]
    ) -> str:
        air = env_profile.get("air_quality", {})
        weather = env_profile.get("weather", {})
        return (
            f"{air.get('aqi', 50)}-{air.get('pm25', 50)}-{air.get('pm10', 60)}"
            f"-{air.get('no2', 20)}-{air.get('so2', 10)}-{air.get('co', 0.5)}"
            f"-{air.get('o3', 25)}-{weather.get('temperature', 25)}"
            f"-{weather.get('humidity', 60)}-{filters.get('space_type', 'Indoor')}"
        )

    def _compute_scores(
        self, env_profile: Dict[str, Any], filters: Dict[str, Any]
    ) -> Dict[str, float]:
        """
        Build the feature DataFrame the model was trained on and compute
        per-class scores via decision_function → softmax.
        """
        air = env_profile.get("air_quality", {})
        weather = env_profile.get("weather", {})

        # Map space_type enum → training label
        raw_space = filters.get("space_type", "indoor")
        space_map = {"indoor": "Indoor", "balcony": "Balcony", "outdoor": "Outdoor"}
        space_type = space_map.get(str(raw_space).lower(), "Outdoor")

        # Map maintenance preference → training label
        raw_maint = filters.get("maintenance_preference", "medium")
        maint_map = {"low": "Low", "medium": "Medium", "high": "High"}
        maintenance = maint_map.get(str(raw_maint).lower(), "Medium")

        input_dict = {
            "AreaType": "Urban",
            "AQI": int(air.get("aqi", 50)),
            "PM2.5": float(air.get("pm25", 50.0)),
            "PM10": float(air.get("pm10", 60.0)),
            "NO2": float(air.get("no2", 20.0)),
            "SO2": float(air.get("so2", 10.0)),
            "CO": float(air.get("co", 0.5)),
            "O3": float(air.get("o3", 25.0)),
            "TrafficDensity": "Medium",
            "RoadDistance": 25,
            "DustIndex": 40,
            "Temperature": float(weather.get("temperature", 25.0)),
            "Humidity": int(weather.get("humidity", 60)),
            "Rainfall": 150,
            "WindSpeed": float(weather.get("wind_speed", 10.0)),
            "Sunlight": "Partial Shade",
            "SoilType": "Loamy",
            "SoilPH": 6.5,
            "Drainage": "Moderate",
            "SpaceType": space_type,
            "AreaSize": "Medium",
            "MaintenanceLevel": maintenance,
            "WateringPreference": "Regular",
            "Purpose": "Air Purification",
        }

        df = pd.DataFrame([input_dict])
        df = pd.get_dummies(df)

        # Align to exact columns the model was trained on
        model_columns = self.model.feature_names_in_
        df = df.reindex(columns=model_columns, fill_value=0)

        try:
            if hasattr(self.model, "predict_proba"):
                # RandomForest / SVC with probability=True
                raw_scores = self.model.predict_proba(df)[0]
            else:
                # SVC without probability — use decision_function + softmax
                df_scores = self.model.decision_function(df)[0]  # shape (n_classes,)
                raw_scores = softmax(df_scores)
        except Exception as exc:
            logger.warning(
                "ML scoring failed (%s) — using uniform fallback", exc
            )
            n = len(self.label_encoder.classes_)
            raw_scores = np.full(n, 1.0 / n)

        return {
            name.lower(): float(score)
            for name, score in zip(self.label_encoder.classes_, raw_scores)
        }
