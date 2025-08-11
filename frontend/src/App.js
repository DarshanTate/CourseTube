import React, { useState, useEffect, createContext, useContext } from 'react';
import "./App.css";
import axios from "axios";
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [sessionToken, setSessionToken] = useState(localStorage.getItem('session_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionToken) {
      console.log('Validating existing session token');
      validateSession();
    } else {
      console.log('No session found, setting loading to false');
      setLoading(false);
    }
  }, []);

  const handleGoogleSuccess = async (credentialResponse) => {
    console.log('Google login successful, sending credential to backend');
    setLoading(true);

    try {
        const response = await axios.post(`${API}/auth/google`, { credential: credentialResponse.credential });
        const { session_token, user } = response.data;

        setUser(user);
        setSessionToken(session_token);
        localStorage.setItem('session_token', session_token);

        console.log('Successfully logged in with Google');
    } catch (error) {
        console.error('Google login failed:', error);
        console.error('Error details:', error.response?.data);
        alert('Google login failed: ' + (error.response?.data?.detail || error.message));
    } finally {
        setLoading(false);
    }
  };

  const handleGoogleError = () => {
    console.log('Google Login Failed');
    setLoading(false);
  };

  const validateSession = async () => {
    console.log('Validating session token:', sessionToken);
    try {
      const response = await axios.get(`${API}/auth/profile`, {
        headers: { 'X-Session-ID': sessionToken }
      });
      
      console.log('Session validation response:', response.data);
      
      if (response.data.user) {
        console.log('Session is valid, setting user:', response.data.user);
        setUser(response.data.user);
      }
    } catch (error) {
      console.error('Session validation error:', error);
      console.error('Error details:', error.response?.data);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await axios.get(`${API}/auth/logout`, {
        headers: { 'X-Session-ID': sessionToken }
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
    setUser(null);
    setSessionToken(null);
    localStorage.removeItem('session_token');
  };

  return (
    <AuthContext.Provider value={{ user, logout, loading, sessionToken, handleGoogleSuccess, handleGoogleError }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const Header = () => {
  const { user, logout, handleGoogleSuccess, handleGoogleError } = useAuth();

  return (
    <header className="bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-2">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
            <h1 className="text-xl font-bold">CourseTube</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  {user.picture && (
                    <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full" />
                  )}
                  <span className="text-sm font-medium">{user.name}</span>
                </div>
                <button
                  onClick={logout}
                  className="bg-red-800 hover:bg-red-900 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                size="large"
                theme="filled_white"
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

const Landing = () => {
  const { handleGoogleSuccess, handleGoogleError } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Transform YouTube Playlists into
            <span className="text-red-600 block">Structured Courses</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Convert any YouTube playlist into an organized learning experience. Track your progress, 
            take notes with timestamps, and never lose your place again.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                size="large"
                theme="filled_white"
                text="signin_with"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">Instant Import</h3>
            <p className="text-gray-600">Simply paste any YouTube playlist URL and we'll automatically import all videos with their metadata.</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">Smart Notes</h3>
            <p className="text-gray-600">Take notes with precise timestamps. Click any note to jump directly to that moment in the video.</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">Progress Tracking</h3>
            <p className="text-gray-600">Visual progress indicators show your completion status and help you stay motivated throughout your learning journey.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { user, sessionToken } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (sessionToken) {
      fetchCourses();
    }
  }, [sessionToken]);

  const fetchCourses = async () => {
    try {
      const response = await axios.get(`${API}/courses`, {
        headers: { 'X-Session-ID': sessionToken }
      });
      setCourses(response.data);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const createCourse = async (e) => {
    e.preventDefault();
    if (!playlistUrl.trim()) return;

    setCreating(true);
    try {
      const response = await axios.post(`${API}/courses`, {
        playlist_url: playlistUrl
      }, {
        headers: { 'X-Session-ID': sessionToken }
      });
      
      setCourses(prev => [response.data, ...prev]);
      setPlaylistUrl('');
      setShowCreateForm(false);
    } catch (error) {
      console.error('Error creating course:', error);
      alert('Error creating course. Please check the playlist URL and try again.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your courses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Courses</h1>
            <p className="text-gray-600 mt-2">Manage your YouTube playlist courses</p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Import Playlist</span>
          </button>
        </div>

        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-xl font-bold mb-4">Import YouTube Playlist</h2>
              <form onSubmit={createCourse}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    YouTube Playlist URL
                  </label>
                  <input
                    type="url"
                    value={playlistUrl}
                    onChange={(e) => setPlaylistUrl(e.target.value)}
                    placeholder="https://youtube.com/playlist?list=..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {setShowCreateForm(false); setPlaylistUrl('');}}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {creating ? 'Importing...' : 'Import'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {courses.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 011 1v2a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1h4zM7 8v10a2 2 0 002 2h6a2 2 0 002-2V8H7z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No courses yet</h3>
            <p className="text-gray-600 mb-4">Import your first YouTube playlist to get started</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Import Playlist
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map(course => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const CourseCard = ({ course }) => {
  return (
    <div className="bg-white rounded-xl shadow-lg border hover:shadow-xl transition-shadow">
      <div className="aspect-video bg-gray-200 rounded-t-xl overflow-hidden">
        <img 
          src={course.thumbnail_url} 
          alt={course.title}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-2 line-clamp-2">{course.title}</h3>
        <p className="text-gray-600 text-sm mb-4 line-clamp-3">{course.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">{course.videos.length} videos</span>
          <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Start Learning
          </button>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      {user ? <Dashboard /> : <Landing />}
    </div>
  );
};

// ...
const AppWithAuth = () => (
  <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <App />
      </AuthProvider>
  </GoogleOAuthProvider>
);
// ...

export default AppWithAuth;