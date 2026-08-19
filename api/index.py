import os
import sys
from pathlib import Path

# Configurer les chemins d'accès pour Vercel Serverless
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"

sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(ROOT_DIR))

# Importer l'instance FastAPI depuis backend/app.py
from app import app
