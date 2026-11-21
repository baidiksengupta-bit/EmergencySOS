"""
EmergencySOS - Database Configuration
=====================================
This module sets up the SQLite database connection using SQLAlchemy.
It defines the database engine, session factory, and declarative base.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. Database File Path Configuration
# Build an absolute path to ensure 'emergencysos.db' is always placed
# inside the 'backend' folder regardless of where the app is launched from.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_FILE = os.path.join(BASE_DIR, "emergencysos.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DATABASE_FILE}"

# 2. SQLAlchemy Engine
# SQLite requires 'check_same_thread: False' so multiple requests can interact
# with the database on different threads in FastAPI.
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

# 3. SessionLocal
# Each request will get its own database session from this factory.
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# 4. Declarative Base
# All database models will inherit from this Base class.
Base = declarative_base()


def get_db():
    """
    Dependency helper function for FastAPI routes.
    Provides an independent database session per request and ensures
    the session is properly closed after the request completes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
