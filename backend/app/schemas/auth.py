from pydantic import BaseModel, Field
from typing import Optional

class LoginRequest(BaseModel):
    identifier: str = Field(..., description="Email or phone number")
    password: str = Field(..., description="User password")

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    business_name: Optional[str] = None
    is_demo: bool = False

class LoginResponse(BaseModel):
    success: bool
    user: UserResponse
    token: str
    message: str

class DemoCredentialsResponse(BaseModel):
    email: str
    phone: str
    password: str
    name: str
    business_name: str
    is_demo_mode: bool
