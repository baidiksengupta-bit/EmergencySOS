from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.user import User
from app.schemas.user import UserRegister, UserLogin, UserResponse, Token

router = APIRouter()


@router.post(
    "/register",
    response_model=Token,
    status_code=status.HTTP_201_CREATED,
    summary="Register new emergency user",
    description="Registers a user profile, hashes password securely, and returns an access token.",
)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    # 1. Check if email already registered
    existing_email = db.query(User).filter(User.email == user_in.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    # 2. Check if phone number already registered
    existing_phone = db.query(User).filter(User.phone_number == user_in.phone_number).first()
    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this phone number already exists.",
        )

    # 3. Hash password securely
    hashed_pwd = get_password_hash(user_in.password)

    # 4. Create user in database
    user = User(
        full_name=user_in.full_name,
        phone_number=user_in.phone_number,
        email=user_in.email,
        hashed_password=hashed_pwd,
        blood_group=user_in.blood_group,
        allergies=user_in.allergies,
        medical_notes=user_in.medical_notes,
        emergency_pin=user_in.emergency_pin,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 5. Generate JWT token
    access_token = create_access_token(subject=user.id)

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/login",
    response_model=Token,
    summary="Authenticate user and obtain JWT token",
    description="Logs in with email or phone number and password.",
)
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    # Find user by email OR phone
    user = (
        db.query(User)
        .filter(
            (User.email == login_in.identifier)
            | (User.phone_number == login_in.identifier)
        )
        .first()
    )

    if not user or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/phone or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is deactivated.",
        )

    access_token = create_access_token(subject=user.id)

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user profile",
    description="Returns the profile details of the authenticated bearer token holder.",
)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return current_user
