"""
EmergencySOS - FastAPI Backend Server
=====================================
Main application entry point.
Initializes the SQLite database tables and exposes root and health check endpoints.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import database
import models

# 1. Initialize SQLite Database Tables
# This creates the 'emergencysos.db' file and creates the tables (users, emergency_contacts,
# and sos_alerts) if they do not already exist when the application starts.
models.Base.metadata.create_all(bind=database.engine)

# 2. Initialize the FastAPI Application
app = FastAPI(
    title="EmergencySOS Backend",
    description="EmergencySOS REST API Backend for user safety, emergency contacts, and SOS alerts.",
    version="1.0.0",
)

# Enable CORS for frontend clients (Mobile app, Web preview)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 3. Root GET Endpoint
@app.get("/")
def read_root():
    """
    Root endpoint confirming that the EmergencySOS backend server is running.
    """
    return {"message": "EmergencySOS Backend is running"}


# 4. Health Check GET Endpoint
@app.get("/health")
def health_check():
    """
    Health check endpoint returning service status and name.
    """
    return {
        "status": "ok",
        "service": "EmergencySOS Backend",
    }
