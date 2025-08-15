import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from './App';
import ReactPlayer from 'react-player/youtube';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const formatTime = (seconds) => {
    const date = new Date(0);
    date.setSeconds(seconds);
    const timeString = date.toISOString().substr(11, 8);
    return timeString.startsWith('00:') ? timeString.substring(3) : timeString;
};

const CourseDetails = () => {
    const { courseId } = useParams();
    const { idToken } = useAuth();
    const navigate = useNavigate();
    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [notes, setNotes] = useState([]);
    const [progress, setProgress] = useState({});
    const [noteContent, setNoteContent] = useState('');
    const [descriptionVisible, setDescriptionVisible] = useState(false);
    const playerRef = useRef(null);

    const [editingNote, setEditingNote] = useState(null);
    const [editingContent, setEditingContent] = useState('');

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

    const fetchCourseDetails = async () => {
        try {
            const response = await axios.get(`${API}/courses/${courseId}`, {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            const courseData = response.data;
            setCourse(courseData);
            if (courseData.videos.length > 0) {
                setSelectedVideo(courseData.videos[0]);
            }
        } catch (error) {
            console.error('Error fetching course details:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCourseProgress = async () => {
        try {
            const response = await axios.get(`${API}/progress/${courseId}`, {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            setProgress(response.data);
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
        if (state.playedSeconds > (progress[selectedVideo.id]?.last_position || 0) + 5) {
            try {
                await axios.post(`${API}/progress`, {
                    course_id: courseId,
                    video_id: selectedVideo.id,
                    watch_time: state.playedSeconds,
                    last_position: state.playedSeconds,
                    watched: state.played === 1,
                }, {
                    headers: { 'Authorization': `Bearer ${idToken}` }
                });
            } catch (error) {
                console.error('Error updating progress:', error);
            }
        }
    };

    const handleAddNote = async (e) => {
        e.preventDefault();
        if (!noteContent || noteContent.trim() === '<p><br></p>' || !selectedVideo) return;
        
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
            setNoteContent('');
        } catch (error) {
            console.error('Error adding note:', error);
        }
    };

    const handleUpdateNote = async (noteId) => {
        if (!editingContent || editingContent.trim() === '<p><br></p>') return;

        try {
            const response = await axios.put(`${API}/notes/${noteId}`, {
                content: editingContent,
            }, {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });

            setNotes(notes.map(note => note.id === noteId ? response.data : note));
            setEditingNote(null);
            setEditingContent('');
        } catch (error) {
            console.error('Error updating note:', error);
        }
    };

    const handleTimestampClick = (timestamp) => {
        if (playerRef.current) {
            playerRef.current.seekTo(timestamp);
        }
    };

    const handleDeleteNote = async (e, noteId) => {
        e.stopPropagation();
        try {
            await axios.delete(`${API}/notes/${noteId}`, {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            setNotes(notes.filter(note => note.id !== noteId));
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    };

    const handleExportPdf = () => {
        const doc = new jsPDF();
        doc.text(`Notes for ${course.title}`, 14, 20);
        doc.autoTable({
            startY: 30,
            head: [['Timestamp', 'Note']],
            body: notes.map(note => [formatTime(note.timestamp), note.content]),
            styles: { fontSize: 10 },
            headStyles: { fillColor: [239, 68, 68] },
        });
        doc.save(`${course.title}-notes.pdf`);
    };

    const handleExportDoc = () => {
        const textContent = notes.map(note => `[${formatTime(note.timestamp)}] ${note.content.replace(/<[^>]*>?/gm, '')}`).join('\n');
        const element = document.createElement("a");
        const file = new Blob([textContent], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = `${course.title}-notes.doc`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    if (loading) {
        return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-900 dark:text-gray-100">Loading...</div>;
    }

    if (!course) {
        return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-900 dark:text-gray-100">Course not found.</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center space-x-4 mb-8">
                    <button onClick={() => navigate(-1)} className="p-2 border rounded-full bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold">{course.title}</h1>
                        <p className="text-gray-600 dark:text-gray-400">{course.description}</p>
                    </div>
                </div>
                <div className="grid lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        {selectedVideo && (
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 overflow-hidden">
                                <div className="aspect-video">
                                    <ReactPlayer
                                        ref={playerRef}
                                        url={`https://www.youtube.com/watch?v=${selectedVideo.id}`}
                                        controls
                                        width="100%"
                                        height="100%"
                                        onEnded={handleVideoEnd}
                                        onProgress={handleProgress}
                                        config={{ youtube: { playerVars: { rel: 0, showinfo: 0 } } }}
                                        className="rounded-xl"
                                    />
                                </div>
                                <div className="p-6">
                                    <h2 className="text-xl font-bold mb-2">{selectedVideo.title}</h2>
                                    <button
                                        onClick={() => setDescriptionVisible(!descriptionVisible)}
                                        className="text-red-500 hover:underline text-sm"
                                    >
                                        {descriptionVisible ? 'Hide Description' : 'Show Description'}
                                    </button>
                                    {descriptionVisible && (
                                        <p className="text-gray-600 dark:text-gray-400 mt-2 whitespace-pre-wrap">{selectedVideo.description}</p>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold">Your Notes</h2>
                                <div className="space-x-2">
                                    <button 
                                        onClick={handleExportDoc} 
                                        className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Export as Doc
                                    </button>
                                    <button 
                                        onClick={handleExportPdf} 
                                        className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Export as PDF
                                    </button>
                                </div>
                            </div>
                            <form onSubmit={handleAddNote} className="mb-4">
                                <ReactQuill 
                                    theme="snow" 
                                    value={noteContent} 
                                    onChange={setNoteContent}
                                    className="h-32 mb-12 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                />
                                <button
                                    type="submit"
                                    className="mt-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium"
                                >
                                    Add Note
                                </button>
                            </form>
                            <ul className="space-y-4">
                                {notes.map(note => (
                                    <li key={note.id} className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
                                        {editingNote === note.id ? (
                                            <div>
                                                <ReactQuill
                                                    theme="snow"
                                                    value={editingContent}
                                                    onChange={setEditingContent}
                                                    className="h-32 mb-12 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                                />
                                                <div className="flex space-x-2 mt-2">
                                                    <button onClick={() => handleUpdateNote(note.id)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-sm">Save</button>
                                                    <button onClick={() => setEditingNote(null)} className="bg-gray-400 hover:bg-gray-500 text-white px-3 py-1 rounded-lg text-sm">Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="flex justify-between items-center mb-2">
                                                    <span 
                                                        className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:underline" 
                                                        onClick={() => handleTimestampClick(note.timestamp)}
                                                    >
                                                        {formatTime(note.timestamp)}
                                                    </span>
                                                    <div className="space-x-2">
                                                        <button 
                                                            onClick={() => { setEditingNote(note.id); setEditingContent(note.content); }}
                                                            className="text-blue-500 dark:text-blue-300 hover:text-blue-700 text-sm"
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
                                                <div className="text-gray-800 dark:text-gray-200" dangerouslySetInnerHTML={{ __html: note.content }} />
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 p-6 space-y-4 h-fit sticky top-8">
                        <h2 className="text-xl font-bold">Playlist</h2>
                        <ul className="space-y-2">
                            {course.videos.map(video => (
                                <li
                                    key={video.id}
                                    className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedVideo?.id === video.id ? 'bg-red-100 dark:bg-red-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                    onClick={() => setSelectedVideo(video)}
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className="w-16 h-12 flex-shrink-0 bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden">
                                            <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-sm font-medium line-clamp-2">{video.title}</h3>
                                            {progress[video.id]?.watched && (
                                                <span className="text-xs text-green-600 mt-1">✓ Completed</span>
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