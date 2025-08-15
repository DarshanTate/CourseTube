from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from datetime import datetime
import httpx
from contextlib import asynccontextmanager
import uuid

import firebase_admin
from firebase_admin import credentials, auth

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Initialize Firebase Admin SDK
try:
    cred_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY_PATH")
    if cred_path:
        cred = credentials.Certificate(ROOT_DIR / cred_path)
        firebase_admin.initialize_app(cred)
    else:
        logger.warning("FIREBASE_SERVICE_ACCOUNT_KEY_PATH not set. Firebase Admin SDK will not be initialized.")
except Exception as e:
    logger.error(f"Failed to initialize Firebase Admin SDK: {e}")

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

YOUTUBE_API_KEY = os.environ.get('YOUTUBE_API_KEY')
YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"

class User(BaseModel):
    id: str
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
    
class UpdateNoteRequest(BaseModel):
    content: str

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
            
            thumbnails = snippet["thumbnails"]
            thumbnail_url = thumbnails.get("high", thumbnails.get("default", {})).get("url", "")
            
            video = Video(
                id=snippet["resourceId"]["videoId"],
                title=snippet["title"],
                description=snippet["description"],
                thumbnail_url=thumbnail_url,
                published_at=snippet["publishedAt"]
            )
            videos.append(video)
        next_page_token = data.get("nextPageToken")
        if not next_page_token:
            break
    return videos

# --- Firebase-specific backend logic ---
async def get_current_user_firebase(id_token: str = Header(None, alias="Authorization")):
    if not id_token or not id_token.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    token = id_token.split(" ")[1]
    
    try:
        decoded_token = auth.verify_id_token(token)
        user_id = decoded_token['uid']
        user_email = decoded_token['email']
        user_name = decoded_token.get('name')
        user_picture = decoded_token.get('picture')
        
        db_user = await db.users.find_one({"id": user_id})
        if not db_user:
            new_user = User(
                id=user_id,
                email=user_email,
                name=user_name,
                picture=user_picture,
            )
            await db.users.insert_one(new_user.dict())
            db_user = new_user.dict()
            
        return User(**db_user)
        
    except auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    except Exception as e:
        logger.error(f"Error during Firebase token verification: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.post("/auth/login")
async def firebase_login(current_user: User = Depends(get_current_user_firebase)):
    return {"message": "Login successful", "user": current_user}

@api_router.get("/auth/profile")
async def get_profile(current_user: User = Depends(get_current_user_firebase)):
    return {"user": current_user}

@api_router.post("/courses", response_model=Course)
async def create_course(request: CreateCourseRequest, current_user: User = Depends(get_current_user_firebase)):
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
        thumbnail_url=snippet["thumbnails"].get("high", snippet["thumbnails"].get("default", {}))["url"],
        videos=videos
    )
    await db.courses.insert_one(course.dict())
    return course

@api_router.get("/courses", response_model=List[Course])
async def get_user_courses(current_user: User = Depends(get_current_user_firebase)):
    courses_data = await db.courses.find({"user_id": current_user.id}).to_list(100)
    return [Course(**course) for course in courses_data]

@api_router.get("/courses/{course_id}", response_model=Course)
async def get_course(course_id: str, current_user: User = Depends(get_current_user_firebase)):
    course_data = await db.courses.find_one({"id": course_id, "user_id": current_user.id})
    if not course_data:
        raise HTTPException(status_code=404, detail="Course not found")
    return Course(**course_data)

@api_router.delete("/courses/{course_id}")
async def delete_course(course_id: str, current_user: User = Depends(get_current_user_firebase)):
    course = await db.courses.find_one({"id": course_id, "user_id": current_user.id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    await db.courses.delete_one({"id": course_id})
    await db.notes.delete_many({"course_id": course_id})
    await db.progress.delete_many({"course_id": course_id})

    return {"message": "Course deleted successfully"}

@api_router.post("/progress")
async def update_progress(course_id: str, video_id: str, watched: bool = False, watch_time: int = 0, last_position: int = 0, current_user: User = Depends(get_current_user_firebase)):
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
async def get_course_progress(course_id: str, current_user: User = Depends(get_current_user_firebase)):
    progress_data = await db.progress.find({"user_id": current_user.id, "course_id": course_id}).to_list(1000)
    return {item["video_id"]: item for item in progress_data}

@api_router.post("/notes", response_model=Note)
async def create_note(course_id: str, video_id: str, content: str, timestamp: int, current_user: User = Depends(get_current_user_firebase)):
    note = Note(user_id=current_user.id, course_id=course_id, video_id=video_id, content=content, timestamp=timestamp)
    await db.notes.insert_one(note.dict())
    return note
    
@api_router.put("/notes/{note_id}", response_model=Note)
async def update_note(note_id: str, request: UpdateNoteRequest, current_user: User = Depends(get_current_user_firebase)):
    note_to_update = await db.notes.find_one({"id": note_id, "user_id": current_user.id})
    if not note_to_update:
        raise HTTPException(status_code=404, detail="Note not found")
    
    await db.notes.update_one(
        {"id": note_id},
        {"$set": {"content": request.content}}
    )
    
    updated_note = await db.notes.find_one({"id": note_id})
    return Note(**updated_note)

@api_router.get("/notes/{video_id}", response_model=List[Note])
async def get_video_notes(video_id: str, current_user: User = Depends(get_current_user_firebase)):
    notes_data = await db.notes.find({"user_id": current_user.id, "video_id": video_id}).sort("timestamp", 1).to_list(1000)
    return [Note(**note) for note in notes_data]

@api_router.delete("/notes/{note_id}")
async def delete_note(note_id: str, current_user: User = Depends(get_current_user_firebase)):
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