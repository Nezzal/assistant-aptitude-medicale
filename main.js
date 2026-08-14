const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let pythonProcess = null;
const BACKEND_PORT = 8000;

function startPythonBackend() {
    // Déterminer le chemin du python de l'environnement virtuel
    const isWindows = process.platform === "win32";
    const pythonPath = isWindows 
        ? path.join(__dirname, 'backend', 'venv', 'Scripts', 'python.exe')
        : path.join(__dirname, 'backend', 'venv', 'bin', 'python');
    
    const scriptPath = path.join(__dirname, 'backend', 'app.py');

    console.log(`[*] Démarrage du backend Python via: ${pythonPath}`);
    
    pythonProcess = spawn(pythonPath, [scriptPath], {
        cwd: __dirname,
        env: { ...process.env, PORT: BACKEND_PORT }
    });

    pythonProcess.stdout.on('data', (data) => {
        console.log(`[Python stdout]: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`[Python stderr]: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`[Python process] Terminé avec le code ${code}`);
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 850,
        title: "Assistant Virtuel d'Aptitude Médicale",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        },
        icon: path.join(__dirname, 'frontend', 'logo.png')
    });

    // Masquer le menu par défaut pour faire une app pro
    mainWindow.setMenuBarVisibility(false);

    // Fonction pour vérifier si le serveur FastAPI est prêt
    const checkServerReady = () => {
        http.get(`http://127.0.0.1:${BACKEND_PORT}/api/models`, (res) => {
            if (res.statusCode === 200) {
                console.log("[*] Le serveur backend est prêt. Chargement de l'interface...");
                mainWindow.loadURL(`http://127.0.0.1:${BACKEND_PORT}`);
            } else {
                setTimeout(checkServerReady, 200);
            }
        }).on('error', () => {
            setTimeout(checkServerReady, 200);
        });
    };

    // Charger la page d'attente locale pendant que le backend démarre
    mainWindow.loadFile(path.join(__dirname, 'frontend', 'loading.html'));
    
    // Commencer à vérifier si le serveur est prêt
    checkServerReady();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', () => {
    startPythonBackend();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    // Tuer proprement le serveur Python en arrière-plan
    if (pythonProcess) {
        console.log("[*] Arrêt du processus Python...");
        pythonProcess.kill();
        pythonProcess = null;
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
