from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
import uuid
from datetime import datetime, timedelta
from passlib.context import CryptContext
import jwt
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", 24))

# Supabase Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Models
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
    created_at: datetime

class AuthResponse(BaseModel):
    token: str
    user: UserResponse

class MessageResponse(BaseModel):
    message: str

# Helper functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
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

def user_to_response(user: dict) -> UserResponse:
    return UserResponse(
        id=str(user["_id"]),
        email=user["email"],
        name=user["name"],
        auth_provider=user["auth_provider"],
        avatar=user.get("avatar"),
        created_at=user["created_at"]
    )

# Auth Routes
@api_router.post("/auth/register", response_model=AuthResponse)
async def register(user_data: UserRegister):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = {
        "email": user_data.email,
        "password_hash": hashed_password,
        "name": user_data.name,
        "auth_provider": "email",
        "supabase_user_id": None,
        "avatar": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db.users.insert_one(new_user)
    new_user["_id"] = result.inserted_id
    
    # Create access token
    token = create_access_token({"user_id": str(result.inserted_id)})
    
    return AuthResponse(
        token=token,
        user=user_to_response(new_user)
    )

@api_router.post("/auth/login", response_model=AuthResponse)
async def login(credentials: UserLogin):
    # Find user
    user = await db.users.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check if user registered with email/password
    if user["auth_provider"] != "email":
        raise HTTPException(
            status_code=400, 
            detail=f"This account uses {user['auth_provider']} login. Please use social login."
        )
    
    # Verify password
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Create access token
    token = create_access_token({"user_id": str(user["_id"])})
    
    return AuthResponse(
        token=token,
        user=user_to_response(user)
    )

@api_router.post("/auth/forgot-password", response_model=MessageResponse)
async def forgot_password(request: ForgotPasswordRequest):
    # Find user
    user = await db.users.find_one({"email": request.email})
    if not user:
        # Don't reveal if email exists or not
        return MessageResponse(message="If the email exists, a reset link has been sent")
    
    # Generate reset token (valid for 1 hour)
    reset_token = str(uuid.uuid4())
    reset_expiry = datetime.utcnow() + timedelta(hours=1)
    
    # Update user with reset token
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"reset_token": reset_token, "reset_expiry": reset_expiry}}
    )
    
    # In production, send email with reset link
    # For now, we'll return the token in the response (NOT SECURE - ONLY FOR DEVELOPMENT)
    logging.info(f"Password reset token for {request.email}: {reset_token}")
    
    return MessageResponse(message="If the email exists, a reset link has been sent")

@api_router.post("/auth/reset-password", response_model=MessageResponse)
async def reset_password(request: ResetPasswordRequest):
    # Find user with valid reset token
    user = await db.users.find_one({
        "email": request.email,
        "reset_token": request.reset_token,
        "reset_expiry": {"$gt": datetime.utcnow()}
    })
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Update password
    hashed_password = get_password_hash(request.new_password)
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"password_hash": hashed_password, "updated_at": datetime.utcnow()},
            "$unset": {"reset_token": "", "reset_expiry": ""}
        }
    )
    
    return MessageResponse(message="Password has been reset successfully")

@api_router.post("/auth/supabase-sync", response_model=AuthResponse)
async def supabase_sync(sync_data: SupabaseSyncRequest):
    # Check if user already exists with this supabase_user_id
    existing_user = await db.users.find_one({"supabase_user_id": sync_data.supabase_user_id})
    
    if existing_user:
        # User exists, return existing user
        token = create_access_token({"user_id": str(existing_user["_id"])})
        return AuthResponse(
            token=token,
            user=user_to_response(existing_user)
        )
    
    # Check if email already exists
    email_exists = await db.users.find_one({"email": sync_data.email})
    if email_exists:
        raise HTTPException(
            status_code=400,
            detail="Email already registered with different authentication method"
        )
    
    # Create new user from OAuth
    new_user = {
        "email": sync_data.email,
        "password_hash": None,
        "name": sync_data.name or sync_data.email.split('@')[0],
        "auth_provider": sync_data.auth_provider,
        "supabase_user_id": sync_data.supabase_user_id,
        "avatar": sync_data.avatar,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db.users.insert_one(new_user)
    new_user["_id"] = result.inserted_id
    
    # Create access token
    token = create_access_token({"user_id": str(result.inserted_id)})
    
    return AuthResponse(
        token=token,
        user=user_to_response(new_user)
    )

@api_router.get("/auth/verify", response_model=UserResponse)
async def verify_auth(current_user: dict = Depends(get_current_user)):
    return user_to_response(current_user)

@api_router.get("/users/profile", response_model=UserResponse)
async def get_profile(current_user: dict = Depends(get_current_user)):
    return user_to_response(current_user)

@api_router.put("/users/profile", response_model=UserResponse)
async def update_profile(
    name: Optional[str] = None,
    avatar: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    update_data = {"updated_at": datetime.utcnow()}
    
    if name:
        update_data["name"] = name
    if avatar:
        update_data["avatar"] = avatar
    
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": update_data}
    )
    
    updated_user = await db.users.find_one({"_id": current_user["_id"]})
    return user_to_response(updated_user)

# Test routes
@api_router.get("/")
async def root():
    return {"message": "Medious API - Authentication System"}

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
