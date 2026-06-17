from datetime import datetime, timedelta
from typing import Optional, Union, Dict, Any
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models.user import User
from app.models.auth import Token as TokenModel
from app.schemas.auth import TokenData
from app.config import (
    SECRET_KEY,
    ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
)
import logging

logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 bearer token scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/token")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify if the plain password matches the hashed password."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.
    
    Args:
        data: Data to encode in the JWT
        expires_delta: Token expiration time
        
    Returns:
        JWT token string
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
    to_encode.update({"exp": expire})
    
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """
    Create a JWT refresh token with longer expiry.
    
    Args:
        data: Data to encode in the JWT
        
    Returns:
        JWT refresh token string
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT, returning its payload or None if invalid."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Validate the access token and return the current user.
    
    Args:
        token: JWT token
        db: Database session
        
    Returns:
        Current user or raises an exception
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Decode the JWT
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")

        if username is None:
            raise credentials_exception

        token_data = TokenData(username=username)

    except JWTError:
        raise credentials_exception

    # Reject revoked tokens
    db_token = db.query(TokenModel).filter(
        TokenModel.token == token,
        TokenModel.revoked == True
    ).first()

    if db_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Get the user from the database
    user = db.query(User).filter(User.username == token_data.username).first()

    if user is None:
        raise credentials_exception

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Check if the current user is active.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        Current active user or raises an exception
    """
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    return current_user


def store_token(
    db: Session, 
    token: str, 
    user_id: int, 
    token_type: str, 
    expires_at: datetime
) -> TokenModel:
    """
    Store a token in the database.
    
    Args:
        db: Database session
        token: Token string
        user_id: User ID
        token_type: Token type ("access" or "refresh")
        expires_at: Token expiration datetime
        
    Returns:
        Created token model
    """
    # Check if token already exists in database
    existing_token = db.query(TokenModel).filter(TokenModel.token == token).first()
    
    if existing_token:
        # Token already exists, update its properties
        existing_token.user_id = user_id
        existing_token.token_type = token_type
        existing_token.expires_at = expires_at
        existing_token.revoked = False  # Ensure it's not revoked
        db.commit()
        db.refresh(existing_token)
        return existing_token
    
    # Token doesn't exist, create a new one
    db_token = TokenModel(
        token=token,
        user_id=user_id,
        token_type=token_type,
        expires_at=expires_at
    )
    
    db.add(db_token)
    db.commit()
    db.refresh(db_token)
    
    return db_token


def revoke_token(db: Session, token: str) -> bool:
    """
    Revoke a token by marking it as revoked in the database.
    
    Args:
        db: Database session
        token: Token string to revoke
        
    Returns:
        True if token was revoked, False otherwise
    """
    db_token = db.query(TokenModel).filter(TokenModel.token == token).first()
    
    if db_token:
        db_token.revoked = True
        db.commit()
        return True
        
    return False


def get_role_required(required_role: str):
    """
    Create a dependency that requires a specific role.
    
    Args:
        required_role: Required role (e.g., "admin", "teacher", "student")
        
    Returns:
        Dependency function
    """
    # Roles that satisfy a given requirement (admins are implicitly allowed
    # everywhere; teachers can do student-scoped reads where used).
    allowed_by_requirement = {
        "admin": {"admin"},
        "teacher": {"admin", "teacher"},
        "student": {"admin", "teacher", "student"},
    }

    async def role_checker(current_user: User = Depends(get_current_active_user)):
        allowed = allowed_by_requirement.get(required_role, {required_role})
        if current_user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user

    return role_checker


# Convenience role dependencies
require_admin = get_role_required("admin")
require_teacher = get_role_required("teacher")
require_student = get_role_required("student")