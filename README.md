# 🚨 EmergencySOS

An Emergency SOS **demonstration app** built with **React Native (Expo SDK 58 + TypeScript + Expo Router)** and **FastAPI (Python + SQLAlchemy + SQLite)**.

It shows the full SOS flow: a panic button with a countdown, GPS location capture, live location breadcrumbs, emergency contacts, and incident history.

> ⚠️ **Demonstration mode — not a real emergency service.**
> This app does **not** contact emergency services (police, ambulance, fire) and must not be relied on in a real emergency. Alerts are stored in the local database only. Push notifications (FCM) and SMS fallback are not connected to any live delivery service. In a real emergency, call your local emergency number directly.

---

## 🏗️ Project Architecture

```
EmergencySOS/
├── .gitignore
├── README.md
│
├── backend/                        # FastAPI backend service
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py             # Dependency injection (DB session)
│   │   │   └── v1/
│   │   │       ├── api.py          # Central API v1 router
│   │   │       └── endpoints/
│   │   │           ├── health.py   # Service and DB health check
│   │   │           ├── auth.py     # Authentication & user profile
│   │   │           ├── sos.py      # Trigger, query, and cancel/resolve SOS alerts
│   │   │           ├── contacts.py # Emergency contacts (CRUD)
│   │   │           └── location.py # GPS breadcrumbs during an active SOS
│   │   ├── core/
│   │   │   ├── config.py           # Pydantic settings & environment variables
│   │   │   ├── database.py         # SQLAlchemy engine, session & base
│   │   │   └── security.py         # Password hashing & JWT token utilities
│   │   ├── models/                 # SQLAlchemy ORM models
│   │   │   ├── base.py             # Timestamp mixin
│   │   │   ├── user.py
│   │   │   ├── emergency_contact.py
│   │   │   ├── alert.py
│   │   │   └── location_log.py
│   │   ├── schemas/                # Pydantic schemas
│   │   ├── services/
│   │   │   ├── fcm_service.py      # FCM scaffolding (not connected by default)
│   │   │   ├── location_service.py # Geospatial helpers
│   │   │   └── sos_service.py      # SOS orchestration (demo mode)
│   │   └── main.py                 # FastAPI app, CORS & lifespan
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_emergency_sos.py
│   │   └── test_health.py
│   ├── .env.example
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── run.py
│
└── frontend/                       # React Native / Expo app
    ├── app/                        # Expo Router file-based routes
    │   ├── _layout.tsx
    │   ├── index.tsx
    │   ├── welcome.tsx
    │   ├── login.tsx
    │   ├── register.tsx
    │   ├── +not-found.tsx
    │   └── (tabs)/
    │       ├── _layout.tsx
    │       ├── home.tsx            # SOS panic button
    │       ├── location.tsx        # Live GPS and map
    │       ├── contacts.tsx        # Emergency contacts
    │       ├── history.tsx         # Incident history
    │       └── settings.tsx        # Profile and medical notes
    ├── assets/
    │   ├── images/
    │   └── sounds/
    │       └── sos-siren.mp3
    ├── src/
    │   ├── components/             # common/ and sos/ widgets
    │   ├── constants/              # Colors.ts, Config.ts
    │   ├── context/                # AuthContext.tsx, SOSContext.tsx
    │   ├── services/               # api.ts, location.ts, notifications.ts
    │   └── types/
    ├── .env.example
    ├── app.json
    ├── babel.config.js
    ├── package.json
    └── tsconfig.json
```

---

## 🛠️ Technology Stack

