import urllib.request
import json

API_URL = "http://localhost/api"

def request(url, method="GET", data=None, headers=None):
    if data:
        if headers and headers.get("Content-Type") == "application/x-www-form-urlencoded":
            data = urllib.parse.urlencode(data).encode("utf-8")
        else:
            data = json.dumps(data).encode("utf-8")
            if headers is None: headers = {}
            headers["Content-Type"] = "application/json"
    
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req) as response:
            body = response.read().decode("utf-8")
            return response.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        return e.code, json.loads(body) if body else {}

print("1. Login to get token:")
status, body = request(f"{API_URL}/auth/login", "POST", 
    {"username": "test3@example.com", "password": "password123"},
    {"Content-Type": "application/x-www-form-urlencoded"}
)
access_token = body.get("access_token")

print("\n2. Get Recommendations:")
req_body = {
    "lat": 40.7128,
    "lng": -74.0060,
    "space_type": "indoor",
    "available_space": 10.5,
    "indoor": True,
    "experience_level": "low",
    "allergies": [],
    "has_pets": False,
    "has_children": False
}

import time
start = time.time()
status, body = request(f"{API_URL}/recommendations/", "POST", req_body, headers={
    "Authorization": f"Bearer {access_token}"
})
elapsed = (time.time() - start) * 1000
print(f"Status: {status} in {elapsed:.2f}ms")
for item in body:
    print(item.get("common_name"), "-", item.get("score"), "Reason:", item.get("explanation"))

print("\n3. Hard Filter Test (Toxic plants with Pets):")
req_body["has_pets"] = True
req_body["space_type"] = "outdoor_garden"
status, body = request(f"{API_URL}/recommendations/", "POST", req_body, headers={
    "Authorization": f"Bearer {access_token}"
})
print(f"Status: {status}")
print(f"Returned {len(body)} species.")
