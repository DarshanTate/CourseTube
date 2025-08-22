# CourseTube

## 📌 Project Description
**CourseTube** is a full-stack application that transforms YouTube playlists into structured, trackable online courses.  
It allows users to:
- Import any public YouTube playlist  
- Track video progress  
- Take timestamped notes  

The application is built with:
- **Backend:** FastAPI  
- **Frontend:** React, Tailwind CSS  
- **Authentication:** Firebase  

---

## ✨ Features
- **Import YouTube Playlists:** Convert any public playlist into a course with just a URL.  
- **Progress Tracking:** Saves your video progress automatically.  
- **Timestamped Notes:** Take notes on specific moments and jump back easily.  
- **User Authentication:** Secure Google login via Firebase.  
- **Responsive UI:** Fully responsive design for all devices.  

---

## 🛠 Technology Stack

### 🔹 Backend
- **Framework:** FastAPI  
- **Database:** MongoDB (with Motor for async operations)  
- **Authentication:** Firebase Admin SDK  
- **API Client:** `httpx` (async requests to YouTube Data API)  
- **Dependencies:** See `backend/requirements.txt`  

### 🔹 Frontend
- **Framework:** React (bootstrapped with CRA)  
- **Styling:** Tailwind CSS  
- **Bundler/Config:** Craco  
- **Authentication:** Firebase SDK  
- **Libraries:** `react-player`, `react-router-dom`, `axios`, `jspdf`  
- **Dependencies:** See `frontend/package.json`  

---

## 🚀 Getting Started

### ✅ Prerequisites
- Python **3.8+**  
- Node.js and npm 
- MongoDB (local or cloud-hosted)  
- YouTube Data API Key  
- Firebase Project with Google Authentication enabled  

---

### ⚙️ Installation and Setup

#### 1️⃣ Backend Setup
```bash
# Navigate to backend
cd darshantate-coursetube/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```
### Create a .env file:
```
MONGO_URL=your_mongodb_connection_string
DB_NAME=your_database_name
YOUTUBE_API_KEY=your_youtube_api_key
FIREBASE_SERVICE_ACCOUNT_KEY_PATH=path/to/your-firebase-key.json
```

### Run the server:
```
uvicorn server:app --reload
```

2️⃣ Frontend Setup
```
# Navigate to frontend
cd ../frontend

# Install dependencies
npm install

```

### Create a .env file:
```
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

### Start the development server:
```
npm start
```

### 🌍 Running the App

The application will be available locally at:
```
 http://localhost:3000
```