### Mobile frontend
- **Framework:** React Native with [Expo SDK 58](https://expo.dev)
- **Language:** TypeScript
- **Navigation:** [Expo Router](https://docs.expo.dev/router/introduction/) (file-based)
- **State management:** React Context (`AuthContext`, `SOSContext`)
- **Location:** `expo-location`
- **Maps:** `react-native-maps`
- **Audio:** `expo-audio`
- **Networking:** `axios`

### Backend
- **Framework:** [FastAPI](https://fastapi.tiangolo.com)
- **Language:** Python 3.10+
- **Database / ORM:** [SQLAlchemy 2.0](https://www.sqlalchemy.org) with SQLite
- **Validation:** [Pydantic v2](https://docs.pydantic.dev) and `pydantic-settings`
- **Server:** [Uvicorn](https://www.uvicorn.org)
- **Push notifications:** `firebase-admin` (scaffolding only; not connected by default)

---

## 🚀 Getting Started

The frontend and backend run independently. Start the backend first.

### Part 1: Backend

```bash
cd backend
```

Create and activate a virtual environment:

- **Windows (PowerShell):**
  ```powershell
  python -m venv .venv
  .\.venv\Scripts\Activate.ps1
  ```
- **macOS / Linux:**
  ```bash
  python3 -m venv .venv
  source .venv/bin/activate
  ```

Install dependencies (add `requirements-dev.txt` for tests):

```bash
pip install -r requirements.txt
pip install -r requirements-dev.txt   # optional
```

Create your environment file:

- **Windows (PowerShell):** `Copy-Item .env.example .env`
- **macOS / Linux:** `cp .env.example .env`

Run the server:

```powershell
.\.venv\Scripts\python.exe run.py
# or
python run.py
# or
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Verify it is running:
- Swagger docs: <http://localhost:8000/docs>
- ReDoc: <http://localhost:8000/redoc>
- Health check: <http://localhost:8000/api/v1/health>

Run the tests:

```bash
pytest
```

### Part 2: Frontend

In a new terminal:

```bash
cd frontend
npm install
```

Create your environment file:

- **Windows (PowerShell):** `Copy-Item .env.example .env`
- **macOS / Linux:** `cp .env.example .env`

> 💡 **Set the API URL for your device.** `localhost` on a phone refers to the phone itself, so set `EXPO_PUBLIC_API_BASE_URL` in `frontend/.env` to match where you run the app:
> - Physical phone (Expo Go): your computer's Wi-Fi IP, e.g. `http://192.168.1.100:8000/api/v1`
> - Android emulator: `http://10.0.2.2:8000/api/v1`
> - iOS simulator / web: `http://localhost:8000/api/v1`

Start Expo:

```bash
npx expo start --clear
```

Then press `w` (web), `a` (Android), or `i` (iOS), or scan the QR code with Expo Go. Your Expo Go app must support SDK 58.

---

## 📡 API Endpoints

All endpoints are prefixed with `/api/v1`. Interactive docs are at <http://localhost:8000/docs>, which is the source of truth if this table ever drifts from the code.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service status and SQLite connectivity check |
| `GET` | `/contacts/` | List the user's emergency contacts |
| `POST` | `/contacts/` | Add an emergency contact (with primary toggle) |
| `DELETE` | `/contacts/{contact_id}` | Remove an emergency contact |
| `POST` | `/sos/trigger` | Create an SOS alert with GPS coordinates (demo mode) |
| `GET` | `/sos/active` | Fetch the user's current active alert |
| `GET` | `/sos/history` | Incident history, with optional status filter |
| `PATCH` | `/sos/{alert_id}/cancel` | Cancel or resolve an alert |
| `POST` | `/location/breadcrumb` | Save a GPS breadcrumb during an active alert |
| `GET` | `/location/alert/{alert_id}/breadcrumbs` | Fetch recorded breadcrumbs for an alert |

---

## 🛡️ Roadmap

These are **not implemented yet**:

1. **Backend authentication:** JWT or OTP verification for mobile users.
2. **Live map tracking:** polyline rendering of breadcrumbs on the map screen.
3. **Push notifications:** connect real FCM credentials in `backend/.env`.
4. **SMS fallback:** automated SMS (e.g. Twilio) when data connectivity is poor.
5. **Real emergency dispatch:** integration with an actual emergency response channel, which would require careful legal and safety review before this app is used outside demonstration.