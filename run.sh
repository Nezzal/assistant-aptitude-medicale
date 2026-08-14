#!/bin/bash

# Chemin absolu du script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "=========================================================="
echo "      Assistant Virtuel d'Aptitude Médicale"
echo "=========================================================="
echo ""

# Vérifier si l'environnement virtuel existe
if [ ! -d "$SCRIPT_DIR/backend/venv" ]; then
    echo "[*] Création de l'environnement virtuel Python..."
    python3 -m venv "$SCRIPT_DIR/backend/venv"
fi

# Activer l'environnement virtuel et lancer le serveur
echo "[*] Démarrage du serveur backend FastAPI..."
echo "[*] L'application sera accessible sur : http://localhost:8000"
echo ""
echo "Appuyez sur Ctrl+C pour arrêter le serveur."
echo "----------------------------------------------------------"

"$SCRIPT_DIR/backend/venv/bin/python" "$SCRIPT_DIR/backend/app.py"
