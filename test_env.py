import urllib.request
import json
from test_auth import request, API_URL

print("1. Login to get token:")
status, body, headers = request(f"{API_URL}/auth/login", "POST", 
    {"username": "test3@example.com", "password": "password123"},
    {"Content-Type": "application/x-www-form-urlencoded"}
)
access_token = body.get("access_token")

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
