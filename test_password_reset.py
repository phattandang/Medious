#!/usr/bin/env python3
"""
Test password reset flow with actual reset token
"""

import requests
import json
import uuid
import re
import time

BACKEND_URL = "https://security-policy-fix-2.preview.emergentagent.com/api"

def test_password_reset_flow():
    """Test complete password reset flow"""
    
    # Register a user first
    test_email = f"reset_test_{uuid.uuid4().hex[:8]}@example.com"
    test_password = "OriginalPassword123!"
    new_password = "NewPassword456!"
    
    print("1. Registering user for reset test...")
    register_payload = {
        "email": test_email,
        "password": test_password,
        "name": "Reset Test User"
    }
    
    response = requests.post(f"{BACKEND_URL}/auth/register", json=register_payload)
    if response.status_code != 200:
        print(f"❌ Registration failed: {response.text}")
        return False
    
    print("✅ User registered successfully")
    
    # Request password reset
    print("\n2. Requesting password reset...")
    reset_payload = {"email": test_email}
    response = requests.post(f"{BACKEND_URL}/auth/forgot-password", json=reset_payload)
    
    if response.status_code != 200:
        print(f"❌ Password reset request failed: {response.text}")
        return False
    
    print("✅ Password reset requested")
    
    # Check backend logs for reset token (in production this would be sent via email)
    print("\n3. Checking backend logs for reset token...")
    import subprocess
    try:
        result = subprocess.run(['tail', '-n', '20', '/var/log/supervisor/backend.err.log'], 
                              capture_output=True, text=True)
        logs = result.stdout
        
        # Look for reset token in logs
        token_match = re.search(rf'Password reset token for {re.escape(test_email)}: ([a-f0-9-]+)', logs)
        if not token_match:
            print("❌ Reset token not found in logs")
            return False
        
        reset_token = token_match.group(1)
        print(f"✅ Found reset token: {reset_token[:20]}...")
        
    except Exception as e:
        print(f"❌ Error reading logs: {e}")
        return False
    
    # Test reset password with valid token
    print("\n4. Testing password reset with valid token...")
    reset_password_payload = {
        "email": test_email,
        "reset_token": reset_token,
        "new_password": new_password
    }
    
    response = requests.post(f"{BACKEND_URL}/auth/reset-password", json=reset_password_payload)
    if response.status_code != 200:
        print(f"❌ Password reset failed: {response.text}")
        return False
    
    print("✅ Password reset successful")
    
    # Test login with old password (should fail)
    print("\n5. Testing login with old password (should fail)...")
    login_payload = {"email": test_email, "password": test_password}
    response = requests.post(f"{BACKEND_URL}/auth/login", json=login_payload)
    
    if response.status_code == 401:
        print("✅ Old password correctly rejected")
    else:
        print(f"❌ Old password should be rejected, got {response.status_code}")
        return False
    
    # Test login with new password (should work)
    print("\n6. Testing login with new password (should work)...")
    login_payload = {"email": test_email, "password": new_password}
    response = requests.post(f"{BACKEND_URL}/auth/login", json=login_payload)
    
    if response.status_code == 200:
        print("✅ New password works correctly")
        return True
    else:
        print(f"❌ New password should work, got {response.status_code}: {response.text}")
        return False

def test_reset_password_invalid_token():
    """Test reset password with invalid token"""
    print("\n7. Testing password reset with invalid token...")
    
    invalid_payload = {
        "email": "test@example.com",
        "reset_token": "invalid-token-12345",
        "new_password": "NewPassword123!"
    }
    
    response = requests.post(f"{BACKEND_URL}/auth/reset-password", json=invalid_payload)
    
    if response.status_code == 400:
        print("✅ Invalid reset token correctly rejected")
        return True
    else:
        print(f"❌ Expected 400, got {response.status_code}: {response.text}")
        return False

if __name__ == "__main__":
    print("🔐 Testing Password Reset Flow")
    print("=" * 50)
    
    success1 = test_password_reset_flow()
    success2 = test_reset_password_invalid_token()
    
    if success1 and success2:
        print("\n✅ All password reset tests passed!")
        exit(0)
    else:
        print("\n❌ Some password reset tests failed!")
        exit(1)