import json
import re
import requests
from config import OLLAMA_BASE_URL, OPENROUTER_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY

SYSTEM_PROMPT = """Tu es un médecin du travail expert et un conseiller juridique en santé au travail.
Ton rôle est d'analyser de manière critique la préconisation d'aménagement ou d'aptitude médicale saisie par un médecin, afin de vérifier sa clarté, sa légalité et son applicabilité par l'employeur.

Tu dois impérativement analyser l'écrit selon les 5 critères de mauvaise qualité suivants :
1. Imprécisions et difficultés d'application : Absence de limites temporelles claires, mention "renouvelable" sans périodicité définie, manque de clarté pour l'employeur.
2. Doute sur la force d'obligation : Utilisation du conditionnel (ex: "devrait", "pourrait") ou de formulations suggérant un choix pour l'employeur. L'avis doit être direct et directif (ex: "doit", "éviter de").
3. Informations hors cadre réglementaire : Présence d'informations superflues qui ne relèvent pas de l'avis d'aptitude strict (historique des discussions avec l'employeur ou le salarié, commentaires descriptifs).
4. Changement de poste ou inaptitude déguisée : Recommandation explicite d'un autre poste ou d'aménagements tellement lourds qu'ils équivalent à une inaptitude déguisée.
5. Rupture du secret médical ou vie privée : Mention d'informations confidentielles (comme des pathologies, symptômes, traitements, l'invalidité ou des motifs de santé personnels), ou d'informations administratives confidentielles non destinées à l'employeur.

Si des documents de référence (RAG) sont fournis ci-dessous, utilise-les pour enrichir ton analyse réglementaire et t'assurer de la conformité des préconisations.

IMPORTANT : Tu dois impérativement échapper tous les guillemets doubles présents à l'intérieur de tes explications textuelles avec un antislash (par exemple, écris \\"devrait\\" et non "devrait"). Sinon, le JSON sera invalide.

Réponds STRICTEMENT sous la forme d'un objet JSON contenant l'analyse détaillée. Le format doit être :
{
  "has_defects": true/false,
  "analysis": [
    {
      "criterion": 1,
      "name": "Imprécisions et difficultés d'application",
      "has_defect": true/false,
      "explanation": "Pourquoi le critère est en défaut ou pourquoi il est correct.",
      "suggestions": ["Une ou plusieurs suggestions précises pour corriger ce point (si has_defect est true)."]
    },
    {
      "criterion": 2,
      "name": "Doute sur la force d'obligation",
      "has_defect": true/false,
      "explanation": "...",
      "suggestions": []
    },
    {
      "criterion": 3,
      "name": "Informations hors cadre réglementaire",
      "has_defect": true/false,
      "explanation": "...",
      "suggestions": []
    },
    {
      "criterion": 4,
      "name": "Changement de poste ou inaptitude déguisée",
      "has_defect": true/false,
      "explanation": "...",
      "suggestions": []
    },
    {
      "criterion": 5,
      "name": "Rupture du secret médical ou vie privée",
      "has_defect": true/false,
      "explanation": "...",
      "suggestions": []
    }
  ],
  "reformulation_proposed": "Une proposition de préconisation entièrement reformulée et corrigée, claire, exempte de tout défaut rédactionnel et respectueuse de la législation française."
}

Ne rajoute aucune explication textuelle en dehors du JSON. Retourne uniquement l'objet JSON brut.
"""

