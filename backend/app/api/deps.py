from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_access_token, get_password_hash
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=False,
)


def get_current_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme),
) -> User:
    """
    Extract and authenticate user via JWT Bearer Token.
    Raises 401 Unauthorized if token is missing, invalid, or expired.
    If a valid JWT references a user ID wiped after a SQLite restart,
    auto-ensures the user exists or raises 401 Unauthorized.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_exception

    payload = decode_access_token(token)
    if not payload:
        raise credentials_exception

    user_id_str: str = payload.get("sub")
    if not user_id_str:
        raise credentials_exception

    try:
        user_id = int(user_id_str)
    except ValueError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        # Auto-ensure user exists if DB was recreated/wiped after server restart
        try:
            email = payload.get("email") or f"user{user_id}@emergencysos.org"
            phone_number = payload.get("phone_number") or f"+1555{user_id:07d}"
            full_name = payload.get("full_name") or f"Emergency User {user_id}"
            user = User(
                id=user_id,
                email=email,
                phone_number=phone_number,
                full_name=full_name,
                hashed_password=get_password_hash("auto-restored-session"),
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        except Exception:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account associated with token was not found. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account",
        )

    return user


def get_current_user_optional(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme),
) -> Optional[User]:
    """
    Optional authentication: returns User if valid Bearer token provided, else None.
    If Bearer token provided is invalid or expired, raises 401 Unauthorized.
    If a valid JWT references a user wiped after a SQLite restart, auto-ensures the user exists.
    """
    if not token:
        return None

    return get_current_user(db=db, token=token)
