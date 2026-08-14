import os
import json
import time
import requests
from pathlib import Path
import fitz  # PyMuPDF
import numpy as np

from config import (
    DOCUMENTS_DIR,
    VECTOR_DB_PATH,
    EMBEDDING_PROVIDER,
    EMBEDDING_MODEL,
    OLLAMA_BASE_URL,
    GEMINI_API_KEY,
    OPENAI_API_KEY
)

class RAGEngine:
    def __init__(self):
        self.documents_dir = Path(DOCUMENTS_DIR)
        self.vector_db_path = Path(VECTOR_DB_PATH)
        self.index = []
        self.load_index()

    def load_index(self):
        """Charge l'index vectoriel depuis le fichier JSON s'il existe."""
        if self.vector_db_path.exists():
            try:
                with open(self.vector_db_path, "r", encoding="utf-8") as f:
                    self.index = json.load(f)
                print(f"[*] Index vectoriel chargé : {len(self.index)} segments.")
            except Exception as e:
                print(f"[!] Erreur lors du chargement de l'index : {e}")
                self.index = []
        else:
            self.index = []

    def save_index(self):
        """Sauvegarde l'index vectoriel dans le fichier JSON."""
        try:
            with open(self.vector_db_path, "w", encoding="utf-8") as f:
                json.dump(self.index, f, ensure_ascii=False, indent=2)
            print(f"[*] Index vectoriel sauvegardé ({len(self.index)} segments).")
        except Exception as e:
            print(f"[!] Erreur lors de la sauvegarde de l'index : {e}")

    def get_embedding(self, text: str) -> list:
        """Génère l'embedding pour un texte donné selon le provider configuré."""
        if EMBEDDING_PROVIDER == "ollama":
            url = f"{OLLAMA_BASE_URL}/api/embeddings"
            # Tester d'abord l'endpoint standard /api/embeddings
            try:
                r = requests.post(url, json={"model": EMBEDDING_MODEL, "prompt": text}, timeout=10)
                if r.status_code == 200:
                    return r.json().get("embedding", [])
            except Exception:
                pass
            
            # Repli sur /api/embed si disponible
            try:
                url_embed = f"{OLLAMA_BASE_URL}/api/embed"
                r = requests.post(url_embed, json={"model": EMBEDDING_MODEL, "input": text}, timeout=10)
                if r.status_code == 200:
                    embeddings = r.json().get("embeddings", [])
                    if embeddings:
                        return embeddings[0]
            except Exception as e:
                print(f"[!] Erreur d'appel embedding Ollama : {e}")
            
            # Si le modèle d'embedding n'est pas chargé, on tente d'utiliser le modèle par défaut d'Ollama
            raise Exception("Impossible d'obtenir un embedding d'Ollama. Assurez-vous qu'Ollama tourne et que le modèle d'embedding est téléchargé (ex: ollama pull nomic-embed-text)")

        elif EMBEDDING_PROVIDER == "gemini":
            if not GEMINI_API_KEY:
                raise Exception("Clé GEMINI_API_KEY manquante dans le fichier .env")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{EMBEDDING_MODEL}:embedContent?key={GEMINI_API_KEY}"
            payload = {
                "model": f"models/{EMBEDDING_MODEL}",
                "content": {"parts": [{"text": text}]}
            }
            r = requests.post(url, json=payload, timeout=10)
            if r.status_code == 200:
                return r.json().get("embedding", {}).get("values", [])
            raise Exception(f"Erreur API Gemini Embedding: {r.text}")

        elif EMBEDDING_PROVIDER == "openai":
            if not OPENAI_API_KEY:
                raise Exception("Clé OPENAI_API_KEY manquante dans le fichier .env")
            url = "https://api.openai.com/v1/embeddings"
            headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
            payload = {"model": EMBEDDING_MODEL, "input": text}
            r = requests.post(url, json=payload, headers=headers, timeout=10)
            if r.status_code == 200:
                return r.json().get("data", [{}])[0].get("embedding", [])
            raise Exception(f"Erreur API OpenAI Embedding: {r.text}")

        else:
            raise Exception(f"Provider d'embedding inconnu: {EMBEDDING_PROVIDER}")

    def extract_text(self, filepath: Path) -> str:
        """Extrait le texte d'un fichier PDF, TXT ou MD."""
        suffix = filepath.suffix.lower()
        if suffix == ".txt" or suffix == ".md":
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        elif suffix == ".pdf":
            text = ""
            try:
                doc = fitz.open(filepath)
                for page in doc:
                    text += page.get_text() + "\n"
                doc.close()
            except Exception as e:
                print(f"[!] Erreur d'extraction du PDF {filepath.name} : {e}")
            return text
        return ""

    def chunk_text(self, text: str, chunk_size=800, overlap=150) -> list:
        """Découpe le texte en segments avec recouvrement."""
        chunks = []
        if not text.strip():
            return chunks
        
        words = text.split()
        i = 0
        while i < len(words):
            chunk_words = words[i : i + chunk_size]
            chunk_text = " ".join(chunk_words)
            chunks.append(chunk_text)
            i += (chunk_size - overlap)
            
        return chunks

    def scan_and_index(self) -> dict:
        """
        Scanne le dossier documents/, vérifie les fichiers modifiés ou nouveaux,
        et met à jour l'index vectoriel.
        """
        files = list(self.documents_dir.glob("*"))
        valid_extensions = {".pdf", ".txt", ".md"}
        doc_files = [f for f in files if f.suffix.lower() in valid_extensions]
        
        # Récupérer l'état actuel de l'index pour savoir quels fichiers sont déjà indexés
        indexed_files = {}
        for entry in self.index:
            filename = entry["filename"]
            mtime = entry.get("mtime", 0)
            if filename not in indexed_files:
                indexed_files[filename] = mtime

        # Fichiers à réindexer ou nouveaux
        to_index = []
        current_filenames = []
        
        for filepath in doc_files:
            filename = filepath.name
            current_filenames.append(filename)
            mtime = filepath.stat().st_mtime
            
            # Si le fichier n'est pas indexé ou a été modifié
            if filename not in indexed_files or mtime > indexed_files[filename]:
                to_index.append((filepath, mtime))

        # Supprimer de l'index les fichiers qui n'existent plus dans le dossier
        original_len = len(self.index)
        self.index = [entry for entry in self.index if entry["filename"] in current_filenames]
        if len(self.index) != original_len:
            print(f"[*] Supprimé de l'index : {original_len - len(self.index)} segments obsolètes.")

        if not to_index:
            if len(self.index) != original_len:
                self.save_index()
            return {"status": "success", "message": "Index déjà à jour.", "indexed_count": 0}

        print(f"[*] Début de l'indexation de {len(to_index)} fichiers...")
        new_entries = []
        
        for filepath, mtime in to_index:
            print(f"  -> Indexation de {filepath.name}...")
            # Supprimer l'ancienne version du fichier dans l'index s'il est mis à jour
            self.index = [entry for entry in self.index if entry["filename"] != filepath.name]
            
            text = self.extract_text(filepath)
            chunks = self.chunk_text(text)
            
            for idx, chunk in enumerate(chunks):
                if not chunk.strip():
                    continue
                try:
                    embedding = self.get_embedding(chunk)
                    if embedding:
                        new_entries.append({
                            "filename": filepath.name,
                            "chunk_id": idx,
                            "text": chunk,
                            "embedding": embedding,
                            "mtime": mtime
                        })
                        # Petit délai pour éviter de saturer les API
                        time.sleep(0.05)
                except Exception as e:
                    print(f"  [!] Échec de vectorisation pour le segment {idx} de {filepath.name} : {e}")
                    return {"status": "error", "message": str(e)}

        self.index.extend(new_entries)
        self.save_index()
        return {
            "status": "success", 
            "message": f"Indexation réussie. {len(new_entries)} segments ajoutés.", 
            "indexed_count": len(new_entries)
        }

    def search(self, query: str, top_k=3) -> list:
        """Recherche les segments les plus proches de la requête (sémantique ou textuelle)."""
        if not self.index:
            return []

        try:
            query_embedding = self.get_embedding(query)
            if not query_embedding:
                raise Exception("Embedding vide")
            
            q_vec = np.array(query_embedding)
            results = []

            for entry in self.index:
                e_vec = np.array(entry["embedding"])
                dot_product = np.dot(q_vec, e_vec)
                norm_q = np.linalg.norm(q_vec)
                norm_e = np.linalg.norm(e_vec)
                
                if norm_q > 0 and norm_e > 0:
                    similarity = float(dot_product / (norm_q * norm_e))
                else:
                    similarity = 0.0

                results.append({
                    "filename": entry["filename"],
                    "text": entry["text"],
                    "similarity": similarity
                })
            
            results.sort(key=lambda x: x["similarity"], reverse=True)
            return results[:top_k]

        except Exception as e:
            print(f"[!] Erreur de recherche sémantique (RAG), repli sur la recherche textuelle : {e}")
            
            # Recherche textuelle simple par mots-clés
            query_words = [w.lower() for w in query.split() if len(w) > 2]
            if not query_words:
                return []
            
            results = []
            for entry in self.index:
                text_lower = entry["text"].lower()
                matches = sum(1 for word in query_words if word in text_lower)
                if matches > 0:
                    # Calculer un score de similarité basé sur la proportion de mots-clés présents
                    similarity = float(matches) / len(query_words)
                    results.append({
                        "filename": entry["filename"],
                        "text": entry["text"],
                        "similarity": similarity
                    })
            
            results.sort(key=lambda x: x["similarity"], reverse=True)
            return results[:top_k]

    def get_indexed_files(self) -> list:
        """Retourne la liste des fichiers uniques actuellement indexés."""
        files = set()
        for entry in self.index:
            files.add(entry["filename"])
        return sorted(list(files))
