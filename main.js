const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let pythonProcess = null;
const BACKEND_PORT = 8000;

function startPythonBackend() {
    const isWindows = process.platform === "win32";
    
    let backendExecutable;
    let backendArgs = [];

    if (app.isPackaged) {
        // Mode Production : utiliser l'exécutable généré par PyInstaller
        const exeName = isWindows ? 'app.exe' : 'app';
        backendExecutable = path.join(process.resourcesPath, 'backend', exeName);
        console.log(`[*] Mode Production: Démarrage du backend compilé via: ${backendExecutable}`);
        pythonProcess = spawn(backendExecutable, backendArgs, {
            cwd: path.join(process.resourcesPath, 'backend'),
            env: { ...process.env, PORT: BACKEND_PORT }
        });
    } else {
        // Mode Développement : utiliser le venv local
        backendExecutable = isWindows 
            ? path.join(__dirname, 'backend', 'venv', 'Scripts', 'python.exe')
            : path.join(__dirname, 'backend', 'venv', 'bin', 'python');
        const scriptPath = path.join(__dirname, 'backend', 'app.py');
        backendArgs = [scriptPath];
        console.log(`[*] Mode Développement: Démarrage du backend Python via: ${backendExecutable}`);
        pythonProcess = spawn(backendExecutable, backendArgs, {
            cwd: __dirname,
            env: { ...process.env, PORT: BACKEND_PORT }
        });
    }

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
    const frontendPath = app.isPackaged ? path.join(process.resourcesPath, 'frontend') : path.join(__dirname, 'frontend');

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 850,
        title: "Assistant Virtuel d'Aptitude Médicale",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        },
        icon: path.join(frontendPath, 'logo.png')
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
    mainWindow.loadFile(path.join(frontendPath, 'loading.html'));
    
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
