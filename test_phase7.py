import urllib.request
import json
import os
import time

API_URL = "http://localhost/api"

def request(url, method="GET", data=None, headers=None, is_multipart=False):
    if data and not is_multipart:
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
        except:
            return e.code, body

print("1. Login to get token:")
status, body = request(f"{API_URL}/auth/login", "POST", 
    {"username": "test3@example.com", "password": "password123"},
    {"Content-Type": "application/x-www-form-urlencoded"}
)
access_token = body.get("access_token")

print("\n2. Get Portfolio:")
status, body = request(f"{API_URL}/plants/my", "GET", headers={
    "Authorization": f"Bearer {access_token}"
})
plant_id = body[0]["id"]
print("Plant ID:", plant_id)

print("\n3. Submit out of bounds growth update (should fail):")
boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
body_parts = []
body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"lat\"\r\n\r\n45.0\r\n")
body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"lng\"\r\n\r\n-74.0\r\n")
body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"test.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n")
# We need a real jpeg here so sanitize_image doesn't fail if we get past geo validation (which we shouldn't)
import io
from PIL import Image
img = Image.new('RGB', (1, 1), color='red')
img_byte_arr = io.BytesIO()
img.save(img_byte_arr, format='JPEG')
img_bytes = img_byte_arr.getvalue()

payload = "".join(body_parts).encode("utf-8") + img_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

status, response_body = request(f"{API_URL}/plants/{plant_id}/growth", "POST", data=payload, headers={
    "Authorization": f"Bearer {access_token}",
    "Content-Type": f"multipart/form-data; boundary={boundary}"
}, is_multipart=True)
print("Status:", status, "Response:", response_body)

print("\n4. Submit valid growth update:")
body_parts = []
body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"lat\"\r\n\r\n40.7128\r\n")
body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"lng\"\r\n\r\n-74.0060\r\n")
body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"test.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n")

payload = "".join(body_parts).encode("utf-8") + img_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

status, response_body = request(f"{API_URL}/plants/{plant_id}/growth", "POST", data=payload, headers={
    "Authorization": f"Bearer {access_token}",
    "Content-Type": f"multipart/form-data; boundary={boundary}"
}, is_multipart=True)
print("Status:", status, "Response:", response_body)

if status == 200:
    print("Waiting for celery worker to process...")
    time.sleep(5)
    print("\n5. Get growth updates:")
    status, response_body = request(f"{API_URL}/plants/{plant_id}/growth", "GET", headers={
        "Authorization": f"Bearer {access_token}"
    })
    print("Updates:", json.dumps(response_body, indent=2))
