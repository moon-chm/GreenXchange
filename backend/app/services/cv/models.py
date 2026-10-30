from __future__ import annotations
import os
import io
import logging
import numpy as np
from PIL import Image, ImageChops, ImageEnhance
from typing import Dict, Any, Optional
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

# Try importing PyTorch & torchvision
try:
    import torch
    import torch.nn as nn
    import torchvision.models as tv_models
    import torchvision.transforms as transforms
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("PyTorch or Torchvision not available. CV models will use heuristic fallbacks.")


class CVModel(ABC):
    @abstractmethod
    def check_ela(self, image: bytes) -> Dict[str, Any]:
        """Check image for digital manipulation via Error Level Analysis."""
        pass
        
    @abstractmethod
    def detect_tree(self, image: bytes) -> Dict[str, Any]:
        """Detect if image contains a genuine tree/plant using Model 1 (ResNet18)."""
        pass

    @abstractmethod
    def assess_health(self, image: bytes) -> Dict[str, Any]:
        """Diagnose plant health (Healthy vs Unhealthy) using Model 2 (ResNet18)."""
        pass

    @abstractmethod
    def detect_plant(self, image: bytes) -> Dict[str, Any]:
        """Detect plant foliage presence."""
        pass
        
    @abstractmethod
    def classify_growth_stage(self, image: bytes, prior_image: Optional[bytes] = None) -> Dict[str, Any]:
        """Classify growth stage based on foliage coverage and canopy index."""
        pass
        
    @abstractmethod
    def verify_species(self, image: bytes, species_ref: str) -> Dict[str, Any]:
        """Species verification."""
        pass

    @abstractmethod
    def analyze_plant_image(self, image: bytes) -> Dict[str, Any]:
        """Comprehensive verification pipeline combining tree detection, health assessment, ELA, and growth stage."""
        pass


