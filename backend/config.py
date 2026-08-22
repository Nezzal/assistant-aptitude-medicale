import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Trouver le chemin racine du projet
if getattr(sys, 'frozen', False):
    # Si on est dans le binaire PyInstaller (ex: app.exe)
    BASE_DIR = Path(sys.executable).resolve().parent.parent
else:
    BASE_DIR = Path(__file__).resolve().parent.parent

# Dossier des données utilisateur (pour éviter les erreurs de permission sur Windows)
USER_DATA_DIR = Path.home() / ".assistant_aptitude"
USER_DATA_DIR.mkdir(parents=True, exist_ok=True)

# Charger le fichier .env depuis la racine du projet s'il existe
env_path = BASE_DIR / ".env"
if env_path.exists():
    load_dotenv(env_path)

PORT = int(os.getenv("PORT", 8000))
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Dossier des documents de référence (RAG)
DOCUMENTS_DIR = BASE_DIR / "documents"
if not DOCUMENTS_DIR.exists():
    DOCUMENTS_DIR = USER_DATA_DIR / "documents"
    DOCUMENTS_DIR.mkdir(exist_ok=True)

# Index vectoriel local (fichier JSON simple pour la persistance)
VECTOR_DB_PATH = USER_DATA_DIR / "vector_db.json"

# Configuration des Embeddings pour le RAG
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "ollama").lower()  # 'ollama', 'gemini', 'openai'
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")
