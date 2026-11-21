# 🚨 EmergencySOS

A modern, real-world Emergency SOS mobile and backend application built with **React Native (Expo + TypeScript + Expo Router)** and **FastAPI (Python + SQLAlchemy + SQLite)**.

Designed for rapid emergency response, real-time GPS location tracking, automated alerts, and seamless integration with **Google Maps** and **Firebase Cloud Messaging (FCM)**.

---

## 🏗️ Project Architecture

```
EmergencySOS/
├── .gitignore                      # Top-level workspace gitignore
├── README.md                       # Comprehensive setup and run guide
│
├── backend/                        # Independent FastAPI Backend Service
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py             # Dependency injection (DB session, auth)
│   │   │   └── v1/
│   │   │       ├── api.py          # Central API v1 router
│   │   │       └── endpoints/
│   │   │           ├── health.py   # System health and DB connectivity check
│   │   │           ├── sos.py      # Trigger, query, and resolve SOS alerts
│   │   │           ├── contacts.py # Emergency contacts management (CRUD)
│   │   │           └── location.py # Real-time GPS breadcrumbs during active SOS
│   │   ├── core/
│   │   │   ├── config.py           # Pydantic Settings & environment variables
│   │   │   └── database.py         # SQLAlchemy engine, session & declarative base
│   │   ├── models/                 # SQLAlchemy ORM database models
│   │   │   ├── base.py             # Timestamp mixin (created_at, updated_at)
│   │   │   ├── user.py             # User profile model & FCM token
│   │   │   ├── emergency_contact.py# Emergency contacts model
│   │   │   ├── alert.py            # SOS emergency alerts model & statuses
│   │   │   └── location_log.py     # GPS telemetry tracking breadcrumbs
│   │   ├── schemas/                # Pydantic validation and serialization schemas
│   │   │   ├── user.py
│   │   │   ├── contact.py
│   │   │   ├── alert.py
│   │   │   └── location.py
│   │   ├── services/               # Modular business logic and integrations
│   │   │   ├── fcm_service.py      # Firebase Cloud Messaging push notification service
│   │   │   ├── location_service.py # Geospatial calculations & geocoding helper
│   │   │   └── sos_service.py      # Emergency broadcast orchestration
│   │   └── main.py                 # FastAPI application, CORS middleware & lifespan
│   ├── tests/                      # Automated test suite
│   │   ├── conftest.py             # Pytest fixtures and in-memory test database
│   │   └── test_health.py          # Backend sanity test
│   ├── .env.example                # Backend environment template
│   ├── .gitignore                  # Backend-specific gitignore
│   ├── requirements.txt            # Production Python dependencies
│   ├── requirements-dev.txt        # Development and testing dependencies
│   └── run.py                      # Convenience server runner
│
└── frontend/                       # Independent React Native / Expo Mobile App
    ├── app/                        # Expo Router file-based route tree
    │   ├── _layout.tsx             # Root layout with SafeAreaProvider, Auth & SOS Context
    │   ├── index.tsx               # Root entry router (dispatches to home or welcome)
    │   ├── welcome.tsx             # Screen 1: Welcome Hero & Onboarding
    │   ├── login.tsx               # Screen 2: Emergency Account Login
    │   ├── register.tsx            # Screen 3: Registration & Medical Profile Relay
    │   ├── +not-found.tsx          # 404 fallback route
    │   └── (tabs)/                 # Bottom tab navigator (5 main views)
    │       ├── _layout.tsx         # Dark navy tab navigation configuration
    │       ├── home.tsx            # Screen 4: Home / Red Emergency SOS Panic Button
    │       ├── location.tsx        # Screen 6: Live GPS Telemetry, Radar & Map Fix
    │       ├── contacts.tsx        # Screen 5: Emergency Response Contacts (CRUD)
    │       ├── history.tsx         # Screen 7: Incident History & Telemetry Log
    │       └── settings.tsx        # Screen 8: Profile, Medical Notes & Diagnostics
    ├── assets/
    │   └── images/                 # App icon, splash screen, and adaptive icon
    ├── src/
    │   ├── components/
    │   │   ├── common/             # Reusable UI widgets (Button, Input, Card, Badge, Header)
    │   │   └── sos/                # Domain widgets (SOSButton, CountdownModal, ActiveAlertBanner)
    │   ├── constants/
    │   │   ├── Colors.ts           # Dark Navy (#0A1128), White, and Emergency Red (#DC2626) theme
    │   │   └── Config.ts           # Frontend runtime configuration
    │   ├── context/
    │   │   ├── AuthContext.tsx     # Authentication, session & medical profile state
    │   │   └── SOSContext.tsx      # Emergency broadcast, countdown timer & telemetry state
    │   ├── services/
    │   │   ├── api.ts              # Axios API client for FastAPI endpoints
    │   │   ├── location.ts         # expo-location GPS permission & reverse geocode
    │   │   └── notifications.ts    # Push notification helper
    │   └── types/
    │       └── index.ts            # TypeScript interfaces & types
    ├── .env.example                # Mobile environment template
    ├── .gitignore                  # Frontend-specific gitignore
    ├── app.json                    # Expo project configuration and native permissions
    ├── babel.config.js             # Babel compiler preset
    ├── package.json                # NPM package definitions
    └── tsconfig.json               # TypeScript path alias configuration (@/*)
```

---

## 🛠️ Technology Stack

