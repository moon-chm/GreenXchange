import os
import io
import sys
from PIL import Image, ImageDraw

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.cv.models import PyTorchCVModel, get_cv_model


def create_mock_plant_image(is_green: bool = True) -> bytes:
    """Generates a sample test image for CV model evaluation."""
    img = Image.new("RGB", (300, 300), color=(34, 139, 34) if is_green else (139, 69, 19))
    draw = ImageDraw.Draw(img)
    if is_green:
        draw.ellipse([50, 50, 250, 250], fill=(0, 128, 0))
        draw.rectangle([130, 200, 170, 290], fill=(101, 67, 33))
    else:
        draw.rectangle([20, 20, 280, 280], fill=(200, 200, 200))
        draw.line([0, 0, 300, 300], fill=(50, 50, 50), width=5)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=95)
    return buf.getvalue()


def test_dual_cv_models():
    print("=" * 60)
    print("TESTING DUAL PYTORCH COMPUTER VISION MODELS")
    print("=" * 60)

    cv_model = get_cv_model()
    print(f"1. CV Model Class: {type(cv_model).__name__}")
    assert isinstance(cv_model, PyTorchCVModel), "get_cv_model() must return a PyTorchCVModel instance"

    plant_bytes = create_mock_plant_image(is_green=True)
    non_plant_bytes = create_mock_plant_image(is_green=False)

    # 2. Test Tree Detection (Model 1)
    print("\n2. Testing Model 1 (Tree Detector ResNet18)...")
    tree_res = cv_model.detect_tree(plant_bytes)
    print("   Tree Result:", tree_res)
    assert "is_tree" in tree_res, "detect_tree must return 'is_tree'"
    assert "confidence" in tree_res, "detect_tree must return 'confidence'"
    assert "probabilities" in tree_res, "detect_tree must return 'probabilities'"
    print("   [OK] Model 1 Tree Detector: Passed assertion checks.")

    # 3. Test Plant Health (Model 2)
    print("\n3. Testing Model 2 (Plant Health ResNet18)...")
    health_res = cv_model.assess_health(plant_bytes)
    print("   Health Result:", health_res)
    assert "is_healthy" in health_res, "assess_health must return 'is_healthy'"
    assert "health_status" in health_res, "assess_health must return 'health_status'"
    assert health_res["health_status"] in ["Healthy", "Unhealthy"], "health_status must be Healthy or Unhealthy"
    print("   [OK] Model 2 Plant Health: Passed assertion checks.")

    # 4. Test Error Level Analysis (ELA)
    print("\n4. Testing Error Level Analysis (ELA)...")
    ela_res = cv_model.check_ela(plant_bytes)
    print("   ELA Result:", ela_res)
    assert "pass" in ela_res, "check_ela must return 'pass'"
    assert "ela_score" in ela_res, "check_ela must return 'ela_score'"
    print("   [OK] ELA Forgery Detection: Passed.")

    # 5. Test Growth Stage Classification
    print("\n5. Testing Growth Stage Classification...")
    stage_res = cv_model.classify_growth_stage(plant_bytes)
    print("   Stage Result:", stage_res)
    assert "stage" in stage_res, "classify_growth_stage must return 'stage'"
    assert stage_res["stage"] in ["Seedling", "Vegetative", "Flowering", "Mature"], "Invalid growth stage"
    print("   [OK] Growth Stage: Passed.")

    # 6. Test Unified Analysis Pipeline
    print("\n6. Testing Unified 4-Pillar Analysis Pipeline...")
    unified_res = cv_model.analyze_plant_image(plant_bytes)
    print("   Unified Analysis:", unified_res)
    assert "is_verified" in unified_res, "Missing is_verified"
    assert "is_tree" in unified_res, "Missing is_tree"
    assert "health_status" in unified_res, "Missing health_status"
    assert "growth_stage" in unified_res, "Missing growth_stage"
    assert "summary_reason" in unified_res, "Missing summary_reason"
    print("   [OK] Unified 4-Pillar Pipeline: Passed.")

    print("\n" + "=" * 60)
    print("ALL DUAL CV MODEL TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    test_dual_cv_models()
