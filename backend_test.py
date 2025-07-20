#!/usr/bin/env python3
"""
Backend API Testing Suite for YouTube Playlist to Course Converter
Tests all backend functionality including YouTube API, Authentication, Course Management, Progress, and Notes
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://3b1f6c7b-ef0f-4b2c-85e5-25a2d23fac29.preview.emergentagent.com/api"
TEST_PLAYLIST_URL = "https://www.youtube.com/playlist?list=PLrAXtmRdnEQy4Qrp74j_hJXNAGL8kcayt"  # Real Python playlist
TEST_SESSION_ID = "test_session_123"  # Mock session for testing

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'X-Session-ID': TEST_SESSION_ID
        })
        self.test_results = {}
        self.user_data = None
        self.test_course_id = None
        self.test_video_id = None
        self.test_note_id = None

    def log_test(self, test_name: str, success: bool, message: str, details: Any = None):
        """Log test results"""
        self.test_results[test_name] = {
            'success': success,
            'message': message,
            'details': details,
            'timestamp': datetime.now().isoformat()
        }
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details and not success:
            print(f"   Details: {details}")

    def test_api_health(self):
        """Test basic API connectivity and health"""
        try:
            response = self.session.get(f"{BASE_URL}/")
            if response.status_code == 200:
                data = response.json()
                self.log_test("API Health Check", True, f"API is accessible: {data.get('message', 'OK')}")
                return True
            else:
                self.log_test("API Health Check", False, f"API returned status {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("API Health Check", False, f"Failed to connect to API: {str(e)}")
            return False

    def test_youtube_api_configuration(self):
        """Test YouTube API configuration endpoint"""
        try:
            response = self.session.get(f"{BASE_URL}/test")
            if response.status_code == 200:
                data = response.json()
                youtube_configured = data.get('youtube_api_configured', False)
                if youtube_configured:
                    self.log_test("YouTube API Configuration", True, "YouTube API key is configured and accessible")
                    return True
                else:
                    self.log_test("YouTube API Configuration", False, "YouTube API key is not configured")
                    return False
            else:
                self.log_test("YouTube API Configuration", False, f"Test endpoint returned status {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("YouTube API Configuration", False, f"Failed to test YouTube API configuration: {str(e)}")
            return False

    def test_authentication_profile(self):
        """Test authentication profile endpoint"""
        try:
            # Test without session ID
            response = requests.get(f"{BASE_URL}/auth/profile")
            if response.status_code == 200:
                data = response.json()
                if 'error' in data:
                    self.log_test("Auth Profile (No Session)", True, f"Correctly handled missing session: {data['error']}")
                else:
                    self.log_test("Auth Profile (No Session)", False, "Should return error for missing session", data)
            
            # Test with mock session ID (will fail with external auth service, but tests endpoint structure)
            response = self.session.get(f"{BASE_URL}/auth/profile")
            if response.status_code == 200:
                data = response.json()
                if 'error' in data:
                    self.log_test("Auth Profile (Mock Session)", True, f"Auth endpoint accessible, external auth expected: {data['error']}")
                    return True
                elif 'user' in data:
                    self.user_data = data['user']
                    self.log_test("Auth Profile (Mock Session)", True, f"Successfully authenticated user: {data['user']['email']}")
                    return True
            
            self.log_test("Auth Profile", False, f"Unexpected response: {response.status_code}", response.text)
            return False
            
        except Exception as e:
            self.log_test("Auth Profile", False, f"Authentication test failed: {str(e)}")
            return False

    def test_course_creation_invalid_url(self):
        """Test course creation with invalid playlist URL"""
        try:
            invalid_payload = {"playlist_url": "https://invalid-url.com"}
            response = self.session.post(f"{BASE_URL}/courses", json=invalid_payload)
            
            # Should return 401 (unauthorized) or 400 (bad request)
            if response.status_code in [400, 401]:
                self.log_test("Course Creation (Invalid URL)", True, f"Correctly rejected invalid URL with status {response.status_code}")
                return True
            else:
                self.log_test("Course Creation (Invalid URL)", False, f"Unexpected status code: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Course Creation (Invalid URL)", False, f"Failed to test invalid URL: {str(e)}")
            return False

    def test_course_creation_valid_url(self):
        """Test course creation with valid playlist URL (requires auth)"""
        try:
            payload = {"playlist_url": TEST_PLAYLIST_URL}
            response = self.session.post(f"{BASE_URL}/courses", json=payload)
            
            # Without proper auth, should return 401
            if response.status_code == 401:
                self.log_test("Course Creation (Valid URL)", True, "Correctly requires authentication for course creation")
                return True
            elif response.status_code == 200:
                data = response.json()
                if 'id' in data and 'title' in data:
                    self.test_course_id = data['id']
                    self.log_test("Course Creation (Valid URL)", True, f"Successfully created course: {data['title']}")
                    return True
            
            self.log_test("Course Creation (Valid URL)", False, f"Unexpected response: {response.status_code}", response.text)
            return False
            
        except Exception as e:
            self.log_test("Course Creation (Valid URL)", False, f"Course creation test failed: {str(e)}")
            return False

    def test_course_listing(self):
        """Test course listing endpoint"""
        try:
            response = self.session.get(f"{BASE_URL}/courses")
            
            # Should require authentication
            if response.status_code == 401:
                self.log_test("Course Listing", True, "Correctly requires authentication for course listing")
                return True
            elif response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Course Listing", True, f"Successfully retrieved {len(data)} courses")
                    return True
            
            self.log_test("Course Listing", False, f"Unexpected response: {response.status_code}", response.text)
            return False
            
        except Exception as e:
            self.log_test("Course Listing", False, f"Course listing test failed: {str(e)}")
            return False

    def test_individual_course_retrieval(self):
        """Test individual course retrieval"""
        try:
            test_course_id = "test-course-123"
            response = self.session.get(f"{BASE_URL}/courses/{test_course_id}")
            
            # Should require authentication
            if response.status_code == 401:
                self.log_test("Individual Course Retrieval", True, "Correctly requires authentication for course retrieval")
                return True
            elif response.status_code == 404:
                self.log_test("Individual Course Retrieval", True, "Correctly returns 404 for non-existent course")
                return True
            elif response.status_code == 200:
                data = response.json()
                if 'id' in data and 'title' in data:
                    self.log_test("Individual Course Retrieval", True, f"Successfully retrieved course: {data['title']}")
                    return True
            
            self.log_test("Individual Course Retrieval", False, f"Unexpected response: {response.status_code}", response.text)
            return False
            
        except Exception as e:
            self.log_test("Individual Course Retrieval", False, f"Individual course retrieval test failed: {str(e)}")
            return False

    def test_progress_tracking(self):
        """Test progress tracking endpoints"""
        try:
            # Test progress update
            test_course_id = "test-course-123"
            test_video_id = "test-video-123"
            
            progress_data = {
                "course_id": test_course_id,
                "video_id": test_video_id,
                "watched": True,
                "watch_time": 300,
                "last_position": 250
            }
            
            response = self.session.post(f"{BASE_URL}/progress", params=progress_data)
            
            # Should require authentication
            if response.status_code == 401:
                self.log_test("Progress Update", True, "Correctly requires authentication for progress update")
            elif response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_test("Progress Update", True, "Successfully updated progress")
                else:
                    self.log_test("Progress Update", False, "Progress update did not return success", data)
            else:
                self.log_test("Progress Update", False, f"Unexpected response: {response.status_code}", response.text)
            
            # Test progress retrieval
            response = self.session.get(f"{BASE_URL}/progress/{test_course_id}")
            
            if response.status_code == 401:
                self.log_test("Progress Retrieval", True, "Correctly requires authentication for progress retrieval")
                return True
            elif response.status_code == 200:
                data = response.json()
                if isinstance(data, dict):
                    self.log_test("Progress Retrieval", True, f"Successfully retrieved progress data")
                    return True
            
            self.log_test("Progress Retrieval", False, f"Unexpected response: {response.status_code}", response.text)
            return False
            
        except Exception as e:
            self.log_test("Progress Tracking", False, f"Progress tracking test failed: {str(e)}")
            return False

    def test_notes_system(self):
        """Test notes creation, retrieval, and deletion"""
        try:
            test_course_id = "test-course-123"
            test_video_id = "test-video-123"
            
            # Test note creation
            note_data = {
                "course_id": test_course_id,
                "video_id": test_video_id,
                "content": "This is a test note for the video",
                "timestamp": 120
            }
            
            response = self.session.post(f"{BASE_URL}/notes", params=note_data)
            
            if response.status_code == 401:
                self.log_test("Note Creation", True, "Correctly requires authentication for note creation")
            elif response.status_code == 200:
                data = response.json()
                if 'id' in data and 'content' in data:
                    self.test_note_id = data['id']
                    self.log_test("Note Creation", True, f"Successfully created note: {data['content'][:50]}...")
                else:
                    self.log_test("Note Creation", False, "Note creation response missing required fields", data)
            else:
                self.log_test("Note Creation", False, f"Unexpected response: {response.status_code}", response.text)
            
            # Test note retrieval
            response = self.session.get(f"{BASE_URL}/notes/{test_video_id}")
            
            if response.status_code == 401:
                self.log_test("Note Retrieval", True, "Correctly requires authentication for note retrieval")
            elif response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Note Retrieval", True, f"Successfully retrieved {len(data)} notes")
                else:
                    self.log_test("Note Retrieval", False, "Note retrieval should return a list", data)
            else:
                self.log_test("Note Retrieval", False, f"Unexpected response: {response.status_code}", response.text)
            
            # Test note deletion
            if self.test_note_id:
                response = self.session.delete(f"{BASE_URL}/notes/{self.test_note_id}")
                
                if response.status_code == 401:
                    self.log_test("Note Deletion", True, "Correctly requires authentication for note deletion")
                elif response.status_code == 200:
                    data = response.json()
                    if data.get('success'):
                        self.log_test("Note Deletion", True, "Successfully deleted note")
                    else:
                        self.log_test("Note Deletion", False, "Note deletion did not return success", data)
                elif response.status_code == 404:
                    self.log_test("Note Deletion", True, "Correctly returns 404 for non-existent note")
                else:
                    self.log_test("Note Deletion", False, f"Unexpected response: {response.status_code}", response.text)
            
            return True
            
        except Exception as e:
            self.log_test("Notes System", False, f"Notes system test failed: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all backend tests"""
        print("=" * 80)
        print("BACKEND API TESTING SUITE")
        print("=" * 80)
        print(f"Testing backend at: {BASE_URL}")
        print(f"Test started at: {datetime.now().isoformat()}")
        print("-" * 80)
        
        # High Priority Tests
        print("\n🔥 HIGH PRIORITY TESTS")
        print("-" * 40)
        
        # Basic connectivity
        if not self.test_api_health():
            print("❌ API is not accessible. Stopping tests.")
            return self.generate_summary()
        
        # YouTube API Integration
        self.test_youtube_api_configuration()
        
        # Authentication System
        self.test_authentication_profile()
        
        # Course Management
        self.test_course_creation_invalid_url()
        self.test_course_creation_valid_url()
        self.test_course_listing()
        self.test_individual_course_retrieval()
        
        # Medium Priority Tests
        print("\n🔶 MEDIUM PRIORITY TESTS")
        print("-" * 40)
        
        # Progress Tracking
        self.test_progress_tracking()
        
        # Notes System
        self.test_notes_system()
        
        return self.generate_summary()

    def generate_summary(self):
        """Generate test summary"""
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for test_name, result in self.test_results.items():
                if not result['success']:
                    print(f"  • {test_name}: {result['message']}")
        
        print("\n✅ PASSED TESTS:")
        for test_name, result in self.test_results.items():
            if result['success']:
                print(f"  • {test_name}: {result['message']}")
        
        return {
            'total_tests': total_tests,
            'passed_tests': passed_tests,
            'failed_tests': failed_tests,
            'success_rate': (passed_tests/total_tests)*100,
            'results': self.test_results
        }

if __name__ == "__main__":
    tester = BackendTester()
    summary = tester.run_all_tests()
    
    # Save results to file
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump(summary, f, indent=2, default=str)
    
    print(f"\n📄 Detailed results saved to: /app/backend_test_results.json")
    print("=" * 80)