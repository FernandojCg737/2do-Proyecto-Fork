import os
from pathlib import Path
import sys
from dotenv import load_dotenv

if getattr(sys, "frozen", False):
    BASE_DIR = Path(sys._MEIPASS)
else:
    BASE_DIR = Path(__file__).resolve().parents[2]

env_root = BASE_DIR / ".env"
env_backend = BASE_DIR / "backend" / ".env"
if env_root.exists():
    load_dotenv(env_root)
elif env_backend.exists():
    load_dotenv(env_backend)
else:
    load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "studymatch-clave-secreta-para-desarrollo")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
TOKEN_EXPIRE_HOURS = int(os.getenv("TOKEN_EXPIRE_HOURS", "24"))

allowed_origins_raw = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000"
)
ALLOWED_ORIGINS = [origin.strip() for origin in allowed_origins_raw.split(",") if origin.strip()]

FRONTEND_DIR = BASE_DIR / "frontend" / "dist"
INDEX_FILE = FRONTEND_DIR / "index.html"
ASSETS_DIR = FRONTEND_DIR / "assets"
