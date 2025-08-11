from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import httpx
from contextlib import asynccontextmanager
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import uuid

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

YOUTUBE_API_KEY = os.environ.get('YOUTUBE_API_KEY')
YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: Optional[str] = None
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
    timestamp: int
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Progress(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    course_id: str
    video_id: str
    watched: bool = False
    watch_time: int = 0
    last_position: int = 0
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Session(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)

class GoogleLoginRequest(BaseModel):
    credential: str

def extract_playlist_id(url: str) -> str:
    if "list=" in url:
        return url.split("list=")[1].split("&")[0]
    raise HTTPException(status_code=400, detail="Invalid YouTube playlist URL")

async def get_playlist_details(playlist_id: str):
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
                    thumbnail_url=snippet["thumbnails"].get("high", snippet["thumbnails"]["default"])["url"],
                    published_at=snippet["publishedAt"]
                )
                videos.append(video)
            next_page_token = data.get("nextPageToken")
            if not next_page_token:
                break
    return videos

async def verify_google_token(token: str) -> Dict[str, str]:
    try:
        id_info = id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID)
        if id_info.get("iss") not in ["accounts.google.com", "https://accounts.google.com"]:
            raise ValueError("Wrong issuer.")
        return {
            "id": id_info.get("sub"),
            "email": id_info.get("email"),
            "name": id_info.get("name"),
            "picture": id_info.get("picture"),
        }
    except ValueError as e:
        logger.error(f"Failed to verify Google token: {e}")
        raise HTTPException(status_code=401, detail="Invalid Google token")

async def get_current_user(session_id: str = Header(None, alias="X-Session-ID")):
    if not session_id:
        raise HTTPException(status_code=401, detail="Session ID required")
    session = await db.sessions.find_one({"session_token": session_id})
    if not session or session["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    user = await db.users.find_one({"id": session["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user)

@api_router.post("/auth/google")
async def google_login(payload: GoogleLoginRequest):
    user_info = await verify_google_token(payload.credential)
    
    db_user = await db.users.find_one({"id": user_info['id']})
    
    if not db_user:
        new_user = User(
            id=user_info['id'],
            email=user_info['email'],
            name=user_info.get('name'),
            picture=user_info.get('picture'),
        )
        await db.users.insert_one(new_user.dict())
        db_user = new_user.dict()

    session_token = str(uuid.uuid4())
    session = Session(
        user_id=db_user["id"],
        session_token=session_token,
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    await db.sessions.insert_one(session.dict())
    
    return {
        "message": "Login successful",
        "session_token": session_token,
        "user": {
            "id": db_user['id'],
            "email": db_user['email'],
            "name": db_user['name'],
            "picture": db_user['picture'],
        }
    }

@api_router.get("/auth/logout")
async def logout(current_user: User = Depends(get_current_user)):
    await db.sessions.delete_many({"user_id": current_user.id})
    return {"message": "Logged out successfully"}

@api_router.get("/auth/profile")
async def get_profile(current_user: User = Depends(get_current_user)):
    return {"user": current_user}

@api_router.post("/courses", response_model=Course)
async def create_course(request: CreateCourseRequest, current_user: User = Depends(get_current_user)):
    playlist_id = extract_playlist_id(request.playlist_url)
    playlist_details = await get_playlist_details(playlist_id)
    snippet = playlist_details["snippet"]
    videos = await get_playlist_videos(playlist_id)
    course = Course(
        user_id=current_user.id,
        title=snippet["title"],
        description=snippet["description"],
        playlist_id=playlist_id,
        playlist_url=request.playlist_url,
        thumbnail_url=snippet["thumbnails"].get("high", snippet["thumbnails"]["default"])["url"],
        videos=videos
    )
    await db.courses.insert_one(course.dict())
    return course

@api_router.get("/courses", response_model=List[Course])
async def get_user_courses(current_user: User = Depends(get_current_user)):
    courses_data = await db.courses.find({"user_id": current_user.id}).to_list(100)
    return [Course(**course) for course in courses_data]

@api_router.get("/courses/{course_id}", response_model=Course)
async def get_course(course_id: str, current_user: User = Depends(get_current_user)):
    course_data = await db.courses.find_one({"id": course_id, "user_id": current_user.id})
    if not course_data:
        raise HTTPException(status_code=404, detail="Course not found")
    return Course(**course_data)

@api_router.post("/progress")
async def update_progress(course_id: str, video_id: str, watched: bool = False, watch_time: int = 0, last_position: int = 0, current_user: User = Depends(get_current_user)):
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
async def get_course_progress(course_id: str, current_user: User = Depends(get_current_user)):
    progress_data = await db.progress.find({"user_id": current_user.id, "course_id": course_id}).to_list(1000)
    return {item["video_id"]: item for item in progress_data}

@api_router.post("/notes", response_model=Note)
async def create_note(course_id: str, video_id: str, content: str, timestamp: int, current_user: User = Depends(get_current_user)):
    note = Note(user_id=current_user.id, course_id=course_id, video_id=video_id, content=content, timestamp=timestamp)
    await db.notes.insert_one(note.dict())
    return note

@api_router.get("/notes/{video_id}", response_model=List[Note])
async def get_video_notes(video_id: str, current_user: User = Depends(get_current_user)):
    notes_data = await db.notes.find({"user_id": current_user.id, "video_id": video_id}).sort("timestamp", 1).to_list(1000)
    return [Note(**note) for note in notes_data]

@api_router.delete("/notes/{note_id}")
async def delete_note(note_id: str, current_user: User = Depends(get_current_user)):
    result = await db.notes.delete_one({"id": note_id, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"success": True}

@api_router.get("/")
async def root():
    return {"message": "YouTube Course Converter API"}

@api_router.get("/test")
async def test_endpoint():
    return {"message": "API is working!", "youtube_api_configured": bool(YOUTUBE_API_KEY)}

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    client.close()

app = FastAPI(lifespan=lifespan)
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)