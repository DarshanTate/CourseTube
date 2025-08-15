import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import "./App.css";
import axios from "axios";
import ReactPlayer from 'react-player/youtube';
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "firebase/auth";
import CourseDetails from './CourseDetails';

const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [idToken, setIdToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const token = await firebaseUser.getIdToken();
                setIdToken(token);
                setUser({
                    name: firebaseUser.displayName,
                    email: firebaseUser.email,
                    picture: firebaseUser.photoURL,
                    uid: firebaseUser.uid,
                });
            } else {
                setUser(null);
                setIdToken(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        setLoading(true);
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Firebase Google login failed:", error);
            alert("Firebase Google login failed: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Firebase logout failed:", error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, logout, loading, signInWithGoogle, idToken }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

const ThemeToggle = () => {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
      const savedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
        setIsDark(true);
      }
    }, []);

    const toggleTheme = () => {
      if (isDark) {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
        setIsDark(false);
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        setIsDark(true);
      }
    };

    return (
        <button onClick={toggleTheme} className="p-2 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-colors">
            {isDark ? (
                <svg className="w-5 h-5 text-yellow-300" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 10a1 1 0 11-2 0 1 1 0 012 0zM9.293 2.293a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zM3 10a1 1 0 012 0 1 1 0 01-2 0zm1.707 5.707a1 1 0 01-1.414 0l-.707-.707a1 1 0 011.414-1.414l.707.707a1 1 0 010 1.414z" clipRule="evenodd"></path>
                </svg>
            ) : (
                <svg className="w-5 h-5 text-gray-800" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.293 13.707a.5.5 0 00-.707 0L12 18.293l-4.586-4.586a.5.5 0 10-.707.707l5 5a.5.5 0 00.707 0l5-5a.5.5 0 000-.707z"></path>
                    <path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zM3 10a7 7 0 1114 0 7 7 0 01-14 0z" clipRule="evenodd"></path>
                    <path d="M10 3a1 1 0 100 2 1 1 0 000-2z" fillRule="evenodd" clipRule="evenodd"></path>
                </svg>
            )}
        </button>
    );
};

