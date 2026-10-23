from fastapi import APIRouter, HTTPException, status
from app.schemas.auth import LoginRequest, LoginResponse, DemoCredentialsResponse, UserResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    result = AuthService.login(payload)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas. Revisa tu correo, celular o contraseña."
        )
    return result

@router.get("/demo-credentials", response_model=DemoCredentialsResponse)
def get_demo_credentials():
    return AuthService.get_demo_credentials()

@router.get("/user/{user_id}", response_model=UserResponse)
def get_user(user_id: str):
    user = AuthService.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user
