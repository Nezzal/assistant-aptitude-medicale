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
from typing import Optional, List

from config import PORT, DOCUMENTS_DIR
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

SAVED_FICHES_PATH = Path(__file__).resolve().parent / "saved_fiches.json"

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
            context_chunks=context_chunks
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
frontend_dir = Path(__file__).resolve().parent.parent / "frontend"

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
    print(f"[*] Démarrage du serveur sur http://localhost:{PORT}")
    uvicorn.run("app:app", host="127.0.0.1", port=PORT, reload=True)
