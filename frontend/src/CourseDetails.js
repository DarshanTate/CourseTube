import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from "axios";
import { useAuth } from './App';
import ReactPlayer from 'react-player/youtube';
import 'jspdf-autotable';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const date = new Date(0);
    date.setSeconds(seconds);
    const timeString = date.toISOString().substr(11, 8);
    return timeString.startsWith('00:') ? timeString.substring(3) : timeString;
};

const CourseDetails = ({ setCourseProgress, setVideoProgress }) => {
    const { courseId } = useParams();
    const { idToken } = useAuth();
    const navigate = useNavigate();
    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [progress, setProgress] = useState({});
    const [descriptionVisible, setDescriptionVisible] = useState(false);
    const [notes, setNotes] = useState([]);
    const [noteContent, setNoteContent] = useState("");
    const [editingNote, setEditingNote] = useState(null);
    const [editingContent, setEditingContent] = useState("");
    const [isEditingCourse, setIsEditingCourse] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [isPlayerReady, setIsPlayerReady] = useState(false);

    const playerRef = useRef(null);

    useEffect(() => {
        if (idToken) {
            fetchCourseDetails();
            fetchCourseProgress();
        }
    }, [courseId, idToken]);

    useEffect(() => {
        if (selectedVideo) {
            fetchNotes(selectedVideo.id);
        }
    }, [selectedVideo]);
    
    useEffect(() => {
        if (selectedVideo && isPlayerReady) {
            const lastPosition = progress[selectedVideo.id]?.last_position || 0;
            playerRef.current.seekTo(lastPosition, 'seconds');
        }
    }, [selectedVideo, progress, isPlayerReady]);

    const fetchCourseDetails = async () => {
        try {
            const response = await axios.get(`${API}/courses/${courseId}`, {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            const courseData = response.data;
            setCourse(courseData);
            setNewTitle(courseData.title);
            setNewDescription(courseData.description);
        } catch (error) {
            console.error('Error fetching course details:', error);
            navigate('/');
        } finally {
            setLoading(false);
        }
    };

    const fetchCourseProgress = async () => {
        try {
            const response = await axios.get(`${API}/progress/${courseId}`, {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            const newProgress = response.data;
            setProgress(newProgress);
            const courseDetailsResponse = await axios.get(`${API}/courses/${courseId}`, {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            const totalVideos = courseDetailsResponse.data.videos.length;
            const completedVideos = Object.values(newProgress).filter(p => p.watched).length;
            const courseCompletion = (completedVideos / totalVideos) * 100 || 0;
            setCourseProgress(courseCompletion);
            const videoToSelect = courseDetailsResponse.data.videos.find(v => newProgress[v.id]?.last_position > 0) || courseDetailsResponse.data.videos[0];
            setSelectedVideo(videoToSelect);
        } catch (error) {
            console.error('Error fetching course progress:', error);
        }
    };

    const fetchNotes = async (videoId) => {
        try {
            const response = await axios.get(`${API}/notes/${videoId}`, {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            setNotes(response.data);
        } catch (error) {
            console.error('Error fetching notes:', error);
        }
    };

    const handleVideoEnd = () => {
        const currentVideoIndex = course.videos.findIndex(v => v.id === selectedVideo.id);
        if (currentVideoIndex !== -1 && currentVideoIndex < course.videos.length - 1) {
            const nextVideo = course.videos[currentVideoIndex + 1];
            setSelectedVideo(nextVideo);
        }
    };

    const handleProgress = async (state) => {
        try {
            const videoDuration = playerRef.current?.getDuration();
            const newVideoProgress = videoDuration > 0 ? (state.playedSeconds / videoDuration) * 100 : 0;
            setVideoProgress(newVideoProgress);
            if (state.playedSeconds > (progress[selectedVideo.id]?.last_position || 0) + 5) {
                const response = await axios.post(`${API}/progress`, {
                    course_id: courseId,
                    video_id: selectedVideo.id,
                    last_position: Math.floor(state.playedSeconds),
                    watched: state.played === 1,
                }, {
                    headers: { 'Authorization': `Bearer ${idToken}` }
                });
                setProgress(prevProgress => ({ ...prevProgress, [selectedVideo.id]: response.data }));
            }
        } catch (error) {
            console.error('Error updating progress:', error);
        }
    };

    const handleVideoSelect = (video) => {
        setSelectedVideo(video);
        setIsPlayerReady(false);
    };

    const handleAddNote = async (e) => {
        e.preventDefault();
        if (!noteContent.trim() || !selectedVideo) return;
        try {
            const currentTime = playerRef.current ? playerRef.current.getCurrentTime() : 0;
            const response = await axios.post(`${API}/notes`, {
                course_id: courseId,
                video_id: selectedVideo.id,
                content: noteContent,
                timestamp: Math.floor(currentTime)
            }, {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            setNotes([...notes, response.data]);
            setNoteContent("");
        } catch (error) {
            console.error('Error adding note:', error);
        }
    };

    const handleUpdateNote = async (noteId) => {
        if (!editingContent.trim()) return;
        try {
            const response = await axios.put(`${API}/notes/${noteId}`, {
                content: editingContent,
            }, {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            setNotes(notes.map(note => note.id === noteId ? response.data : note));
            setEditingNote(null);
            setEditingContent("");
        } catch (error) {
            console.error('Error updating note:', error);
        }
    };

    const handleDeleteNote = async (e, noteId) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this note?')) {
            try {
                await axios.delete(`${API}/notes/${noteId}`, {
                    headers: { 'Authorization': `Bearer ${idToken}` }
                });
                setNotes(notes.filter(note => note.id !== noteId));
            } catch (error) {
                console.error('Error deleting note:', error);
            }
        }
    };

    const handleTimestampClick = (timestamp) => {
        if (playerRef.current) {
            playerRef.current.seekTo(timestamp);
        }
    };

    const handleExportNotes = async () => {
        try {
            const allNotes = [];
            for (const video of course.videos) {
                const response = await axios.get(`${API}/notes/${video.id}`, {
                    headers: { 'Authorization': `Bearer ${idToken}` }
                });
                allNotes.push({ videoTitle: video.title, notes: response.data });
            }

            let docContent = `Course: ${course.title}\n\n`;
            allNotes.forEach(videoNotes => {
                docContent += `Video: ${videoNotes.videoTitle}\n`;
                videoNotes.notes.forEach(note => {
                    docContent += ` - [${formatTime(note.timestamp)}] ${note.content}\n`;
                });
                docContent += `\n`;
            });

            const element = document.createElement("a");
            const file = new Blob([docContent], { type: 'text/plain' });
            element.href = URL.createObjectURL(file);
            element.download = `${course.title}-notes.doc`;
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);

        } catch (error) {
            console.error('Error exporting notes:', error);
        }
    };

    const handleUpdateCourseDetails = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.put(`${API}/courses/${courseId}`,
                {
                    title: newTitle,
                    description: newDescription
                },
                {
                    headers: { 'Authorization': `Bearer ${idToken}` }
                }
            );
            setCourse(response.data);
            setIsEditingCourse(false);
        } catch (error) {
            console.error('Error updating course details:', error);
            alert('Error updating course details. Please try again.');
        }
    };

    if (loading) {
        return <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-900 dark:text-white">Loading...</div>;
    }

    if (!course) {
        return <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-900 dark:text-white">Course not found.</div>;
    }

    return (
        <div className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center mb-8">
                    {isEditingCourse ? (
                        <form onSubmit={handleUpdateCourseDetails} className="flex-1">
                            <input
                                type="text"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                className="text-3xl font-bold bg-transparent border-b border-slate-300 dark:border-slate-700 focus:outline-none"
                            />
                            <textarea
                                value={newDescription}
                                onChange={(e) => setNewDescription(e.target.value)}
                                className="w-full text-slate-600 dark:text-slate-400 mt-2 bg-transparent border-b border-slate-300 dark:border-slate-700 focus:outline-none"
                            />
                            <button type="submit" className="mt-2 bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded-lg text-sm transition-colors">Save</button>
                            <button type="button" onClick={() => setIsEditingCourse(false)} className="mt-2 ml-2 bg-slate-400 hover:bg-slate-500 text-white px-3 py-1 rounded-lg text-sm transition-colors">Cancel</button>
                        </form>
                    ) : (
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold">{course.title}</h1>
                            <p className="text-slate-600 dark:text-slate-400 mt-2">{course.description}</p>
                            <button onClick={() => setIsEditingCourse(true)} className="text-sky-500 hover:underline text-sm mt-2">Edit Details</button>
                        </div>
                    )}
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Main Video & Notes Content */}
                    <div className="lg:col-span-2 space-y-8">
                        {selectedVideo && (
                            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <div className="aspect-video relative">
                                    <ReactPlayer
                                        ref={playerRef}
                                        url={`https://www.youtube.com/watch?v=${selectedVideo.id}`}
                                        controls
                                        width="100%"
                                        height="100%"
                                        onEnded={handleVideoEnd}
                                        onProgress={handleProgress}
                                        onReady={() => setIsPlayerReady(true)}
                                        config={{ youtube: { playerVars: { rel: 0, showinfo: 0 } } }}
                                        className="rounded-xl"
                                    />
                                </div>
                                <div className="p-6">
                                    <h2 className="text-xl font-bold mb-2">{selectedVideo.title}</h2>
                                    <button
                                        onClick={() => setDescriptionVisible(!descriptionVisible)}
                                        className="text-sky-500 hover:underline text-sm"
                                    >
                                        {descriptionVisible ? 'Hide Description' : 'Show Description'}
                                    </button>
                                    {descriptionVisible && (
                                        <p className="text-slate-600 dark:text-slate-400 mt-2 whitespace-pre-wrap">{selectedVideo.description}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold">Your Notes for This Video</h2>
                                <button
                                    onClick={handleExportNotes}
                                    className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Export All Notes
                                </button>
                            </div>
                            <form onSubmit={handleAddNote} className="mb-8">
                                <textarea
                                    className="w-full h-32 p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
                                    value={noteContent}
                                    onChange={(e) => setNoteContent(e.target.value)}
                                    placeholder="Add a new note..."
                                />
                                <button
                                    type="submit"
                                    className="mt-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg font-medium shadow-md"
                                >
                                    Add Note
                                </button>
                            </form>
                            <ul className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                {notes.map(note => (
                                    <li key={note.id} className="bg-slate-100 dark:bg-slate-700 p-4 rounded-lg shadow-sm">
                                        {editingNote === note.id ? (
                                            <div>
                                                <textarea
                                                    className="w-full h-32 p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
                                                    value={editingContent}
                                                    onChange={(e) => setEditingContent(e.target.value)}
                                                />
                                                <div className="flex space-x-2 mt-2">
                                                    <button type="button" onClick={() => handleUpdateNote(note.id)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-sm">Save</button>
                                                    <button type="button" onClick={() => { setEditingNote(null); setEditingContent(""); }} className="bg-slate-400 hover:bg-slate-500 text-white px-3 py-1 rounded-lg text-sm">Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="flex justify-between items-center mb-2">
                                                    <span
                                                        className="text-sm text-slate-500 dark:text-slate-400 cursor-pointer hover:underline"
                                                        onClick={() => handleTimestampClick(note.timestamp)}
                                                    >
                                                        {formatTime(note.timestamp)}
                                                    </span>
                                                    <div className="space-x-2">
                                                        <button
                                                            onClick={() => { setEditingNote(note.id); setEditingContent(note.content); }}
                                                            className="text-sky-500 dark:text-sky-300 hover:text-sky-700 text-sm"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleDeleteNote(e, note.id)}
                                                            className="text-red-500 dark:text-red-300 hover:text-red-700 text-sm"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="text-slate-800 dark:text-slate-200" style={{ whiteSpace: 'pre-wrap' }}>{note.content}</div>
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    {/* Sidebar / Playlist */}
                    <div className="lg:col-span-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 space-y-4 h-fit sticky top-20">
                        <h2 className="text-xl font-bold">Playlist</h2>
                        <ul className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                            {course.videos.map(video => (
                                <li
                                    key={video.id}
                                    className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedVideo?.id === video.id ? 'bg-sky-100 dark:bg-sky-900' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                    onClick={() => handleVideoSelect(video)}
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className="w-16 h-12 flex-shrink-0 bg-slate-200 dark:bg-slate-700 rounded-md overflow-hidden">
                                            <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-sm font-medium line-clamp-2">{video.title}</h3>
                                            {progress[video.id]?.watched && (
                                                <span className="text-xs text-green-500 mt-1">✔ Completed</span>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CourseDetails;