import json
import re
import requests
from config import OLLAMA_BASE_URL

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
        """Récupère la liste des modèles locaux (Ollama) disponibles."""
        models = []
        installed_names = []
        ollama_running = False
        
        # 1. Modèles locaux (Ollama)
        try:
            r = requests.get(f"{self.ollama_url}/api/tags", timeout=3)
            if r.status_code == 200:
                ollama_running = True
                local_models = r.json().get("models", [])
                for m in local_models:
                    model_name = m["name"]
                    if "embed" in model_name.lower():
                        continue
                    installed_names.append(model_name.lower())
                    models.append({
                        "name": model_name,
                        "provider": "ollama",
                        "display_name": f"Ollama - {model_name}",
                        "installed": True
                    })
        except Exception:
            pass

        if ollama_running:
            # Recommandations à proposer s'ils ne sont pas déjà installés
            recommendations = [
                ("qwen2.5:3b", "Qwen 2.5 3B (Recommandé - Modèle local léger)"),
                ("qwen2.5", "Qwen 2.5 (Recommandé - Modèle complet)"),
                ("deepseek-r1:1.5b", "DeepSeek-R1 1.5B (Ultra-léger)")
            ]
            for rec_name, rec_display in recommendations:
                already_installed = False
                for installed in installed_names:
                    # Comparer de manière précise avec le nom et la taille (ex: deepseek-r1:1.5b)
                    if rec_name in installed or installed.startswith(rec_name):
                        already_installed = True
                        break
                if not already_installed:
                    models.append({
                        "name": rec_name,
                        "provider": "ollama",
                        "display_name": rec_display,
                        "installed": False
                    })
        else:
            models.append({
                "name": "qwen2.5-demo",
                "provider": "openrouter" if OPENROUTER_API_KEY else "demo",
                "display_name": "🌐 Démo Web Anonyme (3 essais)",
                "installed": True
            })

        return models

    def analyze_recommendation(self, model_name: str, provider: str, recommendation: str, context_chunks: list, language: str = "ar") -> dict:
        """Envoie la préconisation médicale et le contexte RAG pour analyse par le LLM."""

        # Consigne de langue stricte
        lang_prompt = ""
        if language == "ar":
            lang_prompt = "\n\nIMPORTANT CONSTRUCT: Réponds STRICTEMENT et INTÉGRALEMENT EN ARABE (اللغة العربية). Toutes les explications, les suggestions et la reformulation doivent être rédigées en arabe littéraire et médical de haute qualité."
        elif language == "en":
            lang_prompt = "\n\nIMPORTANT CONSTRUCT: Respond STRICTLY and ENTIRELY IN ENGLISH. All explanations, suggestions, and the proposed reformulation MUST be written in professional medical English."
        else:
            lang_prompt = "\n\nIMPORTANT CONSTRUCT: Réponds STRICTEMENT en FRANÇAIS. Toutes les explications, les suggestions et la reformulation doivent être rédigées en français."

        # Construire le prompt avec le contexte documentaire s'il y en a un
        context_str = ""
        if context_chunks:
            context_str = "\n--- DOCUMENTS DE RÉFÉRENCE (RAG) ---\n"
            for idx, chunk in enumerate(context_chunks):
                context_str += f"Source [{chunk['filename']}] :\n{chunk['text']}\n\n"
            context_str += "-------------------------------------\n"

        user_content = f"{context_str}Voici la préconisation médicale à analyser :\n\"{recommendation}\"{lang_prompt}"

        try:
            if provider == "ollama":
                url = f"{self.ollama_url}/api/chat"
                payload = {
                    "model": model_name,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT + lang_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    "stream": False,
                    "format": "json",
                    "options": {
                        "temperature": 0.1,
                        "num_ctx": 8192
                    }
                }
                r = requests.post(url, json=payload, timeout=300)
                if r.status_code == 200:
                    response_json = r.json()
                    content = response_json.get("message", {}).get("content", "")
                    return self._parse_json_response(content)
                else:
                    err_body = r.text
                    if "not found" in err_body.lower():
                        raise Exception(f"Le modèle '{model_name}' n'est pas encore téléchargé. Veuillez exécuter la commande 'ollama pull {model_name}' dans votre terminal pour l'installer.")
                    raise Exception(f"Erreur du serveur Ollama : {err_body}")

            elif provider == "openrouter" or (provider == "demo" and OPENROUTER_API_KEY):
                if not OPENROUTER_API_KEY:
                    return self._generate_fallback_analysis(recommendation, context_chunks, "Démo Web sans API", language)
                
                url = "https://openrouter.ai/api/v1/chat/completions"
                headers = {
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:8000",
                    "X-Title": "Assistant d'Aptitude Medicale (Demo Web)"
                }
                payload = {
                    "model": model_name if model_name != "demo" else "qwen/qwen-2.5-72b-instruct",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT + lang_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    "temperature": 0.1
                }
                r = requests.post(url, json=payload, headers=headers, timeout=30)
                if r.status_code == 200:
                    res_data = r.json()
                    content = res_data["choices"][0]["message"]["content"]
                    return self._parse_json_response(content)
                else:
                    return self._generate_fallback_analysis(recommendation, context_chunks, f"Erreur API Démo ({r.status_code})", language)

            else:
                # Si Ollama n'est pas accessible, basculement automatique sur le mode autonome RAG
                return self._generate_fallback_analysis(recommendation, context_chunks, "Moteur local non connecté", language)

        except Exception as e:
            import traceback
            traceback.print_exc()
            err_msg = str(e)
            if provider == "ollama":
                print(f"[!] Ollama hors-ligne ou inaccessible ({err_msg}). Passage en mode dégradé (RAG autonome).")
                return self._generate_fallback_analysis(recommendation, context_chunks, err_msg, language)
            raise Exception(f"Erreur de communication avec l'IA ({model_name}) : {err_msg}")

    def _generate_fallback_analysis(self, recommendation: str, context_chunks: list, error_msg: str, language: str = "ar") -> dict:
        """Génère une réponse d'analyse de secours basée sur le RAG et les règles lorsque le LLM est indisponible."""
        analysis = []
        rec_lower = recommendation.lower()

        is_ar = language == "ar"
        is_en = language == "en"

        # 1. Force d'obligation (conditionnels)
        has_conditional = any(word in rec_lower for word in ["devrait", "pourrait", "envisager", "si possible", "souhaitable", "éventuellement"])
        
        name_2 = "الشك في القوة الإلزامية" if is_ar else ("Doubt on binding force" if is_en else "Doubt on binding force / Doute sur la force d'obligation")
        exp_2 = "صياغة شرطية تشير إلى الخيار بدلاً من الأمر المباشر." if is_ar else ("Conditional phrasing suggesting a choice instead of a direct order." if is_en else "Formulation au conditionnel ou suggérant un choix.")
        sug_2 = ["استخدام صيغة المباشر الإلزامي: 'يجب'، 'تجنب'، 'الحد من'."] if is_ar else (["Use imperative phrasing: 'must', 'avoidance of', 'limitation to'."] if is_en else ["Employer un ton directif : 'doit', 'éviction de', 'aménagement de'."])

        analysis.append({
            "criterion": 2,
            "name": name_2,
            "has_defect": has_conditional,
            "explanation": exp_2 if has_conditional else ("الصياغة مباشرة." if is_ar else ("Direct phrasing used." if is_en else "Rédaction directe au présent de l'indicatif.")),
            "suggestions": sug_2 if has_conditional else []
        })

        # 2. Secret médical
        medical_terms = ["maladie", "pathologie", "traitement", "soins", "cancer", "dépression", "souffrance", "hospitalisation", "docteur", "médicament"]
        has_medical = any(word in rec_lower for word in medical_terms)
        name_5 = "خرق السر الطبي أو الحياة الخاصة" if is_ar else ("Breach of medical confidentiality" if is_en else "Rupture du secret médical ou vie privée")
        exp_5 = "احتمال وجود معلومات طبية سرية." if is_ar else ("Potential presence of confidential medical information." if is_en else "Presence potentielle d'informations médicales confidentielles.")
        sug_5 = ["إزالة أي إشارة إلى الأعراض أو التشخيص أو العلاجات."] if is_ar else (["Remove any reference to symptoms, diagnosis, or treatments."] if is_en else ["Supprimer toute mention de symptômes, diagnostics ou traitements."])

        analysis.append({
            "criterion": 5,
            "name": name_5,
            "has_defect": has_medical,
            "explanation": exp_5 if has_medical else ("لم يتم العثور على معلومات طبية سرية صريحة." if is_ar else ("No explicit medical data found." if is_en else "Aucune information médicale confidentielle explicite relevée.")),
            "suggestions": sug_5 if has_medical else []
        })

        # 3. Imprécisions temporelles
        imprecise_terms = ["renouvelable", "régulièrement", "un certain temps", "provisoirement", "ultérieurement"]
        has_imprecision = any(word in rec_lower for word in imprecise_terms)
        name_1 = "عدم الدقة وصعوبات التطبيق" if is_ar else ("Imprecisions and application issues" if is_en else "Imprécisions et difficultés d'application")
        exp_1 = "مصطلحات زمنية غامضة دون تحديد مدة دقيقة." if is_ar else ("Vague timeframes without exact duration." if is_en else "Termes temporels vagues sans durée précise définie.")
        sug_1 = ["تحديد مدة دقيقة (مثال: 'لمدة 3 أشهر')."] if is_ar else (["Specify an exact duration (e.g. 'for a period of 3 months')."] if is_en else ["Préciser une durée exacte (ex: 'pour une durée de 3 mois')."])

        analysis.append({
            "criterion": 1,
            "name": name_1,
            "has_defect": has_imprecision,
            "explanation": exp_1 if has_imprecision else ("لم يتم اكتشاف عدم دقة زمنية." if is_ar else ("No major time imprecision detected." if is_en else "Pas d'imprécision temporelle majeure détectée.")),
            "suggestions": sug_1 if has_imprecision else []
        })

        has_any_defect = any(c["has_defect"] for c in analysis)
        reformulation = recommendation
        if has_conditional:
            reformulation = recommendation.replace("devrait", "doit").replace("pourrait", "doit")

        fallback_note = "💡 ملاحظة: الذكاء الاصطناعي المحلي غير متصل. تم تفعيل الوضع المستقل. التحليل قائم على القواعد التنظيمية." if is_ar else (
            "💡 Note: Local AI is offline. Standalone RAG mode activated. Analysis based on regulatory rules." if is_en else
            "💡 Note : L'IA locale (Ollama) n'est pas disponible. Mode autonome hors-ligne (RAG) activé. Voici l'analyse basée sur la base de connaissances réglementaire."
        )

        return {
            "has_defects": has_any_defect,
            "analysis": sorted(analysis, key=lambda x: x["criterion"]),
            "reformulation_proposed": reformulation,
            "is_fallback": True,
            "fallback_note": fallback_note
        }

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
                repaired = self._repair_json_string(json_candidate)
                return json.loads(repaired)
            except Exception as e2:
                print(f"[!] Échec de la réparation du JSON : {e2}")
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

