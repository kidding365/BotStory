from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID, uuid4

class User(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    email: EmailStr
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class APIKeyConfig(BaseModel):
    provider: str = "google" # "google" or "others"
    google_api_key: Optional[str] = None
    # For "others" provider
    custom_endpoint: Optional[str] = None
    custom_api_key: Optional[str] = None
    custom_model_name: Optional[str] = None
    
    # Default models
    text_model: str = "gemma-4-31b-it"
    image_model: str = "imagen-ultra"
