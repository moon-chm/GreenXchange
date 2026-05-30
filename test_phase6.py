import urllib.request
import json
from datetime import datetime

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
        try:
            return e.code, json.loads(body) if body else {}
        except json.decoder.JSONDecodeError:
            return e.code, body

print("1. Login to get token:")
status, body = request(f"{API_URL}/auth/login", "POST", 
    {"username": "test3@example.com", "password": "password123"},
    {"Content-Type": "application/x-www-form-urlencoded"}
)
access_token = body.get("access_token")

print("\n2. Get Species List:")
status, body = request(f"{API_URL}/plants/species", "GET", headers={
    "Authorization": f"Bearer {access_token}"
})
species_id = body[0]["id"]
print(f"Status: {status}, First Species: {body[0]['common_name']}")

print("\n3. Register Plant:")
req_body = {
    "species_id": species_id,
    "common_name": "My Little Fern",
    "lat": 40.7128,
    "lng": -74.0060,
    "planting_date": datetime.utcnow().isoformat() + "Z",
    "space_type": "indoor"
}
status, body = request(f"{API_URL}/plants/register", "POST", req_body, headers={
    "Authorization": f"Bearer {access_token}"
})
print(f"Status: {status}")
scan_id = body.get("scan_id")
print(f"Scan ID Generated: {scan_id}")
print(f"QR Code Base64 generated: {len(body.get('qr_code_base64', '')) > 0}")

print("\n4. Fetch Portfolio:")
status, body = request(f"{API_URL}/plants/my", "GET", headers={
    "Authorization": f"Bearer {access_token}"
})
print(f"Status: {status}, Total Plants: {len(body)}")
print("First Plant in Portfolio:", body[0]["common_name"])

print("\n5. Fetch Public Endpoint:")
status, body = request(f"{API_URL}/plants/{scan_id}/public", "GET")
print(f"Status: {status}")
print("Response Data:", json.dumps(body, indent=2))
