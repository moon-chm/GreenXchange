import urllib.request
import urllib.error
import urllib.parse
import json

API_URL = "http://localhost/api"

def request(url, method="GET", data=None, headers=None):
    headers = headers or {}
    if data is not None:
        if isinstance(data, dict):
            if headers.get("Content-Type") == "application/x-www-form-urlencoded":
                encoded_data = urllib.parse.urlencode(data).encode()
            else:
                encoded_data = json.dumps(data).encode()
                headers["Content-Type"] = "application/json"
        else:
            encoded_data = data
    else:
        encoded_data = None
        
    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.loads(response.read().decode()), response.info()
    except urllib.error.HTTPError as e:
        raw_body = e.read().decode()
        try:
            return e.code, json.loads(raw_body), e.headers
        except json.JSONDecodeError:
            return e.code, raw_body, e.headers

def test():
    print("1. Registration:")
    status, body, _ = request(f"{API_URL}/auth/register", "POST", {
        "email": "test3@example.com",
        "password": "password123",
        "name": "Test User",
        "location_lat": 40.7128,
        "location_lng": -74.0060
    })
    print(status, body)
    
    print("\n2. Login:")
    status, body, headers = request(f"{API_URL}/auth/login", "POST", 
        {"username": "test3@example.com", "password": "password123"},
        {"Content-Type": "application/x-www-form-urlencoded"}
    )
    print(status, body)
    access_token = body.get("access_token")
    cookie = headers.get("Set-Cookie")
    
    print("\n3. Current User:")
    status, body, _ = request(f"{API_URL}/users/me", "GET", headers={
        "Authorization": f"Bearer {access_token}"
    })
    print(status, body)
    
    print("\n4. Refresh Token:")
    if cookie:
        status, body, headers2 = request(f"{API_URL}/auth/refresh", "POST", headers={
            "Cookie": cookie
        })
    else:
        status, body, headers2 = 0, "No cookie returned from login", {}
    print(status, body)
    
    print("\n5. Rate Limiter (6 invalid logins):")
    for i in range(6):
        status, body, _ = request(f"{API_URL}/auth/login", "POST", 
            {"username": "test2@example.com", "password": "wrong"},
            {"Content-Type": "application/x-www-form-urlencoded"}
        )
        print(f"Attempt {i+1}: {status} {body}")

test()