class LLMConnector:
    def __init__(self):
        self.ollama_url = OLLAMA_BASE_URL

    def get_available_models(self) -> list:
        """Récupère la liste des modèles locaux (Ollama) et en ligne disponibles."""
        models = []
        
        # 1. Modèles locaux (Ollama)
        try:
            r = requests.get(f"{self.ollama_url}/api/tags", timeout=3)
            if r.status_code == 200:
                local_models = r.json().get("models", [])
                for m in local_models:
                    model_name = m["name"]
                    # Filtrer les modèles d'embedding (incompatibles avec le chat)
                    if "embed" in model_name.lower():
                        continue
                    models.append({
                        "name": model_name,
                        "provider": "ollama",
                        "display_name": f"Ollama - {model_name}"
                    })
        except Exception:
            # Ollama n'est pas lancé ou n'est pas installé
            pass

        # 2. Modèles en ligne configurés (OpenRouter / Qwen)
        if OPENROUTER_API_KEY:
            models.append({
                "name": "qwen/qwen-2.5-72b-instruct",
                "provider": "openrouter",
                "display_name": "Qwen 2.5 72B Instruct (En ligne - Conseillé)"
            })
            models.append({
                "name": "qwen/qwen-2.5-14b-instruct",
                "provider": "openrouter",
                "display_name": "Qwen 2.5 14B Instruct (En ligne)"
            })
            models.append({
                "name": "qwen/qwen-2.5-7b-instruct",
                "provider": "openrouter",
                "display_name": "Qwen 2.5 7B Instruct (En ligne)"
            })
        if OPENAI_API_KEY:
            models.append({
                "name": "gpt-4o-mini",
                "provider": "openai",
                "display_name": "OpenAI - GPT-4o Mini (En ligne)"
            })
            models.append({
                "name": "gpt-4o",
                "provider": "openai",
                "display_name": "OpenAI - GPT-4o (En ligne)"
            })

        return models

    def analyze_recommendation(self, model_name: str, provider: str, recommendation: str, context_chunks: list) -> dict:
        """Envoie la préconisation médicale et le contexte RAG pour analyse par le LLM."""
        
        # Construire le prompt avec le contexte documentaire s'il y en a un
        context_str = ""
        if context_chunks:
            context_str = "\n--- DOCUMENTS DE RÉFÉRENCE (RAG) ---\n"
            for idx, chunk in enumerate(context_chunks):
                context_str += f"Source [{chunk['filename']}] :\n{chunk['text']}\n\n"
            context_str += "-------------------------------------\n"

        user_content = f"{context_str}Voici la préconisation médicale à analyser :\n\"{recommendation}\""

        if provider == "ollama":
            url = f"{self.ollama_url}/api/chat"
            payload = {
                "model": model_name,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content}
                ],
                "stream": False,
                "format": "json",  # Force Ollama à répondre en JSON
                "options": {
                    "temperature": 0.1,
                    "num_ctx": 8192  # Augmenter le contexte pour accommoder le RAG
                }
            }
            try:
                # Augmenté à 300 secondes (5 min) car le chargement initial d'un grand modèle (ex: 9B, 14B) en RAM/VRAM
                # peut prendre du temps sur certaines machines.
                r = requests.post(url, json=payload, timeout=300)
                if r.status_code == 200:
                    response_json = r.json()
                    content = response_json.get("message", {}).get("content", "")
                    return self._parse_json_response(content)
                raise Exception(f"Erreur Ollama : {r.text}")
            except Exception as e:
                print(f"[!] Erreur de communication avec Ollama : {e}")
                raise e

        elif provider == "openrouter":
            if not OPENROUTER_API_KEY:
                raise Exception("OPENROUTER_API_KEY manquante dans le fichier .env")
            
            url = "https://openrouter.ai/api/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:8000",
                "X-Title": "Assistant d'Aptitude Medicale"
            }
            payload = {
                "model": model_name,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content}
                ],
                "temperature": 0.1
            }
            try:
                r = requests.post(url, json=payload, headers=headers, timeout=60)
                if r.status_code == 200:
                    res_data = r.json()
                    if "error" in res_data:
                        raise Exception(res_data["error"].get("message", "Erreur OpenRouter inconnue"))
                    if "choices" not in res_data or not res_data["choices"]:
                        raise Exception(f"Aucune réponse générée par l'API (choices vide). Réponse brute : {res_data}")
                    content = res_data["choices"][0].get("message", {}).get("content", "")
                    return self._parse_json_response(content)
                raise Exception(f"Erreur API OpenRouter : {r.text}")
            except Exception as e:
                print(f"[!] Erreur de communication avec OpenRouter : {e}")
                raise e

        elif provider == "openai":
            if not OPENAI_API_KEY:
                raise Exception("OPENAI_API_KEY manquante dans le fichier .env")
            
            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": model_name,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content}
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.1
            }
            try:
                r = requests.post(url, json=payload, headers=headers, timeout=30)
                if r.status_code == 200:
                    res_data = r.json()
                    content = res_data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    return self._parse_json_response(content)
                raise Exception(f"Erreur API OpenAI : {r.text}")
            except Exception as e:
                print(f"[!] Erreur de communication avec OpenAI : {e}")
                raise e
        else:
            raise Exception(f"Provider inconnu : {provider}")

    def _repair_json_string(self, text: str) -> str:
        """Tente de réparer les guillemets non échappés dans les chaînes JSON."""
        lines = text.splitlines()
        repaired_lines = []
        for line in lines:
            # 1. Ligne clé-valeur: "key": "value" ou "key": "value",
            match_kv = re.match(r'^(\s*"[a-zA-Z0-9_]+")\s*:\s*"(.*)"\s*(,?)$', line)
            if match_kv:
                key_part = match_kv.group(1)
                value_part = match_kv.group(2)
                comma_part = match_kv.group(3)
                # Échapper les " non précédés d'un backslash
                escaped_value = re.sub(r'(?<!\\)"', r'\"', value_part)
                line = f"{key_part}: \"{escaped_value}\"{comma_part}"
            else:
                # 2. Ligne élément de tableau: "value" ou "value",
                match_arr = re.match(r'^(\s*)"(.*)"\s*(,?)$', line)
                if match_arr and ":" not in line.split('"')[0]:
                    indent = match_arr.group(1)
                    value_part = match_arr.group(2)
                    comma_part = match_arr.group(3)
                    escaped_value = re.sub(r'(?<!\\)"', r'\"', value_part)
                    line = f"{indent}\"{escaped_value}\"{comma_part}"
            repaired_lines.append(line)
        return "\n".join(repaired_lines)

    def _parse_json_response(self, text: str) -> dict:
        """Nettoie et extrait l'objet JSON de la réponse brute de l'IA."""
        text_clean = text.strip()
        if not text_clean:
            raise ValueError("La réponse du LLM est vide.")

        # Trouver le premier '{' et le dernier '}' pour extraire l'objet JSON brut
        first_brace = text_clean.find('{')
        last_brace = text_clean.rfind('}')
        
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            json_candidate = text_clean[first_brace:last_brace+1]
        else:
            json_candidate = text_clean

        try:
            return json.loads(json_candidate)
        except Exception as e:
            print(f"[!] Échec du premier parsing JSON : {e}")
            try:
                # Tentative de réparation automatique des guillemets
                repaired = self._repair_json_string(json_candidate)
                return json.loads(repaired)
            except Exception as e2:
                print(f"[!] Échec de la réparation du JSON : {e2}")
                print(f"Texte candidat extrait : {json_candidate}")
                print(f"Texte d'origine complet : {text}")
                return {
                    "has_defects": True,
                    "analysis": [
                        {"criterion": 1, "name": "Imprécisions et difficultés d'application", "has_defect": True, "explanation": f"Erreur de formatage du JSON retourné par le LLM. Erreur : {e2}", "suggestions": []},
                        {"criterion": 2, "name": "Doute sur la force d'obligation", "has_defect": False, "explanation": "", "suggestions": []},
                        {"criterion": 3, "name": "Informations hors cadre réglementaire", "has_defect": False, "explanation": "", "suggestions": []},
                        {"criterion": 4, "name": "Changement de poste ou inaptitude déguisée", "has_defect": False, "explanation": "", "suggestions": []},
                        {"criterion": 5, "name": "Rupture du secret médical ou vie privée", "has_defect": False, "explanation": "", "suggestions": []}
                    ],
                    "reformulation_proposed": "Une erreur s'est produite lors de l'analyse (format JSON invalide). Veuillez réessayer."
                }

