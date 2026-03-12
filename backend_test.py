import requests
import sys
import json
import uuid
from datetime import datetime

class KissanAIAPITester:
    def __init__(self, base_url="https://harvest-advisor-pro.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session_token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_result(self, test_name, passed, details=""):
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            print(f"✅ {test_name}")
        else:
            print(f"❌ {test_name} - {details}")
        
        self.test_results.append({
            "test": test_name,
            "passed": passed,
            "details": details
        })

    def run_api_test(self, name, method, endpoint, expected_status, data=None, requires_auth=True):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        # Add cookies for authenticated requests
        cookies = {}
        if requires_auth and self.session_token:
            cookies['session_token'] = self.session_token

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, cookies=cookies, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, cookies=cookies, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, cookies=cookies, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, cookies=cookies, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.log_result(name, True)
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                self.log_result(name, False, f"Expected {expected_status}, got {response.status_code}: {response.text[:200]}")
                return False, {}

        except Exception as e:
            self.log_result(name, False, f"Network error: {str(e)}")
            return False, {}

    def test_user_registration(self):
        """Test user registration"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"test.{unique_id}@kissan.ai"
        
        success, response = self.run_api_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "email": email,
                "password": "Test123!",
                "name": "Test Farmer"
            },
            requires_auth=False
        )
        
        if success and 'user_id' in response:
            self.user_id = response['user_id']
            print(f"✅ Registered user: {email}, ID: {self.user_id}")
            return True, email
        return False, email

    def test_user_login(self, email="test@kissan.ai", password="Test123!"):
        """Test user login and get session token"""
        # For authenticated testing, use pre-created session token
        self.session_token = "test_session_1773351393190"  # From MongoDB setup
        
        success, response = self.run_api_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password},
            requires_auth=False
        )
        
        if success and 'user_id' in response:
            self.user_id = response['user_id']
            print(f"✅ Login successful for user: {response.get('name', 'Unknown')}")
            return True
        return False

    def test_auth_me(self):
        """Test authenticated user endpoint"""
        return self.run_api_test("Get Current User (/auth/me)", "GET", "auth/me", 200)

    def test_weather_api(self):
        """Test weather API"""
        return self.run_api_test(
            "Weather API",
            "GET",
            "weather?lat=13.0&lon=80.0",
            200,
            requires_auth=False
        )

    def test_soil_estimation(self):
        """Test soil estimation API"""
        return self.run_api_test(
            "Soil Estimation",
            "POST",
            "soil/estimate",
            200,
            data={"lat": 13.0, "lon": 80.0}
        )

    def test_ai_chat(self):
        """Test AI chat functionality"""
        success, response = self.run_api_test(
            "AI Chat Message",
            "POST",
            "chat/message",
            200,
            data={"message": "What are the best crops for red soil?", "language": "en"}
        )
        
        if success and 'content' in response:
            print(f"✅ AI Response received: {response['content'][:100]}...")
            return True, response
        return False, {}

    def test_chat_history(self):
        """Test chat history retrieval"""
        return self.run_api_test("Chat History", "GET", "chat/history", 200)

    def test_community_posts(self):
        """Test community posts functionality"""
        # Get posts
        get_success, posts_response = self.run_api_test("Get Community Posts", "GET", "community/posts", 200)
        
        # Create a post
        create_success, create_response = self.run_api_test(
            "Create Community Post",
            "POST",
            "community/posts",
            200,
            data={
                "title": "Test Farming Question",
                "content": "What is the best time to plant rice in Chennai?",
                "category": "crops"
            }
        )
        
        if create_success and 'post_id' in create_response:
            post_id = create_response['post_id']
            # Test like functionality
            like_success, like_response = self.run_api_test(
                "Like Community Post",
                "POST",
                f"community/posts/{post_id}/like",
                200
            )
            return create_success and like_success
        
        return get_success

    def test_farm_info_update(self):
        """Test farm info update"""
        return self.run_api_test(
            "Update Farm Info",
            "PUT",
            "user/farm",
            200,
            data={
                "farm_name": "Test AI Farm",
                "farm_size": "10 acres",
                "crops": ["Rice", "Wheat", "Maize"],
                "location_lat": 13.0827,
                "location_lon": 80.2707,
                "location_name": "Chennai, Tamil Nadu"
            }
        )

    def test_health_endpoints(self):
        """Test basic health endpoints"""
        health_success, _ = self.run_api_test("API Health Check", "GET", "health", 200, requires_auth=False)
        root_success, _ = self.run_api_test("API Root", "GET", "", 200, requires_auth=False)
        return health_success and root_success

    def run_all_tests(self):
        """Run comprehensive backend API tests"""
        print("🚀 Starting Kissan AI Backend API Tests")
        print("=" * 50)

        # Test basic endpoints first
        print("\n📡 Testing Basic Endpoints...")
        self.test_health_endpoints()

        # Test weather (no auth required)
        print("\n🌤️ Testing Weather API...")
        self.test_weather_api()

        # Test authentication flow
        print("\n🔐 Testing Authentication...")
        
        # Try with existing test user first
        login_success = self.test_user_login("test@kissan.ai", "Test123!")
        
        if not login_success:
            # If test user doesn't exist, create new user
            print("Test user not found, creating new user...")
            reg_success, email = self.test_user_registration()
            if reg_success:
                login_success = self.test_user_login(email, "Test123!")

        if not login_success:
            print("❌ Authentication failed, skipping auth-required tests")
            return self.print_summary()

        # Test authenticated endpoints
        print("\n👤 Testing User Profile...")
        self.test_auth_me()
        
        print("\n🚜 Testing Farm Features...")
        self.test_farm_info_update()
        self.test_soil_estimation()

        print("\n🤖 Testing AI Features...")
        self.test_ai_chat()
        self.test_chat_history()

        print("\n👥 Testing Community Features...")
        self.test_community_posts()

        return self.print_summary()

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "No tests run")
        
        print("\n🔍 FAILED TESTS:")
        failed_tests = [result for result in self.test_results if not result['passed']]
        if failed_tests:
            for test in failed_tests:
                print(f"  ❌ {test['test']}: {test['details']}")
        else:
            print("  🎉 All tests passed!")

        return 0 if self.tests_passed == self.tests_run else 1

def main():
    tester = KissanAIAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())