const Header = () => {
    const { user, logout, signInWithGoogle } = useAuth();
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
                        <ThemeToggle />
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
                            <button
                                onClick={signInWithGoogle}
                                className="bg-white text-red-600 hover:bg-gray-100 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                                Sign in with Google
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

const Landing = () => {
    const { signInWithGoogle } = useAuth();
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-black text-gray-900 dark:text-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
                <div className="text-center">
                    <h1 className="text-5xl md:text-6xl font-bold mb-6">
                        Transform YouTube Playlists into
                        <span className="text-red-600 block">Structured Courses</span>
                    </h1>
                    <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-3xl mx-auto">
                        Convert any YouTube playlist into an organized learning experience. Track your progress,
                        take notes with timestamps, and never lose your place again.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={signInWithGoogle}
                            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors"
                        >
                            Sign in with Google
                        </button>
                    </div>
                </div>
            </div>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="grid md:grid-cols-3 gap-8">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border dark:border-gray-700">
                        <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-red-600 dark:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold mb-3">Instant Import</h3>
                        <p className="text-gray-600 dark:text-gray-400">Simply paste any YouTube playlist URL and we'll automatically import all videos with their metadata.</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border dark:border-gray-700">
                        <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-red-600 dark:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold mb-3">Smart Notes</h3>
                        <p className="text-gray-600 dark:text-gray-400">Take notes with precise timestamps. Click any note to jump directly to that moment in the video.</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border dark:border-gray-700">
                        <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-red-600 dark:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold mb-3">Progress Tracking</h3>
                        <p className="text-gray-600 dark:text-gray-400">Visual progress indicators show your completion status and help you stay motivated throughout your learning journey.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Dashboard = () => {
    const { idToken } = useAuth();
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [playlistUrl, setPlaylistUrl] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (idToken) { 
            fetchCourses();
        }
    }, [idToken]);

    const fetchCourses = async () => {
        try {
            const response = await axios.get(`${API}/courses`, {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            const fetchedCourses = response.data;
            const coursesWithProgress = await Promise.all(
                fetchedCourses.map(async (course) => {
                    const progressResponse = await axios.get(`${API}/progress/${course.id}`, {
                        headers: { 'Authorization': `Bearer ${idToken}` }
                    });
                    const completedVideos = Object.values(progressResponse.data).filter(p => p.watched).length;
                    return {
                        ...course,
                        progress: (completedVideos / course.videos.length) * 100 || 0,
                    };
                })
            );
            setCourses(coursesWithProgress);
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
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            const newCourse = { ...response.data, progress: 0 };
            setCourses(prev => [newCourse, ...prev]);
            setPlaylistUrl('');
            setShowCreateForm(false);
        } catch (error) {
            console.error('Error creating course:', error);
            alert('Error creating course. Please check the playlist URL and try again.');
        } finally {
            setCreating(false);
        }
    };

    const handleCourseDelete = (courseId) => {
        setCourses(courses.filter(course => course.id !== courseId));
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading your courses...</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">My Courses</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">Manage your YouTube playlist courses</p>
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
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 text-gray-900 dark:text-gray-100">
                            <h2 className="text-xl font-bold mb-4">Import YouTube Playlist</h2>
                            <form onSubmit={createCourse}>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        YouTube Playlist URL
                                    </label>
                                    <input
                                        type="url"
                                        value={playlistUrl}
                                        onChange={(e) => setPlaylistUrl(e.target.value)}
                                        placeholder="https://youtube.com/playlist?list=..."
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                                        required
                                    />
                                </div>
                                <div className="flex space-x-3">
                                    <button
                                        type="button"
                                        onClick={() => {setShowCreateForm(false); setPlaylistUrl('');}}
                                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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
                    <div className="text-center py-16 text-gray-900 dark:text-gray-100">
                        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-400 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 011 1v2a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1h4zM7 8v10a2 2 0 002 2h6a2 2 0 002-2V8H7z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium mb-2">No courses yet</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">Import your first YouTube playlist to get started</p>
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
                            <CourseCard key={course.id} course={course} idToken={idToken} onDelete={handleCourseDelete} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const CourseCard = ({ course, idToken, onDelete }) => {
    const navigate = useNavigate();

    const handleStartLearning = () => {
        navigate(`/courses/${course.id}`);
    };

    const handleDelete = async (e) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this course?')) {
            try {
                await axios.delete(`${API}/courses/${course.id}`, {
                    headers: { 'Authorization': `Bearer ${idToken}` }
                });
                onDelete(course.id);
            } catch (error) {
                console.error('Error deleting course:', error);
            }
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 hover:shadow-xl transition-shadow relative">
            <div className="aspect-video bg-gray-200 rounded-t-xl overflow-hidden">
                <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    className="w-full h-full object-cover"
                />
            </div>
            <div className="p-6">
                <h3 className="text-lg font-semibold mb-2 line-clamp-2 text-gray-900 dark:text-gray-100">{course.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-3">{course.description}</p>
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{course.videos.length} videos</span>
                    <button
                        onClick={handleStartLearning}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                        Start Learning
                    </button>
                </div>
                {/* Progress Bar */}
                <div className="mt-4">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                        <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${course.progress}%` }}></div>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{Math.floor(course.progress)}% Complete</p>
                </div>
            </div>
            <button
                onClick={handleDelete}
                className="absolute top-2 right-2 p-1 text-red-500 dark:text-red-300 bg-white dark:bg-gray-800 rounded-full hover:bg-red-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Delete course"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-1 12H6L5 7m14 0h-4m-4 0H5m4 0V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                </svg>
            </button>
        </div>
    );
};

const App = () => {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
            </div>
        );
    }
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <Header />
            {user ? <Dashboard /> : <Landing />}
        </div>
    );
};

export default function AppWithAuth() {
    return (
        <AuthProvider>
            <AppRoutes />
        </AuthProvider>
    );
}

const AppRoutes = () => {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
            </div>
        );
    }
    return (
        <Routes>
            <Route path="/" element={<AppWithoutRoutes />} />
            <Route path="/courses/:courseId" element={user ? <CourseDetails /> : <AppWithoutRoutes />} />
        </Routes>
    );
};

const AppWithoutRoutes = () => {
    const { user } = useAuth();
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <Header />
            {user ? <Dashboard /> : <Landing />}
        </div>
    );
};