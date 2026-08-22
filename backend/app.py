import os
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path
import json
import time
import zipfile
import shutil
import subprocess
from typing import Optional, List

from config import PORT, DOCUMENTS_DIR, USER_DATA_DIR
from rag_engine import RAGEngine
from llm_connector import LLMConnector

class FicheSchema(BaseModel):
    id: Optional[str] = None
    type: str
    doctor_title: str
    doctor_name: str
    structure: str
    employeur: str
    worker: str
    post: str
    date: str
    city: str
    conclusion: str
    recommendation: str

SAVED_FICHES_PATH = USER_DATA_DIR / "saved_fiches.json"

def read_saved_fiches() -> list:
    if not SAVED_FICHES_PATH.exists():
        return []
    try:
        with open(SAVED_FICHES_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[!] Erreur de lecture des fiches : {e}")
        return []

def write_saved_fiches(fiches: list):
    try:
        with open(SAVED_FICHES_PATH, "w", encoding="utf-8") as f:
            json.dump(fiches, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[!] Erreur d'écriture des fiches : {e}")

# S'assurer que le dossier des documents existe
Path(DOCUMENTS_DIR).mkdir(exist_ok=True)

# Initialisation du backend
rag = RAGEngine()
llm = LLMConnector()

app = FastAPI(title="Assistant Aptitude Médicale API")

# Activer CORS pour le développement
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modèles de requêtes Pydantic
class AnalyzeRequest(BaseModel):
    recommendation: str
    model_name: str
    provider: str
    use_rag: bool = True
    language: str = "ar"

from fastapi.responses import StreamingResponse
import requests

class PullModelRequest(BaseModel):
    model_name: str

@app.post("/api/pull")
async def pull_model(request: PullModelRequest):
    try:
        from config import OLLAMA_BASE_URL
        def generate():
            url = f"{OLLAMA_BASE_URL}/api/pull"
            payload = {"name": request.model_name, "stream": True}
            r = requests.post(url, json=payload, stream=True, timeout=600)
            for chunk in r.iter_content(chunk_size=None):
                yield chunk
        return StreamingResponse(generate(), media_type="application/x-ndjson")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/start-ollama")
async def start_ollama():
    try:
        import platform
        current_os = platform.system().lower()
        if "darwin" in current_os:
            if Path("/Applications/Ollama.app").exists():
                subprocess.Popen(["open", "/Applications/Ollama.app"])
            else:
                subprocess.Popen(["open", "-a", "Ollama"])
            return {"status": "success", "message": "Tentative de démarrage d'Ollama sur macOS."}
        elif "win" in current_os:
            ollama_exe = Path(os.path.expandvars(r"%LOCALAPPDATA%\Programs\Ollama\ollama.exe"))
            if ollama_exe.exists():
                subprocess.Popen([str(ollama_exe), "app"])
            else:
                subprocess.Popen(["cmd", "/c", "start", "ollama"])
            return {"status": "success", "message": "Tentative de démarrage d'Ollama sur Windows."}
        else:
            subprocess.Popen(["ollama", "serve"])
            return {"status": "success", "message": "Tentative de démarrage d'Ollama sur Linux."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Impossible de démarrer Ollama : {str(e)}")

@app.post("/api/install-ollama")
async def install_ollama():
    def generate():
        try:
            yield json.dumps({"status": "downloading", "completed": 0, "total": 100}) + "\n"
            zip_url = "https://ollama.com/download/Ollama-darwin.zip"
            
            # Télécharger le zip en chunks
            r = requests.get(zip_url, stream=True, timeout=600)
            if r.status_code != 200:
                yield json.dumps({"status": "error", "message": f"Erreur de téléchargement d'Ollama (code {r.status_code})"}) + "\n"
                return

            total_size = int(r.headers.get('content-length', 0))
            completed_size = 0
            
            # Dossier temporaire pour stocker le zip
            scratch_dir = USER_DATA_DIR / "scratch"
            scratch_dir.mkdir(parents=True, exist_ok=True)
            zip_path = scratch_dir / "ollama.zip"

            with open(zip_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=65536):
                    if chunk:
                        f.write(chunk)
                        completed_size += len(chunk)
                        if total_size > 0:
                            yield json.dumps({
                                "status": "downloading", 
                                "completed": completed_size, 
                                "total": total_size
                            }) + "\n"

            yield json.dumps({"status": "extracting", "message": "Extraction de l'application..."}) + "\n"
            
            # Extraire le zip en préservant les permissions d'exécution Unix (chmod +x)
            extract_dir = scratch_dir / "extracted"
            extract_dir.mkdir(exist_ok=True)
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                for info in zip_ref.infolist():
                    extracted_file = zip_ref.extract(info, extract_dir)
                    permission = info.external_attr >> 16
                    if permission:
                        os.chmod(extracted_file, permission)

            yield json.dumps({"status": "moving", "message": "Installation dans le dossier Applications..."}) + "\n"
            
            app_src = extract_dir / "Ollama.app"
            app_dest = Path("/Applications/Ollama.app")
            
            # Fermer Ollama s'il tourne pour libérer les fichiers
            subprocess.run(["pkill", "-f", "Ollama"])
            time.sleep(1)
            
            if app_dest.exists():
                shutil.rmtree(app_dest)

            shutil.move(str(app_src), str(app_dest))

            # Nettoyage
            zip_path.unlink()
            shutil.rmtree(extract_dir)

            yield json.dumps({"status": "launching", "message": "Démarrage d'Ollama..."}) + "\n"
            subprocess.Popen(["open", "/Applications/Ollama.app"])
            
            yield json.dumps({"status": "completed", "message": "Ollama a été installé et démarré avec succès !"}) + "\n"
        except Exception as e:
            yield json.dumps({"status": "error", "message": str(e)}) + "\n"
            
    return StreamingResponse(generate(), media_type="application/x-ndjson")

# 1. Endpoint pour lister les modèles disponibles (Ollama + En ligne)
@app.get("/api/models")
async def get_models():
    try:
        models = llm.get_available_models()
        return {"status": "success", "models": models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 2. Endpoint pour lister les documents indexés
@app.get("/api/documents")
async def get_documents():
    try:
        files = rag.get_indexed_files()
        return {"status": "success", "documents": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 3. Endpoint pour forcer la réindexation du dossier documents/
@app.post("/api/index")
async def reindex_documents():
    try:
        result = rag.scan_and_index()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 4. Endpoint principal d'analyse d'une préconisation
@app.post("/api/analyze")
async def analyze_recommendation(request: AnalyzeRequest):
    if not request.recommendation.strip():
        raise HTTPException(status_code=400, detail="La préconisation ne peut pas être vide.")
    
    try:
        context_chunks = []
        if request.use_rag:
            # Récupérer les segments les plus pertinents de nos documents locaux
            context_chunks = rag.search(request.recommendation, top_k=3)
            print(f"[*] RAG actif : {len(context_chunks)} segments trouvés pour la recherche.")

        # Analyser avec le LLM configuré
        result = llm.analyze_recommendation(
            model_name=request.model_name,
            provider=request.provider,
            recommendation=request.recommendation,
            context_chunks=context_chunks,
            language=request.language
        )
        
        # Ajouter le contexte RAG dans la réponse pour transparence de l'interface
        result["rag_sources"] = [
            {"filename": chunk["filename"], "text": chunk["text"], "similarity": chunk["similarity"]}
            for chunk in context_chunks
        ]
        
        return result
    except Exception as e:
        print(f"[!] Erreur d'analyse : {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 6. Endpoint pour lister toutes les fiches sauvegardées
@app.get("/api/fiches")
async def get_fiches():
    try:
        return {"status": "success", "fiches": read_saved_fiches()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 7. Endpoint pour sauvegarder ou mettre à jour une fiche
@app.post("/api/fiches")
async def save_fiche(fiche: FicheSchema):
    try:
        fiches = read_saved_fiches()
        
        # Si pas d'ID, c'est une nouvelle fiche
        if not fiche.id:
            fiche_dict = fiche.dict()
            fiche_dict["id"] = str(int(time.time() * 1000))
            fiches.insert(0, fiche_dict)
            write_saved_fiches(fiches)
            return {"status": "success", "message": "Fiche sauvegardée avec succès.", "fiche": fiche_dict}
        else:
            # Mettre à jour la fiche existante
            for i, item in enumerate(fiches):
                if item["id"] == fiche.id:
                    fiches[i] = fiche.dict()
                    write_saved_fiches(fiches)
                    return {"status": "success", "message": "Fiche mise à jour avec succès.", "fiche": fiches[i]}
            
            # Si l'ID n'a pas été trouvé, on en crée une nouvelle
            fiche_dict = fiche.dict()
            fiches.insert(0, fiche_dict)
            write_saved_fiches(fiches)
            return {"status": "success", "message": "Fiche sauvegardée avec succès.", "fiche": fiche_dict}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 8. Endpoint pour supprimer une fiche
@app.delete("/api/fiches/{fiche_id}")
async def delete_fiche(fiche_id: str):
    try:
        fiches = read_saved_fiches()
        filtered_fiches = [item for item in fiches if item["id"] != fiche_id]
        
        if len(filtered_fiches) == len(fiches):
            raise HTTPException(status_code=404, detail="Fiche non trouvée.")
            
        write_saved_fiches(filtered_fiches)
        return {"status": "success", "message": "Fiche supprimée avec succès."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 5. Servir l'interface utilisateur
from config import BASE_DIR
frontend_dir = BASE_DIR / "frontend"

if frontend_dir.exists():
    # Servir les fichiers statiques de style/script
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

    # Route d'accès principal de l'UI
    @app.get("/")
    async def serve_ui():
        index_path = frontend_dir / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        return {"status": "error", "message": "Fichier index.html manquant dans frontend/"}
else:
    print("[!] Attention : Dossier frontend/ non trouvé. Le serveur ne servira que l'API.")

if __name__ == "__main__":
    import sys
    host = os.getenv("HOST", "127.0.0.1")
    # Désactiver le reload automatique si on est compilé avec PyInstaller ou sur Render
    is_frozen = getattr(sys, 'frozen', False)
    reload_mode = (os.getenv("RENDER") is None) and not is_frozen
    
    print(f"[*] Démarrage du serveur sur http://{host}:{PORT} (Reload: {reload_mode})")
    if is_frozen:
        # En mode PyInstaller, il faut passer l'instance app directement et non sous forme de chaîne
        uvicorn.run(app, host=host, port=PORT)
    else:
        uvicorn.run("app:app", host=host, port=PORT, reload=reload_mode)
