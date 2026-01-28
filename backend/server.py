from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ValidationError
from typing import Optional, List, Dict, Any
import uuid
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
import jwt
from jwt.exceptions import PyJWTError, ExpiredSignatureError
from bson import ObjectId
import math
from contextlib import asynccontextmanager


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
db_name = os.getenv("DB_NAME", "Medious")

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Lifespan event handler
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown
    client.close()

# Password hashing with Argon2 (no 72-byte limit, more secure than bcrypt)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "5fc008ec2a0038269653326085c7f918770401c57d2b1a05d303cfb37de4b427")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", 24))

# Create the main app
app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ============= CUSTOM EXCEPTION HANDLERS =============
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": "Validation error", "errors": exc.errors()},
    )

@app.exception_handler(ValidationError)
async def pydantic_validation_exception_handler(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=400,
        content={"detail": "Validation error", "errors": exc.errors()},
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logging.error(f"Unexpected error: {str(exc)}", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
    )



# ============= AUTHENTICATION MODELS =============
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    reset_token: str
    new_password: str

class SupabaseSyncRequest(BaseModel):
    supabase_user_id: str
    email: EmailStr
    auth_provider: str
    name: Optional[str] = None
    avatar: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    auth_provider: str
    avatar: Optional[str] = None
    bio: Optional[str] = None
    followers_count: int = 0
    following_count: int = 0
    created_at: datetime

class AuthResponse(BaseModel):
    token: str
    user: UserResponse

# ============= EVENT MODELS =============
class EventCreate(BaseModel):
    title: str
    description: str
    category: str
    location_name: str
    latitude: float
    longitude: float
    start_date: datetime
    end_date: datetime
    price: float = 0.0
    is_free: bool = True
    max_participants: Optional[int] = None
    requirements: Optional[str] = None
    images: List[str] = []

class EventResponse(BaseModel):
    id: str
    title: str
    description: str
    category: str
    location_name: str
    latitude: float
    longitude: float
    start_date: datetime
    end_date: datetime
    price: float
    is_free: bool
    max_participants: Optional[int]
    requirements: Optional[str]
    images: List[str]
    host: Dict[str, Any]
    attendees_count: int
    is_attending: bool = False
    created_at: datetime

# ============= POST MODELS =============
class PostCreate(BaseModel):
    content: str
    images: List[str] = []

class PostResponse(BaseModel):
    id: str
    user: Dict[str, Any]
    content: str
    images: List[str]
    likes_count: int
    comments_count: int
    is_liked: bool = False
    created_at: datetime

class CommentCreate(BaseModel):
    content: str

class CommentResponse(BaseModel):
    id: str
    user: Dict[str, Any]
    content: str
    created_at: datetime

# ============= MESSAGE MODELS =============
class MessageCreate(BaseModel):
    receiver_id: str
    content: str

class MessageResponse(BaseModel):
    id: str
    sender: Dict[str, Any]
    receiver: Dict[str, Any]
    content: str
    read: bool
    created_at: datetime

class EventChatMessage(BaseModel):
    event_id: str
    message: str

# ============= HELPER FUNCTIONS =============
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = verify_token(token)
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in kilometers using Haversine formula"""
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

async def user_to_dict(user: dict) -> dict:
    """Convert user document to dictionary"""
    followers_count = await db.follows.count_documents({"following_id": str(user["_id"])})
    following_count = await db.follows.count_documents({"follower_id": str(user["_id"])})
    
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "avatar": user.get("avatar"),
        "bio": user.get("bio"),
        "followers_count": followers_count,
        "following_count": following_count
    }

# ============= AUTH ROUTES =============
@api_router.post("/auth/register", response_model=AuthResponse)
async def register(user_data: UserRegister):
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = {
        "email": user_data.email,
        "password_hash": get_password_hash(user_data.password),
        "name": user_data.name,
        "auth_provider": "email",
        "supabase_user_id": None,
        "avatar": None,
        "bio": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.users.insert_one(new_user)
    new_user["_id"] = result.inserted_id
    token = create_access_token({"user_id": str(result.inserted_id)})
    
    user_dict = await user_to_dict(new_user)
    return AuthResponse(
        token=token,
        user=UserResponse(**user_dict, auth_provider="email", created_at=new_user["created_at"])
    )

@api_router.post("/auth/login", response_model=AuthResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if user["auth_provider"] != "email":
        raise HTTPException(
            status_code=400, 
            detail=f"This account uses {user['auth_provider']} login. Please use social login."
        )
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_access_token({"user_id": str(user["_id"])})
    user_dict = await user_to_dict(user)
    
    return AuthResponse(
        token=token,
        user=UserResponse(**user_dict, auth_provider=user["auth_provider"], created_at=user["created_at"])
    )

@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    user = await db.users.find_one({"email": request.email})
    if not user:
        return {"message": "If the email exists, a reset link has been sent"}
    
    reset_token = str(uuid.uuid4())
    reset_expiry = datetime.now(timezone.utc) + timedelta(hours=1)
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"reset_token": reset_token, "reset_expiry": reset_expiry}}
    )
    
    logging.info(f"Password reset token for {request.email}: {reset_token}")
    return {"message": "If the email exists, a reset link has been sent"}

@api_router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    user = await db.users.find_one({
        "email": request.email,
        "reset_token": request.reset_token,
        "reset_expiry": {"$gt": datetime.now(timezone.utc)}
    })
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"password_hash": get_password_hash(request.new_password), "updated_at": datetime.now(timezone.utc)},
            "$unset": {"reset_token": "", "reset_expiry": ""}
        }
    )
    
    return {"message": "Password has been reset successfully"}

@api_router.post("/auth/supabase-sync", response_model=AuthResponse)
async def supabase_sync(sync_data: SupabaseSyncRequest):
    existing_user = await db.users.find_one({"supabase_user_id": sync_data.supabase_user_id})
    
    if existing_user:
        token = create_access_token({"user_id": str(existing_user["_id"])})
        user_dict = await user_to_dict(existing_user)
        return AuthResponse(
            token=token,
            user=UserResponse(**user_dict, auth_provider=existing_user["auth_provider"], created_at=existing_user["created_at"])
        )
    
    email_exists = await db.users.find_one({"email": sync_data.email})
    if email_exists:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = {
        "email": sync_data.email,
        "password_hash": None,
        "name": sync_data.name or sync_data.email.split('@')[0],
        "auth_provider": sync_data.auth_provider,
        "supabase_user_id": sync_data.supabase_user_id,
        "avatar": sync_data.avatar,
        "bio": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.users.insert_one(new_user)
    new_user["_id"] = result.inserted_id
    token = create_access_token({"user_id": str(result.inserted_id)})
    user_dict = await user_to_dict(new_user)
    
    return AuthResponse(
        token=token,
        user=UserResponse(**user_dict, auth_provider=new_user["auth_provider"], created_at=new_user["created_at"])
    )

@api_router.get("/auth/verify", response_model=UserResponse)
async def verify_auth(current_user: dict = Depends(get_current_user)):
    user_dict = await user_to_dict(current_user)
    return UserResponse(**user_dict, auth_provider=current_user["auth_provider"], created_at=current_user["created_at"])

@api_router.get("/users/profile", response_model=UserResponse)
async def get_profile(current_user: dict = Depends(get_current_user)):
    user_dict = await user_to_dict(current_user)
    return UserResponse(**user_dict, auth_provider=current_user["auth_provider"], created_at=current_user["created_at"])

@api_router.put("/users/profile", response_model=UserResponse)
async def update_profile(
    name: Optional[str] = None,
    avatar: Optional[str] = None,
    bio: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    update_data = {"updated_at": datetime.now(timezone.utc)}
    if name:
        update_data["name"] = name
    if avatar:
        update_data["avatar"] = avatar
    if bio is not None:
        update_data["bio"] = bio
    
    await db.users.update_one({"_id": current_user["_id"]}, {"$set": update_data})
    updated_user = await db.users.find_one({"_id": current_user["_id"]})
    user_dict = await user_to_dict(updated_user)
    return UserResponse(**user_dict, auth_provider=updated_user["auth_provider"], created_at=updated_user["created_at"])

@api_router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_dict = await user_to_dict(user)
    return UserResponse(**user_dict, auth_provider=user["auth_provider"], created_at=user["created_at"])

# ============= EVENT ROUTES =============
@api_router.post("/events", response_model=EventResponse)
async def create_event(event: EventCreate, current_user: dict = Depends(get_current_user)):
    event_doc = {
        **event.dict(),
        "host_id": str(current_user["_id"]),
        "attendees": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.events.insert_one(event_doc)
    event_doc["_id"] = result.inserted_id
    
    host_dict = await user_to_dict(current_user)
    return EventResponse(
        id=str(event_doc["_id"]),
        **event.dict(),
        host=host_dict,
        attendees_count=0,
        is_attending=False,
        created_at=event_doc["created_at"]
    )

@api_router.get("/events", response_model=List[EventResponse])
async def get_events(
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius: Optional[float] = 50,
    category: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    if category:
        query["category"] = category
    
    if start_date:
        query["start_date"] = {"$gte": start_date}
    
    if end_date:
        if "start_date" in query:
            query["start_date"]["$lte"] = end_date
        else:
            query["start_date"] = {"$lte": end_date}
    
    events = await db.events.find(query).sort("start_date", 1).to_list(1000)
    
    result = []
    for event in events:
        if latitude and longitude:
            distance = calculate_distance(latitude, longitude, event["latitude"], event["longitude"])
            if distance > radius:
                continue
        
        host = await db.users.find_one({"_id": ObjectId(event["host_id"])})
        host_dict = await user_to_dict(host) if host else {}
        
        is_attending = str(current_user["_id"]) in event.get("attendees", [])
        
        result.append(EventResponse(
            id=str(event["_id"]),
            title=event["title"],
            description=event["description"],
            category=event["category"],
            location_name=event["location_name"],
            latitude=event["latitude"],
            longitude=event["longitude"],
            start_date=event["start_date"],
            end_date=event["end_date"],
            price=event["price"],
            is_free=event["is_free"],
            max_participants=event.get("max_participants"),
            requirements=event.get("requirements"),
            images=event.get("images", []),
            host=host_dict,
            attendees_count=len(event.get("attendees", [])),
            is_attending=is_attending,
            created_at=event["created_at"]
        ))
    
    return result

@api_router.get("/events/{event_id}", response_model=EventResponse)
async def get_event(event_id: str, current_user: dict = Depends(get_current_user)):
    try:
        event = await db.events.find_one({"_id": ObjectId(event_id)})
    except:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    host = await db.users.find_one({"_id": ObjectId(event["host_id"])})
    host_dict = await user_to_dict(host) if host else {}
    
    is_attending = str(current_user["_id"]) in event.get("attendees", [])
    
    return EventResponse(
        id=str(event["_id"]),
        title=event["title"],
        description=event["description"],
        category=event["category"],
        location_name=event["location_name"],
        latitude=event["latitude"],
        longitude=event["longitude"],
        start_date=event["start_date"],
        end_date=event["end_date"],
        price=event["price"],
        is_free=event["is_free"],
        max_participants=event.get("max_participants"),
        requirements=event.get("requirements"),
        images=event.get("images", []),
        host=host_dict,
        attendees_count=len(event.get("attendees", [])),
        is_attending=is_attending,
        created_at=event["created_at"]
    )

@api_router.post("/events/{event_id}/rsvp")
async def rsvp_event(event_id: str, current_user: dict = Depends(get_current_user)):
    try:
        event = await db.events.find_one({"_id": ObjectId(event_id)})
    except:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    user_id = str(current_user["_id"])
    attendees = event.get("attendees", [])
    
    if user_id in attendees:
        # Already attending, remove RSVP
        await db.events.update_one(
            {"_id": ObjectId(event_id)},
            {"$pull": {"attendees": user_id}}
        )
        return {"message": "RSVP removed", "is_attending": False}
    else:
        # Check max participants
        if event.get("max_participants") and len(attendees) >= event["max_participants"]:
            raise HTTPException(status_code=400, detail="Event is full")
        
        # Add RSVP
        await db.events.update_one(
            {"_id": ObjectId(event_id)},
            {"$push": {"attendees": user_id}}
        )
        return {"message": "RSVP confirmed", "is_attending": True}

@api_router.get("/events/{event_id}/attendees")
async def get_event_attendees(event_id: str, current_user: dict = Depends(get_current_user)):
    try:
        event = await db.events.find_one({"_id": ObjectId(event_id)})
    except:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    attendees = []
    for user_id in event.get("attendees", []):
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if user:
            attendees.append(await user_to_dict(user))
    
    return {"attendees": attendees}

# ============= POST ROUTES =============
@api_router.post("/posts", response_model=PostResponse)
async def create_post(post: PostCreate, current_user: dict = Depends(get_current_user)):
    post_doc = {
        "user_id": str(current_user["_id"]),
        "content": post.content,
        "images": post.images,
        "likes": [],
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.posts.insert_one(post_doc)
    user_dict = await user_to_dict(current_user)
    
    return PostResponse(
        id=str(result.inserted_id),
        user=user_dict,
        content=post.content,
        images=post.images,
        likes_count=0,
        comments_count=0,
        is_liked=False,
        created_at=post_doc["created_at"]
    )

@api_router.get("/posts", response_model=List[PostResponse])
async def get_feed(current_user: dict = Depends(get_current_user)):
    # Get posts from followed users + own posts
    following = await db.follows.find({"follower_id": str(current_user["_id"])}).to_list(1000)
    following_ids = [f["following_id"] for f in following]
    following_ids.append(str(current_user["_id"]))
    
    posts = await db.posts.find({"user_id": {"$in": following_ids}}).sort("created_at", -1).limit(50).to_list(1000)
    
    result = []
    for post in posts:
        user = await db.users.find_one({"_id": ObjectId(post["user_id"])})
        if not user:
            continue
        
        user_dict = await user_to_dict(user)
        comments_count = await db.comments.count_documents({"post_id": str(post["_id"])})
        is_liked = str(current_user["_id"]) in post.get("likes", [])
        
        result.append(PostResponse(
            id=str(post["_id"]),
            user=user_dict,
            content=post["content"],
            images=post.get("images", []),
            likes_count=len(post.get("likes", [])),
            comments_count=comments_count,
            is_liked=is_liked,
            created_at=post["created_at"]
        ))
    
    return result

@api_router.post("/posts/{post_id}/like")
async def like_post(post_id: str, current_user: dict = Depends(get_current_user)):
    try:
        post = await db.posts.find_one({"_id": ObjectId(post_id)})
    except:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    user_id = str(current_user["_id"])
    likes = post.get("likes", [])
    
    if user_id in likes:
        await db.posts.update_one({"_id": ObjectId(post_id)}, {"$pull": {"likes": user_id}})
        return {"message": "Like removed", "is_liked": False}
    else:
        await db.posts.update_one({"_id": ObjectId(post_id)}, {"$push": {"likes": user_id}})
        return {"message": "Post liked", "is_liked": True}

@api_router.post("/posts/{post_id}/comments", response_model=CommentResponse)
async def create_comment(post_id: str, comment: CommentCreate, current_user: dict = Depends(get_current_user)):
    try:
        post = await db.posts.find_one({"_id": ObjectId(post_id)})
    except:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comment_doc = {
        "post_id": post_id,
        "user_id": str(current_user["_id"]),
        "content": comment.content,
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.comments.insert_one(comment_doc)
    user_dict = await user_to_dict(current_user)
    
    return CommentResponse(
        id=str(result.inserted_id),
        user=user_dict,
        content=comment.content,
        created_at=comment_doc["created_at"]
    )

@api_router.get("/posts/{post_id}/comments", response_model=List[CommentResponse])
async def get_comments(post_id: str, current_user: dict = Depends(get_current_user)):
    comments = await db.comments.find({"post_id": post_id}).sort("created_at", 1).to_list(1000)
    
    result = []
    for comment in comments:
        user = await db.users.find_one({"_id": ObjectId(comment["user_id"])})
        if not user:
            continue
        
        user_dict = await user_to_dict(user)
        result.append(CommentResponse(
            id=str(comment["_id"]),
            user=user_dict,
            content=comment["content"],
            created_at=comment["created_at"]
        ))
    
    return result

# ============= SOCIAL ROUTES =============
@api_router.post("/users/{user_id}/follow")
async def follow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if user_id == str(current_user["_id"]):
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    try:
        target_user = await db.users.find_one({"_id": ObjectId(user_id)})
    except:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing = await db.follows.find_one({
        "follower_id": str(current_user["_id"]),
        "following_id": user_id
    })
    
    if existing:
        await db.follows.delete_one({"_id": existing["_id"]})
        return {"message": "Unfollowed", "is_following": False}
    else:
        await db.follows.insert_one({
            "follower_id": str(current_user["_id"]),
            "following_id": user_id,
            "created_at": datetime.now(timezone.utc)
        })
        return {"message": "Following", "is_following": True}

@api_router.get("/users/{user_id}/followers")
async def get_followers(user_id: str, current_user: dict = Depends(get_current_user)):
    follows = await db.follows.find({"following_id": user_id}).to_list(1000)
    
    followers = []
    for follow in follows:
        user = await db.users.find_one({"_id": ObjectId(follow["follower_id"])})
        if user:
            followers.append(await user_to_dict(user))
    
    return {"followers": followers}

@api_router.get("/users/{user_id}/following")
async def get_following(user_id: str, current_user: dict = Depends(get_current_user)):
    follows = await db.follows.find({"follower_id": user_id}).to_list(1000)
    
    following = []
    for follow in follows:
        user = await db.users.find_one({"_id": ObjectId(follow["following_id"])})
        if user:
            following.append(await user_to_dict(user))
    
    return {"following": following}

# ============= MESSAGE ROUTES =============
@api_router.post("/messages", response_model=MessageResponse)
async def send_message(message: MessageCreate, current_user: dict = Depends(get_current_user)):
    try:
        receiver = await db.users.find_one({"_id": ObjectId(message.receiver_id)})
    except:
        raise HTTPException(status_code=404, detail="Receiver not found")
    
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")
    
    message_doc = {
        "sender_id": str(current_user["_id"]),
        "receiver_id": message.receiver_id,
        "content": message.content,
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.messages.insert_one(message_doc)
    
    sender_dict = await user_to_dict(current_user)
    receiver_dict = await user_to_dict(receiver)
    
    return MessageResponse(
        id=str(result.inserted_id),
        sender=sender_dict,
        receiver=receiver_dict,
        content=message.content,
        read=False,
        created_at=message_doc["created_at"]
    )

@api_router.get("/messages/conversations")
async def get_conversations(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    
    # Get all messages involving the user
    messages = await db.messages.find({
        "$or": [
            {"sender_id": user_id},
            {"receiver_id": user_id}
        ]
    }).sort("created_at", -1).to_list(1000)
    
    # Group by conversation partner
    conversations = {}
    for msg in messages:
        partner_id = msg["receiver_id"] if msg["sender_id"] == user_id else msg["sender_id"]
        
        if partner_id not in conversations:
            partner = await db.users.find_one({"_id": ObjectId(partner_id)})
            if partner:
                conversations[partner_id] = {
                    "partner": await user_to_dict(partner),
                    "last_message": msg["content"],
                    "last_message_time": msg["created_at"],
                    "unread_count": 0
                }
        
        if msg["receiver_id"] == user_id and not msg["read"]:
            conversations[partner_id]["unread_count"] += 1
    
    return {"conversations": list(conversations.values())}

@api_router.get("/messages/{user_id}", response_model=List[MessageResponse])
async def get_messages_with_user(user_id: str, current_user: dict = Depends(get_current_user)):
    current_user_id = str(current_user["_id"])
    
    messages = await db.messages.find({
        "$or": [
            {"sender_id": current_user_id, "receiver_id": user_id},
            {"sender_id": user_id, "receiver_id": current_user_id}
        ]
    }).sort("created_at", 1).to_list(1000)
    
    # Mark messages as read
    await db.messages.update_many(
        {"sender_id": user_id, "receiver_id": current_user_id, "read": False},
        {"$set": {"read": True}}
    )
    
    result = []
    for msg in messages:
        sender = await db.users.find_one({"_id": ObjectId(msg["sender_id"])})
        receiver = await db.users.find_one({"_id": ObjectId(msg["receiver_id"])})
        
        if sender and receiver:
            result.append(MessageResponse(
                id=str(msg["_id"]),
                sender=await user_to_dict(sender),
                receiver=await user_to_dict(receiver),
                content=msg["content"],
                read=msg["read"],
                created_at=msg["created_at"]
            ))
    
    return result

# ============= EVENT CHAT ROUTES =============
@api_router.post("/events/{event_id}/chat")
async def send_event_chat_message(event_id: str, message: str, current_user: dict = Depends(get_current_user)):
    try:
        event = await db.events.find_one({"_id": ObjectId(event_id)})
    except:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check if user is attending or is the host
    user_id = str(current_user["_id"])
    if user_id not in event.get("attendees", []) and user_id != event["host_id"]:
        raise HTTPException(status_code=403, detail="Must be attending event to chat")
    
    chat_msg = {
        "event_id": event_id,
        "user_id": user_id,
        "message": message,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.event_chats.insert_one(chat_msg)
    return {"message": "Message sent"}

@api_router.get("/events/{event_id}/chat")
async def get_event_chat(event_id: str, current_user: dict = Depends(get_current_user)):
    try:
        event = await db.events.find_one({"_id": ObjectId(event_id)})
    except:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    user_id = str(current_user["_id"])
    if user_id not in event.get("attendees", []) and user_id != event["host_id"]:
        raise HTTPException(status_code=403, detail="Must be attending event to view chat")
    
    messages = await db.event_chats.find({"event_id": event_id}).sort("created_at", 1).to_list(1000)
    
    result = []
    for msg in messages:
        user = await db.users.find_one({"_id": ObjectId(msg["user_id"])})
        if user:
            result.append({
                "user": await user_to_dict(user),
                "message": msg["message"],
                "created_at": msg["created_at"]
            })
    
    return {"messages": result}

# ============= SEARCH ROUTES =============
@api_router.get("/search")
async def search(q: str, type: str = "all", current_user: dict = Depends(get_current_user)):
    results = {}
    
    if type in ["all", "users"]:
        users = await db.users.find({
            "$or": [
                {"name": {"$regex": q, "$options": "i"}},
                {"email": {"$regex": q, "$options": "i"}}
            ]
        }).limit(20).to_list(1000)
        
        results["users"] = [await user_to_dict(u) for u in users]
    
    if type in ["all", "events"]:
        events = await db.events.find({
            "$or": [
                {"title": {"$regex": q, "$options": "i"}},
                {"description": {"$regex": q, "$options": "i"}},
                {"category": {"$regex": q, "$options": "i"}}
            ]
        }).limit(20).to_list(1000)
        
        event_results = []
        for event in events:
            host = await db.users.find_one({"_id": ObjectId(event["host_id"])})
            host_dict = await user_to_dict(host) if host else {}
            
            event_results.append({
                "id": str(event["_id"]),
                "title": event["title"],
                "category": event["category"],
                "location_name": event["location_name"],
                "start_date": event["start_date"],
                "host": host_dict,
                "attendees_count": len(event.get("attendees", []))
            })
        
        results["events"] = event_results
    
    return results

# ============= ROOT =============
@api_router.get("/")
async def root():
    return {"message": "Medious API - Social Event Platform"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Medious API server...")
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
