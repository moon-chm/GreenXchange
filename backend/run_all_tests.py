import asyncio
import sys
import subprocess
import os

TEST_FILES = [
    "test_phase8.py",
    "test_phase9.py",
    "test_phase10.py",
    "test_phase11.py",
    "test_phase12.py",
    "test_phase13.py",
    "test_phase14.py",
    "test_phase15_org_payments.py",
    "test_phase16_email.py",
    "test_phase17_community_map.py",
    "test_cv_models.py"
]

def run_test(test_file):
    print(f"\n==================================================")
    print(f"RUNNING: {test_file}")
    print(f"==================================================")
    cmd = [sys.executable, test_file]
    env = os.environ.copy()
    env["PYTHONPATH"] = "/app"
    result = subprocess.run(cmd, capture_output=True, text=True, env=env)
    
    print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr)
        
    return result.returncode == 0

def main():
    print("🚀 GreenXchange Master Automated Test Suite")
    print("==================================================")
    
    passed = 0
    failed = 0
    failed_tests = []

    for test_file in TEST_FILES:
        success = run_test(test_file)
        if success:
            passed += 1
            print(f"✅ {test_file}: PASSED")
        else:
            failed += 1
            failed_tests.append(test_file)
            print(f"❌ {test_file}: FAILED")

    print("\n==================================================")
    print(f"FINAL TEST SUMMARY: {passed} PASSED, {failed} FAILED out of {len(TEST_FILES)} suites.")
    print("==================================================")

    if failed > 0:
        print(f"Failed suites: {', '.join(failed_tests)}")
        sys.exit(1)
    else:
        print("🎉 ALL TEST SUITES PASSED SUCCESSFULLY!")
        sys.exit(0)

if __name__ == "__main__":
    main()
