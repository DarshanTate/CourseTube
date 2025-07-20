from fastapi import FastAPI, APIRouter, HTTPException, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import requests
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# YouTube API Configuration
YOUTUBE_API_KEY = os.environ.get('YOUTUBE_API_KEY')
YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Video(BaseModel):
    id: str
    title: str
    description: str
    thumbnail_url: str
    duration: Optional[str] = None
    published_at: str

class Course(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    description: str
    playlist_id: str
    playlist_url: str
    thumbnail_url: str
    videos: List[Video]
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CreateCourseRequest(BaseModel):
    playlist_url: str

class Note(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    course_id: str
    video_id: str
    content: str
    timestamp: int  # seconds
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Progress(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    course_id: str
    video_id: str
    watched: bool = False
    watch_time: int = 0  # seconds watched
    last_position: int = 0  # last position in seconds
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Session(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Helper functions
def extract_playlist_id(url: str) -> str:
    """Extract playlist ID from YouTube URL"""
    if "list=" in url:
        return url.split("list=")[1].split("&")[0]
    raise HTTPException(status_code=400, detail="Invalid YouTube playlist URL")

async def get_playlist_details(playlist_id: str):
    """Fetch playlist details from YouTube API"""
    url = f"{YOUTUBE_API_BASE}/playlists"
    params = {
        "part": "snippet,contentDetails",
        "id": playlist_id,
        "key": YOUTUBE_API_KEY
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)
        data = response.json()
        
        if not data.get("items"):
            raise HTTPException(status_code=404, detail="Playlist not found")
        
        return data["items"][0]

async def get_playlist_videos(playlist_id: str):
    """Fetch all videos from a YouTube playlist"""
    videos = []
    next_page_token = None
    
    while True:
        url = f"{YOUTUBE_API_BASE}/playlistItems"
        params = {
            "part": "snippet,contentDetails",
            "playlistId": playlist_id,
            "key": YOUTUBE_API_KEY,
            "maxResults": 50
        }
        
        if next_page_token:
            params["pageToken"] = next_page_token
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            data = response.json()
            
            for item in data.get("items", []):
                snippet = item["snippet"]
                video = Video(
                    id=snippet["resourceId"]["videoId"],
                    title=snippet["title"],
                    description=snippet["description"],
                    thumbnail_url=snippet["thumbnails"]["high"]["url"] if "high" in snippet["thumbnails"] else snippet["thumbnails"]["default"]["url"],
                    published_at=snippet["publishedAt"]
                )
                videos.append(video)
            
            next_page_token = data.get("nextPageToken")
            if not next_page_token:
                break
    
    return videos

async def get_current_user(session_id: str = Header(None, alias="X-Session-ID")):
    """Get current user from session"""
    if not session_id:
        raise HTTPException(status_code=401, detail="Session ID required")
    
    session = await db.sessions.find_one({"session_token": session_id})
    if not session or session["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    user = await db.users.find_one({"id": session["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user)

# Authentication endpoints
@api_router.get("/auth/profile")
async def get_profile(session_id: str = Header(None, alias="X-Session-ID")):
    """Get user profile using emergent auth"""
    if not session_id:
        return {"error": "No session ID provided"}
    
    try:
        # Call emergent auth API
        headers = {"X-Session-ID": session_id}
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers=headers
            )
            
            if response.status_code != 200:
                return {"error": "Invalid session"}
            
            user_data = response.json()
            
            # Check if user exists, if not create
            existing_user = await db.users.find_one({"email": user_data["email"]})
            if not existing_user:
                new_user = User(
                    email=user_data["email"],
                    name=user_data["name"],
                    picture=user_data.get("picture")
                )
                await db.users.insert_one(new_user.dict())
                user_id = new_user.id
            else:
                user_id = existing_user["id"]
            
            # Create session
            from datetime import timedelta
            session = Session(
                user_id=user_id,
                session_token=user_data["session_token"],
                expires_at=datetime.utcnow() + timedelta(days=7)
            )
            await db.sessions.insert_one(session.dict())
            
            return {
                "user": {
                    "id": user_id,
                    "email": user_data["email"],
                    "name": user_data["name"],
                    "picture": user_data.get("picture")
                },
                "session_token": user_data["session_token"]
            }
    
    except Exception as e:
        return {"error": str(e)}

# Course endpoints
@api_router.post("/courses", response_model=Course)
async def create_course(request: CreateCourseRequest, current_user: User = Header(..., convert_underscores=False)):
    """Create a course from YouTube playlist"""
    try:
        playlist_id = extract_playlist_id(request.playlist_url)
        
        # Get playlist details
        playlist_details = await get_playlist_details(playlist_id)
        playlist_snippet = playlist_details["snippet"]
        
        # Get all videos
        videos = await get_playlist_videos(playlist_id)
        
        # Create course
        course = Course(
            user_id=current_user.id,
            title=playlist_snippet["title"],
            description=playlist_snippet["description"],
            playlist_id=playlist_id,
            playlist_url=request.playlist_url,
            thumbnail_url=playlist_snippet["thumbnails"]["high"]["url"] if "high" in playlist_snippet["thumbnails"] else playlist_snippet["thumbnails"]["default"]["url"],
            videos=videos
        )
        
        await db.courses.insert_one(course.dict())
        return course
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/courses", response_model=List[Course])
async def get_user_courses(current_user: User = Header(..., convert_underscores=False)):
    """Get all courses for current user"""
    courses_data = await db.courses.find({"user_id": current_user.id}).to_list(100)
    return [Course(**course) for course in courses_data]

@api_router.get("/courses/{course_id}", response_model=Course)
async def get_course(course_id: str, current_user: User = Header(..., convert_underscores=False)):
    """Get specific course"""
    course_data = await db.courses.find_one({"id": course_id, "user_id": current_user.id})
    if not course_data:
        raise HTTPException(status_code=404, detail="Course not found")
    return Course(**course_data)

# Progress endpoints
@api_router.post("/progress")
async def update_progress(
    course_id: str,
    video_id: str,
    watched: bool = False,
    watch_time: int = 0,
    last_position: int = 0,
    current_user: User = Header(..., convert_underscores=False)
):
    """Update video progress"""
    progress_data = {
        "user_id": current_user.id,
        "course_id": course_id,
        "video_id": video_id,
        "watched": watched,
        "watch_time": watch_time,
        "last_position": last_position,
        "updated_at": datetime.utcnow()
    }
    
    await db.progress.update_one(
        {"user_id": current_user.id, "course_id": course_id, "video_id": video_id},
        {"$set": progress_data},
        upsert=True
    )
    
    return {"success": True}

@api_router.get("/progress/{course_id}")
async def get_course_progress(course_id: str, current_user: User = Header(..., convert_underscores=False)):
    """Get progress for all videos in a course"""
    progress_data = await db.progress.find({
        "user_id": current_user.id,
        "course_id": course_id
    }).to_list(1000)
    
    return {item["video_id"]: item for item in progress_data}

# Notes endpoints
@api_router.post("/notes", response_model=Note)
async def create_note(
    course_id: str,
    video_id: str,
    content: str,
    timestamp: int,
    current_user: User = Header(..., convert_underscores=False)
):
    """Create a note for a video"""
    note = Note(
        user_id=current_user.id,
        course_id=course_id,
        video_id=video_id,
        content=content,
        timestamp=timestamp
    )
    
    await db.notes.insert_one(note.dict())
    return note

@api_router.get("/notes/{video_id}", response_model=List[Note])
async def get_video_notes(video_id: str, current_user: User = Header(..., convert_underscores=False)):
    """Get all notes for a video"""
    notes_data = await db.notes.find({
        "user_id": current_user.id,
        "video_id": video_id
    }).sort("timestamp", 1).to_list(1000)
    
    return [Note(**note) for note in notes_data]

@api_router.delete("/notes/{note_id}")
async def delete_note(note_id: str, current_user: User = Header(..., convert_underscores=False)):
    """Delete a note"""
    result = await db.notes.delete_one({
        "id": note_id,
        "user_id": current_user.id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    
    return {"success": True}

# Test endpoints
@api_router.get("/")
async def root():
    return {"message": "YouTube Course Converter API"}

@api_router.get("/test")
async def test_endpoint():
    return {"message": "API is working!", "youtube_api_configured": bool(YOUTUBE_API_KEY)}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()