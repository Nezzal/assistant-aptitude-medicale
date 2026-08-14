import os
from pathlib import Path
from dotenv import load_dotenv

# Trouver le chemin racine du projet (un niveau au-dessus du dossier backend)
BASE_DIR = Path(__file__).resolve().parent.parent

# Charger le fichier .env depuis la racine du projet
load_dotenv(BASE_DIR / ".env")

PORT = int(os.getenv("PORT", 8000))
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Dossier des documents de référence (RAG)
DOCUMENTS_DIR = BASE_DIR / "documents"
DOCUMENTS_DIR.mkdir(exist_ok=True)

# Index vectoriel local (fichier JSON simple pour la persistance)
VECTOR_DB_PATH = BASE_DIR / "backend" / "vector_db.json"

# Configuration des Embeddings pour le RAG
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "ollama").lower()  # 'ollama', 'gemini', 'openai'
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")
