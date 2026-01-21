#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Medious Authentication System
Tests all authentication endpoints and flows
"""

import requests
import json
import time
from datetime import datetime, timedelta
import uuid

# Backend URL from frontend environment
BACKEND_URL = "https://social-fusion-109.preview.emergentagent.com/api"

class MediousAuthTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.test_results = []
        self.test_user_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        self.test_user_password = "TestPassword123!"
        self.test_user_name = "Test User"
        self.auth_token = None
        self.reset_token = None
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "timestamp": datetime.now().isoformat(),
            "details": details
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def test_api_health(self):
        """Test if API is accessible"""
        try:
            response = requests.get(f"{self.base_url}/", timeout=10)
            if response.status_code == 200:
                self.log_result("API Health Check", True, "API is accessible")
                return True
            else:
                self.log_result("API Health Check", False, f"API returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("API Health Check", False, f"Cannot connect to API: {str(e)}")
            return False
    
    def test_user_registration_valid(self):
        """Test user registration with valid data"""
        try:
            payload = {
                "email": self.test_user_email,
                "password": self.test_user_password,
                "name": self.test_user_name
            }
            
            response = requests.post(f"{self.base_url}/auth/register", json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "user" in data:
                    self.auth_token = data["token"]
                    self.log_result("User Registration (Valid)", True, "User registered successfully")
                    return True
                else:
                    self.log_result("User Registration (Valid)", False, "Missing token or user in response", data)
                    return False
            else:
                self.log_result("User Registration (Valid)", False, f"Registration failed with status {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("User Registration (Valid)", False, f"Registration request failed: {str(e)}")
            return False
    
    def test_user_registration_duplicate(self):
        """Test registration with duplicate email (should fail)"""
        try:
            payload = {
                "email": self.test_user_email,  # Same email as previous test
                "password": "AnotherPassword123!",
                "name": "Another User"
            }
            
            response = requests.post(f"{self.base_url}/auth/register", json=payload, timeout=10)
            
            if response.status_code == 400:
                self.log_result("User Registration (Duplicate)", True, "Duplicate email correctly rejected")
                return True
            else:
                self.log_result("User Registration (Duplicate)", False, f"Expected 400, got {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("User Registration (Duplicate)", False, f"Duplicate registration test failed: {str(e)}")
            return False
    
    def test_user_login_valid(self):
        """Test login with correct credentials"""
        try:
            payload = {
                "email": self.test_user_email,
                "password": self.test_user_password
            }
            
            response = requests.post(f"{self.base_url}/auth/login", json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "user" in data:
                    self.auth_token = data["token"]  # Update token
                    self.log_result("User Login (Valid)", True, "Login successful")
                    return True
                else:
                    self.log_result("User Login (Valid)", False, "Missing token or user in response", data)
                    return False
            else:
                self.log_result("User Login (Valid)", False, f"Login failed with status {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("User Login (Valid)", False, f"Login request failed: {str(e)}")
            return False
    
    def test_user_login_invalid_password(self):
        """Test login with incorrect password (should fail)"""
        try:
            payload = {
                "email": self.test_user_email,
                "password": "WrongPassword123!"
            }
            
            response = requests.post(f"{self.base_url}/auth/login", json=payload, timeout=10)
            
            if response.status_code == 401:
                self.log_result("User Login (Invalid Password)", True, "Invalid password correctly rejected")
                return True
            else:
                self.log_result("User Login (Invalid Password)", False, f"Expected 401, got {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("User Login (Invalid Password)", False, f"Invalid password test failed: {str(e)}")
            return False
    
    def test_user_login_nonexistent_email(self):
        """Test login with non-existent email (should fail)"""
        try:
            payload = {
                "email": f"nonexistent_{uuid.uuid4().hex[:8]}@example.com",
                "password": "SomePassword123!"
            }
            
            response = requests.post(f"{self.base_url}/auth/login", json=payload, timeout=10)
            
            if response.status_code == 401:
                self.log_result("User Login (Non-existent Email)", True, "Non-existent email correctly rejected")
                return True
            else:
                self.log_result("User Login (Non-existent Email)", False, f"Expected 401, got {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("User Login (Non-existent Email)", False, f"Non-existent email test failed: {str(e)}")
            return False
    
    def test_token_verification_valid(self):
        """Test token verification with valid token"""
        if not self.auth_token:
            self.log_result("Token Verification (Valid)", False, "No auth token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = requests.get(f"{self.base_url}/auth/verify", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "email" in data and data["email"] == self.test_user_email:
                    self.log_result("Token Verification (Valid)", True, "Token verification successful")
                    return True
                else:
                    self.log_result("Token Verification (Valid)", False, "Token verification returned wrong user", data)
                    return False
            else:
                self.log_result("Token Verification (Valid)", False, f"Token verification failed with status {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Token Verification (Valid)", False, f"Token verification request failed: {str(e)}")
            return False
    
    def test_token_verification_invalid(self):
        """Test token verification with invalid token (should fail)"""
        try:
            headers = {"Authorization": "Bearer invalid_token_12345"}
            response = requests.get(f"{self.base_url}/auth/verify", headers=headers, timeout=10)
            
            if response.status_code == 401:
                self.log_result("Token Verification (Invalid)", True, "Invalid token correctly rejected")
                return True
            else:
                self.log_result("Token Verification (Invalid)", False, f"Expected 401, got {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Token Verification (Invalid)", False, f"Invalid token test failed: {str(e)}")
            return False
    
    def test_forgot_password_existing_email(self):
        """Test forgot password with existing email"""
        try:
            payload = {"email": self.test_user_email}
            response = requests.post(f"{self.base_url}/auth/forgot-password", json=payload, timeout=10)
            
            if response.status_code == 200:
                self.log_result("Forgot Password (Existing Email)", True, "Forgot password request processed")
                return True
            else:
                self.log_result("Forgot Password (Existing Email)", False, f"Forgot password failed with status {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Forgot Password (Existing Email)", False, f"Forgot password request failed: {str(e)}")
            return False
    
    def test_forgot_password_nonexistent_email(self):
        """Test forgot password with non-existent email"""
        try:
            payload = {"email": f"nonexistent_{uuid.uuid4().hex[:8]}@example.com"}
            response = requests.post(f"{self.base_url}/auth/forgot-password", json=payload, timeout=10)
            
            if response.status_code == 200:
                self.log_result("Forgot Password (Non-existent Email)", True, "Non-existent email handled gracefully")
                return True
            else:
                self.log_result("Forgot Password (Non-existent Email)", False, f"Expected 200, got {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Forgot Password (Non-existent Email)", False, f"Non-existent email test failed: {str(e)}")
            return False
    
    def test_supabase_oauth_sync_new_user(self):
        """Test syncing a new Supabase user (Google OAuth simulation)"""
        try:
            unique_email = f"oauth_{uuid.uuid4().hex[:8]}@gmail.com"
            payload = {
                "supabase_user_id": f"supabase_{uuid.uuid4().hex}",
                "email": unique_email,
                "auth_provider": "google",
                "name": "OAuth Test User",
                "avatar": "https://example.com/avatar.jpg"
            }
            
            response = requests.post(f"{self.base_url}/auth/supabase-sync", json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "user" in data:
                    self.log_result("Supabase OAuth Sync (New User)", True, "New OAuth user synced successfully")
                    return True
                else:
                    self.log_result("Supabase OAuth Sync (New User)", False, "Missing token or user in response", data)
                    return False
            else:
                self.log_result("Supabase OAuth Sync (New User)", False, f"OAuth sync failed with status {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Supabase OAuth Sync (New User)", False, f"OAuth sync request failed: {str(e)}")
            return False
    
    def test_supabase_oauth_sync_existing_email(self):
        """Test syncing with email that already exists via email/password (should fail)"""
        try:
            payload = {
                "supabase_user_id": f"supabase_{uuid.uuid4().hex}",
                "email": self.test_user_email,  # Email already registered
                "auth_provider": "google",
                "name": "OAuth Test User"
            }
            
            response = requests.post(f"{self.base_url}/auth/supabase-sync", json=payload, timeout=10)
            
            if response.status_code == 400:
                self.log_result("Supabase OAuth Sync (Existing Email)", True, "Existing email correctly rejected")
                return True
            else:
                self.log_result("Supabase OAuth Sync (Existing Email)", False, f"Expected 400, got {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Supabase OAuth Sync (Existing Email)", False, f"Existing email test failed: {str(e)}")
            return False
    
    def test_get_user_profile_authenticated(self):
        """Test getting user profile with valid token"""
        if not self.auth_token:
            self.log_result("Get User Profile (Authenticated)", False, "No auth token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = requests.get(f"{self.base_url}/users/profile", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "email" in data and data["email"] == self.test_user_email:
                    self.log_result("Get User Profile (Authenticated)", True, "Profile retrieved successfully")
                    return True
                else:
                    self.log_result("Get User Profile (Authenticated)", False, "Profile returned wrong user", data)
                    return False
            else:
                self.log_result("Get User Profile (Authenticated)", False, f"Profile retrieval failed with status {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Get User Profile (Authenticated)", False, f"Profile retrieval request failed: {str(e)}")
            return False
    
    def test_get_user_profile_unauthenticated(self):
        """Test getting user profile without authentication (should fail)"""
        try:
            response = requests.get(f"{self.base_url}/users/profile", timeout=10)
            
            if response.status_code == 403:
                self.log_result("Get User Profile (Unauthenticated)", True, "Unauthenticated request correctly rejected")
                return True
            else:
                self.log_result("Get User Profile (Unauthenticated)", False, f"Expected 403, got {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Get User Profile (Unauthenticated)", False, f"Unauthenticated profile test failed: {str(e)}")
            return False
    
    def test_update_user_profile(self):
        """Test updating user profile"""
        if not self.auth_token:
            self.log_result("Update User Profile", False, "No auth token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            payload = {
                "name": "Updated Test User",
                "avatar": "https://example.com/new-avatar.jpg"
            }
            
            response = requests.put(f"{self.base_url}/users/profile", json=payload, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("name") == "Updated Test User":
                    self.log_result("Update User Profile", True, "Profile updated successfully")
                    return True
                else:
                    self.log_result("Update User Profile", False, "Profile not updated correctly", data)
                    return False
            else:
                self.log_result("Update User Profile", False, f"Profile update failed with status {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Update User Profile", False, f"Profile update request failed: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all authentication tests"""
        print("🚀 Starting Medious Authentication Backend Tests")
        print(f"Backend URL: {self.base_url}")
        print(f"Test User Email: {self.test_user_email}")
        print("=" * 60)
        
        # Test sequence
        tests = [
            self.test_api_health,
            self.test_user_registration_valid,
            self.test_user_registration_duplicate,
            self.test_user_login_valid,
            self.test_user_login_invalid_password,
            self.test_user_login_nonexistent_email,
            self.test_token_verification_valid,
            self.test_token_verification_invalid,
            self.test_forgot_password_existing_email,
            self.test_forgot_password_nonexistent_email,
            self.test_supabase_oauth_sync_new_user,
            self.test_supabase_oauth_sync_existing_email,
            self.test_get_user_profile_authenticated,
            self.test_get_user_profile_unauthenticated,
            self.test_update_user_profile
        ]
        
        passed = 0
        failed = 0
        
        for test in tests:
            try:
                if test():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ FAIL {test.__name__}: Unexpected error - {str(e)}")
                failed += 1
            
            # Small delay between tests
            time.sleep(0.5)
        
        print("=" * 60)
        print(f"📊 Test Results: {passed} passed, {failed} failed")
        
        if failed > 0:
            print("\n🔍 Failed Tests Details:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   ❌ {result['test']}: {result['message']}")
                    if result.get("details"):
                        print(f"      Details: {result['details']}")
        
        return passed, failed, self.test_results

if __name__ == "__main__":
    tester = MediousAuthTester()
    passed, failed, results = tester.run_all_tests()
    
    # Save results to file
    with open("/app/backend_test_results.json", "w") as f:
        json.dump({
            "summary": {"passed": passed, "failed": failed, "total": passed + failed},
            "results": results,
            "timestamp": datetime.now().isoformat()
        }, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/backend_test_results.json")
    
    # Exit with appropriate code
    exit(0 if failed == 0 else 1)