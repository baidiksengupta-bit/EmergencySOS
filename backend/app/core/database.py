"""
SQLAlchemy Database Configuration and Session Management.
Supports SQLite out of the box with thread safety for FastAPI.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

# SQLite connection args for multi-threaded FastAPI workers
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=settings.DEBUG,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """
    FastAPI dependency that yields a SQLAlchemy database session
    and ensures proper closing after the request completes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
