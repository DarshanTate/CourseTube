import React from 'react';
import { useAuth } from './App';

const ProfilePage = () => {
    const { user, logout } = useAuth();
    
    if (!user) {
        return <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-900 dark:text-white">Please sign in to view this page.</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white py-8">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
                    <h1 className="text-3xl font-bold mb-6">Profile Settings</h1>
                    <div className="space-y-6">
                        <div className="flex items-center space-x-4">
                            {user.picture && (
                                <img src={user.picture} alt="Profile" className="w-20 h-20 rounded-full border-2 border-sky-500" />
                            )}
                            <div>
                                <h2 className="text-xl font-semibold">{user.name}</h2>
                                <p className="text-slate-600 dark:text-slate-400">{user.email}</p>
                            </div>
                        </div>
                        <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                            <h3 className="text-lg font-semibold mb-2">Account Actions</h3>
                            <button
                                onClick={logout}
                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                            >
                                Logout
                            </button>
                        </div>
                        {/* You can add more settings here */}
                        <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                            <h3 className="text-lg font-semibold mb-2">Theme Preference</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Your theme preference is saved automatically.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;