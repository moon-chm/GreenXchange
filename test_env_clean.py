import urllib.request
import urllib.parse
import urllib.error
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
            headers2 = dict(response.getheaders())
            return response.status, json.loads(body) if body else {}, headers2
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        return e.code, json.loads(body) if body else {}, dict(e.headers)

print("1. Login to get token:")
status, body, headers = request(f"{API_URL}/auth/login", "POST", 
    {"username": "test3@example.com", "password": "password123"},
    {"Content-Type": "application/x-www-form-urlencoded"}
)
access_token = body.get("access_token")
print(status)

print("\n2. Fetch Environment Profile (First Hit - Cache Miss):")
status, body, _ = request(f"{API_URL}/environment/profile?lat=40.7128&lng=-74.0060", "GET", headers={
    "Authorization": f"Bearer {access_token}"
})
print("Status:", status)
print("Body:", body)

print("\n3. Fetch Environment Profile (Second Hit - Cache Hit):")
import time
start = time.time()
status, body, _ = request(f"{API_URL}/environment/profile?lat=40.7128&lng=-74.0060", "GET", headers={
    "Authorization": f"Bearer {access_token}"
})
elapsed = (time.time() - start) * 1000
print(f"Status: {status} in {elapsed:.2f}ms")
print("Body:", body)