class PyTorchCVModel(CVModel):
    """
    Production Computer Vision Model Suite using PyTorch ResNet18 transfer learning:
    1. Model 1 (Tree Detector): Binary classifier for Tree vs Not-Tree.
    2. Model 2 (Plant Health): Binary classifier for Healthy vs Unhealthy.
    3. ELA (Error Level Analysis): Digital tampering detection.
    4. ExG (Excess Green Index): Vegetation coverage & Growth stage classification.
    """

    def __init__(
        self,
        tree_model_path: Optional[str] = None,
        health_model_path: Optional[str] = None
    ):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu") if TORCH_AVAILABLE else None
        self.tree_model: Optional[nn.Module] = None
        self.health_model: Optional[nn.Module] = None
        
        # Standard ResNet inference transforms (ImageNet mean & std)
        if TORCH_AVAILABLE:
            self.transform = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]
                )
            ])
        else:
            self.transform = None

        # Resolve model paths — production Docker path checked first
        self.tree_model_path = self._resolve_model_path(
            tree_model_path or os.getenv("TREE_MODEL_PATH"),
            [
                "/app/models/model1/tree_detector_resnet18.pth",                              # Docker/Render (production)
                os.path.join(os.path.dirname(__file__), "..", "..", "..", "models", "model1", "tree_detector_resnet18.pth"),  # Local dev (backend/models/) — 3 ups from backend/app/services/cv reaches backend/
                os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "ALL MODELS", "model1", "tree_detector_resnet18.pth"),   # Local dev (repo-root ALL MODELS/) — 4 ups reaches the repo root
                r"E:\GreenXchange\ALL MODELS\model1\tree_detector_resnet18.pth",              # Windows absolute fallback
            ]
        )

        self.health_model_path = self._resolve_model_path(
            health_model_path or os.getenv("PLANT_HEALTH_MODEL_PATH"),
            [
                "/app/models/model 2/new-plant_health_resnet18_balanced.pth",                              # Docker/Render (production)
                os.path.join(os.path.dirname(__file__), "..", "..", "..", "models", "model 2", "new-plant_health_resnet18_balanced.pth"),  # Local dev (backend/models/) — 3 ups from backend/app/services/cv reaches backend/
                os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "ALL MODELS", "model 2", "new-plant_health_resnet18_balanced.pth"),   # Local dev (repo-root ALL MODELS/) — 4 ups reaches the repo root
                r"E:\GreenXchange\ALL MODELS\model 2\new-plant_health_resnet18_balanced.pth", # Windows absolute fallback
            ]
        )

        self._load_models()

    def _resolve_model_path(self, explicit_path: Optional[str], candidate_paths: list[str]) -> Optional[str]:
        if explicit_path and os.path.exists(explicit_path):
            return explicit_path
        for candidate in candidate_paths:
            normalized = os.path.normpath(candidate)
            if os.path.exists(normalized):
                return normalized
        return None

    def _load_models(self):
        if not TORCH_AVAILABLE:
            logger.warning("PyTorch not available — skipping neural network weight loading.")
            return

        # 1. Load Tree Detector Model (Model 1)
        if self.tree_model_path and os.path.exists(self.tree_model_path):
            try:
                model = tv_models.resnet18()
                model.fc = nn.Sequential(
                    nn.Dropout(p=0.3),
                    nn.Linear(model.fc.in_features, 2)
                )
                state_dict = torch.load(self.tree_model_path, map_location=self.device, weights_only=True)
                model.load_state_dict(state_dict)
                model.to(self.device)
                model.eval()
                self.tree_model = model
                logger.info(f"Tree Detector Model loaded successfully from {self.tree_model_path}")
            except Exception as e:
                logger.error(f"Failed to load Tree Detector Model from {self.tree_model_path}: {e}")
        else:
            logger.warning(f"Tree Detector Model path not found. Searched candidates.")

        # 2. Load Plant Health Model (Model 2)
        if self.health_model_path and os.path.exists(self.health_model_path):
            try:
                model = tv_models.resnet18()
                model.fc = nn.Sequential(
                    nn.Dropout(p=0.3),
                    nn.Linear(model.fc.in_features, 2)
                )
                state_dict = torch.load(self.health_model_path, map_location=self.device, weights_only=True)
                model.load_state_dict(state_dict)
                model.to(self.device)
                model.eval()
                self.health_model = model
                logger.info(f"Plant Health Model loaded successfully from {self.health_model_path}")
            except Exception as e:
                logger.error(f"Failed to load Plant Health Model from {self.health_model_path}: {e}")
        else:
            logger.warning(f"Plant Health Model path not found. Searched candidates.")

    def _preprocess_image(self, image_bytes: bytes) -> Optional[torch.Tensor]:
        if not TORCH_AVAILABLE or self.transform is None:
            return None
        try:
            img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            # Quick thumbnail pre-scale to avoid slow CPU resizing on 12MP+ phone photos
            if img.width > 600 or img.height > 600:
                img.thumbnail((600, 600))
            tensor = self.transform(img).unsqueeze(0).to(self.device)
            return tensor
        except Exception as e:
            logger.error(f"Image preprocessing error: {e}")
            return None

    def check_ela(self, image_bytes: bytes, quality: int = 90, threshold: float = 35.0) -> Dict[str, Any]:
        """
        Error Level Analysis (ELA) for image forgery detection.
        Re-saves JPEG at given quality and computes mean difference score.
        """
        try:
            original = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            if original.width > 600 or original.height > 600:
                original.thumbnail((600, 600))
            
            buf = io.BytesIO()
            original.save(buf, format="JPEG", quality=quality)
            buf.seek(0)
            recompressed = Image.open(buf).convert("RGB")
            
            ela_img = ImageChops.difference(original, recompressed)
            extrema = ela_img.getextrema()
            max_diff = max([ex[1] for ex in extrema])
            
            scale = 255.0 / (max_diff if max_diff > 0 else 1)
            ela_img = ImageEnhance.Brightness(ela_img).enhance(scale)
            
            ela_arr = np.array(ela_img)
            mean_diff = float(np.mean(ela_arr))
            
            is_valid = mean_diff < threshold
            return {
                "pass": is_valid,
                "confidence": round(max(0.70, min(0.99, 1.0 - (mean_diff / 100.0))), 2),
                "ela_score": round(mean_diff, 2),
                "reason": "Authentic photo" if is_valid else "Potential image manipulation / ELA anomaly detected"
            }
        except Exception as e:
            raise RuntimeError("Photo analysis unavailable") from e

    def detect_tree(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Model 1: Binary classification (0: not_tree, 1: tree).
        Validates if the submitted photo is a genuine tree/plant.
        """
        if self.tree_model is not None:
            try:
                tensor = self._preprocess_image(image_bytes)
                if tensor is not None:
                    with torch.no_grad():
                        outputs = self.tree_model(tensor)
                        probs = torch.softmax(outputs, dim=1).cpu().numpy()[0]
                        not_tree_prob = float(probs[0])
                        tree_prob = float(probs[1])

                        is_tree = tree_prob >= 0.50
                        confidence = tree_prob if is_tree else not_tree_prob

                        return {
                            "pass": is_tree,
                            "is_tree": is_tree,
                            "confidence": round(confidence, 4),
                            "probabilities": {
                                "not_tree": round(not_tree_prob, 4),
                                "tree": round(tree_prob, 4)
                            },
                            "reason": f"Tree detected with {tree_prob*100:.1f}% confidence" if is_tree else f"Not a tree/plant (tree probability: {tree_prob*100:.1f}%)"
                        }
            except Exception as e:
                logger.error(f"Error during tree detection inference: {e}")

        raise RuntimeError("Plant detection model unavailable")

    def assess_health(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Model 2: Plant Health Classification (0: Healthy, 1: Unhealthy).
        Evaluates health score and checks for disease or stress symptoms.
        """
        if self.health_model is not None:
            try:
                tensor = self._preprocess_image(image_bytes)
                if tensor is not None:
                    with torch.no_grad():
                        outputs = self.health_model(tensor)
                        probs = torch.softmax(outputs, dim=1).cpu().numpy()[0]
                        healthy_prob = float(probs[0])
                        unhealthy_prob = float(probs[1])

                        is_healthy = healthy_prob >= 0.50
                        status = "Healthy" if is_healthy else "Unhealthy"
                        confidence = healthy_prob if is_healthy else unhealthy_prob

                        return {
                            "pass": True,  # Health assessment succeeds regardless of state
                            "is_healthy": is_healthy,
                            "health_status": status,
                            "confidence": round(confidence, 4),
                            "probabilities": {
                                "healthy": round(healthy_prob, 4),
                                "unhealthy": round(unhealthy_prob, 4)
                            },
                            "reason": f"Plant diagnosed as {status} (Healthy prob: {healthy_prob*100:.1f}%, Unhealthy prob: {unhealthy_prob*100:.1f}%)"
                        }
            except Exception as e:
                logger.error(f"Error during plant health inference: {e}")

        raise RuntimeError("Plant health model unavailable")

    def detect_plant(self, image_bytes: bytes, min_foliage_ratio: float = 0.02) -> Dict[str, Any]:
        """
        Foliage & vegetation detection using Excess Green Index (ExG = 2G - R - B).
        """
        try:
            img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            img = img.resize((256, 256))
            arr = np.array(img, dtype=np.float32)
            
            r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
            
            # Excess Green Index (ExG)
            exg = 2.0 * g - r - b
            
            # Mask pixels with high green ratio
            green_mask = (exg > 15) & (g > r) & (g > b)
            foliage_ratio = float(np.sum(green_mask)) / (256 * 256)
            
            has_plant = foliage_ratio >= min_foliage_ratio
            return {
                "pass": has_plant,
                "is_tree": has_plant,
                "confidence": round(min(0.99, max(0.60, foliage_ratio * 5.0)), 2),
                "foliage_coverage_pct": round(foliage_ratio * 100.0, 2),
                "reason": f"Plant foliage detected ({foliage_ratio*100:.1f}% coverage)" if has_plant else "No significant plant foliage detected"
            }
        except Exception as e:
            raise ValueError("Cannot inspect photo") from e

    def classify_growth_stage(self, image_bytes: bytes, prior_image: Optional[bytes] = None) -> Dict[str, Any]:
        # Framing/lighting can change coverage without biological growth.
        return {"pass": False, "confidence": None, "stage": "Not assessed",
                "coverage_pct": self.detect_plant(image_bytes).get("foliage_coverage_pct")}

    def verify_species(self, image_bytes: bytes, species_ref: str) -> Dict[str, Any]:
        return {"pass": False, "confidence": None, "matched_species": None}

    def analyze_plant_image(self, image_bytes: bytes) -> Dict[str, Any]:
        if self.tree_model is None or self.health_model is None:
            raise RuntimeError("Plant verification models unavailable")
        tree = self.detect_tree(image_bytes)
        health = self.assess_health(image_bytes)
        return {
            "is_verified": False,
            "requires_review": True,
            "model_version": "resnet18-dual-v1-observation",
            "is_tree": tree["is_tree"],
            "tree_confidence": tree["confidence"],
            "tree_probabilities": tree.get("probabilities", {}),
            "health_status": health["health_status"],
            "is_healthy": health["is_healthy"],
            "health_confidence": health["confidence"],
            "health_probabilities": health.get("probabilities", {}),
            "growth_stage": "Not assessed",
            "summary_reason": "AI photo observations only. Plant identity and growth require review before points are awarded.",
        }


# Singleton model instance
_cv_model_instance: Optional[CVModel] = None


def get_cv_model() -> CVModel:
    global _cv_model_instance
    if _cv_model_instance is None:
        _cv_model_instance = PyTorchCVModel()
    return _cv_model_instance
