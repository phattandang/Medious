#!/usr/bin/env python3
"""
Debug profile update issue
"""

import requests
import json
import uuid

BACKEND_URL = "https://auth-flow-repair-43.preview.emergentagent.com/api"

# First register a user
test_email = f"debug_{uuid.uuid4().hex[:8]}@example.com"
test_password = "TestPassword123!"

print("1. Registering user...")
register_payload = {
    "email": test_email,
    "password": test_password,
    "name": "Debug User"
}

response = requests.post(f"{BACKEND_URL}/auth/register", json=register_payload)
print(f"Register response: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    token = data["token"]
    print(f"Token: {token[:50]}...")
    
    print("\n2. Testing profile update...")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Try different payload formats
    print("\n2a. Testing with form data...")
    form_data = {"name": "Updated Debug User", "avatar": "https://example.com/avatar.jpg"}
    response = requests.put(f"{BACKEND_URL}/users/profile", data=form_data, headers=headers)
    print(f"Form data response: {response.status_code}")
    print(f"Response: {response.text}")
    
    print("\n2b. Testing with JSON data...")
    json_data = {"name": "Updated Debug User JSON", "avatar": "https://example.com/avatar2.jpg"}
    response = requests.put(f"{BACKEND_URL}/users/profile", json=json_data, headers=headers)
    print(f"JSON data response: {response.status_code}")
    print(f"Response: {response.text}")
    
    print("\n2c. Testing with query parameters...")
    params = {"name": "Updated Debug User Params", "avatar": "https://example.com/avatar3.jpg"}
    response = requests.put(f"{BACKEND_URL}/users/profile", params=params, headers=headers)
    print(f"Query params response: {response.status_code}")
    print(f"Response: {response.text}")
    
else:
    print(f"Registration failed: {response.text}")