### Mobile Frontend:
- **Framework:** React Native with [Expo SDK 52](https://expo.dev)
- **Language:** TypeScript
- **Navigation:** [Expo Router v4](https://docs.expo.dev/router/introduction/) (File-based navigation)
- **State Management:** React Context API (`SOSContext`)
- **Location Services:** `expo-location` (High accuracy GPS telemetry)
- **Maps:** `react-native-maps` (Prepared for Google Maps)
- **Networking:** `axios`

### Backend Service:
- **Framework:** [FastAPI](https://fastapi.tiangolo.com)
- **Language:** Python 3.10+
- **Database & ORM:** [SQLAlchemy 2.0](https://www.sqlalchemy.org) with SQLite (zero-config, thread-safe)
- **Validation:** [Pydantic v2](https://docs.pydantic.dev) & `pydantic-settings`
- **Server:** [Uvicorn](https://www.uvicorn.org) ASGI server
- **Push Notifications:** `firebase-admin` (Prepared for FCM)

---

## 🚀 Getting Started

Both frontend and backend are configured to run completely independently. Follow the steps below to start each service.

---

### Part 1: Backend Setup & Execution

#### 1. Navigate to the backend directory:
```bash
cd backend
```

#### 2. Create and activate a Python virtual environment:
- **Windows (PowerShell):**
  ```powershell
  python -m venv venv
  .\venv\Scripts\Activate.ps1
  ```
- **macOS / Linux:**
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```

#### 3. Install backend dependencies:
```bash
pip install -r requirements.txt
```
*(Optional: Install test tools with `pip install -r requirements-dev.txt`)*

#### 4. Configure environment variables:
Create a `.env` file from the provided template:
- **Windows (PowerShell):**
  ```powershell
  Copy-Item .env.example .env
  ```
- **macOS / Linux:**
  ```bash
  cp .env.example .env
  ```

#### 5. Run the FastAPI development server:
```bash
python run.py
```
*Or alternatively with uvicorn directly:*
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 6. Verify Backend:
Open your browser and navigate to:
- **Interactive Swagger API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc Documentation:** [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check Endpoint:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

---

### Part 2: Frontend Setup & Execution

#### 1. Open a new terminal and navigate to the frontend directory:
```bash
cd frontend
```

#### 2. Install mobile dependencies:
```bash
npm install
```

#### 3. Configure environment variables:
Create a `.env` file from `.env.example`:
- **Windows (PowerShell):**
  ```powershell
  Copy-Item .env.example .env
  ```
- **macOS / Linux:**
  ```bash
  cp .env.example .env
  ```

> 💡 **Important for Physical Mobile Testing:**
> If testing on a physical phone via the Expo Go app, change `EXPO_PUBLIC_API_BASE_URL` in `frontend/.env` to your computer's local Wi-Fi IP address (e.g. `http://192.168.1.100:8000/api/v1`), because `localhost` on a mobile device refers to the phone itself.
> - Android Emulator default loopback: `http://10.0.2.2:8000/api/v1`
> - iOS Simulator / Web: `http://localhost:8000/api/v1`

#### 4. Start the Expo development server:
```bash
npm run start
```

#### 5. Launch the application:
- **Web Browser:** Press `w` in the Expo terminal or run `npm run web`.
- **Android Emulator / Device:** Press `a` or scan the terminal QR code with the **Expo Go** app.
- **iOS Simulator / Device:** Press `i` or scan the terminal QR code with the iOS Camera app.

---

## 📡 RESTful API Endpoints Overview

All endpoints are prefixed with `/api/v1` and interactive documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs).

| # | Method | Endpoint | Description | Auth Required |
|---|---|---|---|---|
| 1 | `POST` | `/api/v1/auth/register` | User registration with PBKDF2/bcrypt password hashing | No |
| 2 | `POST` | `/api/v1/auth/login` | User login (returns JWT Bearer token & profile) | No |
| - | `GET` | `/api/v1/auth/me` | Fetch authenticated user profile | Bearer Token |
| 3 | `POST` | `/api/v1/contacts/` | Add a new emergency contact (with primary toggle) | Bearer Token / `user_id` |
| 4 | `DELETE` | `/api/v1/contacts/{contact_id}` | Remove an emergency contact | Bearer Token / `user_id` |
| - | `GET` | `/api/v1/contacts/` | List all emergency contacts for current user | Bearer Token / `user_id` |
| 5 | `POST` | `/api/v1/sos/trigger` | Create SOS alert with GPS coordinates & broadcast | Bearer Token / `user_id` |
| 6 | `POST` | `/api/v1/location/breadcrumb` | Save live GPS telemetry coordinates during active alert | No |
| - | `GET` | `/api/v1/location/alert/{alert_id}/breadcrumbs` | Fetch recorded GPS coordinates breadcrumb stream | No |
| 7 | `GET` | `/api/v1/sos/history` | Fetch emergency incident history (with status filter) | Bearer Token / `user_id` |
| 8 | `PATCH` | `/api/v1/sos/{alert_id}/cancel` | Cancel or resolve emergency alert with reason & PIN | Bearer Token / `user_id` |
| - | `GET` | `/api/v1/sos/active` | Fetch current active emergency alert for user | Bearer Token / `user_id` |
| - | `GET` | `/api/v1/health` | Backend service status & SQLite DB health check | No |

---

## 🛡️ Next Development Steps

1. **User Authentication:** Add JWT or OTP verification for mobile users.
2. **Google Maps Visualisation:** Provide live polyline tracking of breadcrumbs on the map screen.
3. **Firebase Cloud Messaging:** Plug in active FCM credentials in `backend/.env` for real-time mobile push notifications.
4. **SMS / Twilio Fallback:** Add automated SMS dispatch if data connection is degraded during an SOS event.
