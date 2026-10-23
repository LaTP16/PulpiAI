import uuid
from typing import Optional
from app.core.config import settings
from app.core.security import verify_password
from app.database.session import get_db
from app.schemas.auth import LoginRequest, LoginResponse, UserResponse, DemoCredentialsResponse

class AuthService:
    @staticmethod
    def login(req: LoginRequest) -> Optional[LoginResponse]:
        identifier = req.identifier.strip().lower()
        password = req.password

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM users
                WHERE LOWER(email) = ? OR phone = ?
                """,
                (identifier, identifier)
            )
            user = cursor.fetchone()

            if not user:
                return None

            if not verify_password(password, user["password_hash"]):
                return None

            user_resp = UserResponse(
                id=user["id"],
                name=user["name"],
                email=user["email"],
                phone=user["phone"],
                business_name=user["business_name"],
                is_demo=bool(user["is_demo"])
            )

            # Generate lightweight session token
            token = f"pulpi_token_{uuid.uuid4().hex}"

            return LoginResponse(
                success=True,
                user=user_resp,
                token=token,
                message="Inicio de sesión exitoso"
            )

    @staticmethod
    def get_user_by_id(user_id: str) -> Optional[UserResponse]:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            user = cursor.fetchone()
            if not user:
                return None
            return UserResponse(
                id=user["id"],
                name=user["name"],
                email=user["email"],
                phone=user["phone"],
                business_name=user["business_name"],
                is_demo=bool(user["is_demo"])
            )

    @staticmethod
    def get_demo_credentials() -> DemoCredentialsResponse:
        return DemoCredentialsResponse(
            email=settings.DEMO_USER_EMAIL,
            phone=settings.DEMO_USER_PHONE,
            password=settings.DEMO_USER_PASSWORD,
            name=settings.DEMO_USER_NAME,
            business_name=settings.DEMO_USER_BUSINESS,
            is_demo_mode=settings.DEMO_MODE
        )
