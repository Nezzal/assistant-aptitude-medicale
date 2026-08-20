// Variables globales d'état
let availableModels = [];

document.addEventListener("DOMContentLoaded", () => {
    // === VÉRIFICATION ET PORTAIL DE LICENCE ===
    const landingPage = document.getElementById("landing-page");
    const mainWorkspace = document.getElementById("main-workspace");
    const licenseInput = document.getElementById("license-input");
    const btnActivateLicense = document.getElementById("btn-activate-license");
    const licenseErrorMsg = document.getElementById("license-error-msg");

    const reqName = document.getElementById("req-name");
    const reqStructure = document.getElementById("req-structure");
    const btnSendEmailRequest = document.getElementById("btn-send-email-request");
    const btnCopyMachineId = document.getElementById("btn-copy-machine-id");
    const displayMachineId = document.getElementById("display-machine-id");

    // Modal du Guide dans le Workspace
    const btnShowGuide = document.getElementById("btn-show-guide");
    const btnCloseGuide = document.getElementById("btn-close-guide");
    const guideModal = document.getElementById("guide-modal");
    const btnLogout = document.getElementById("btn-logout");
    const btnLoginSession = document.getElementById("btn-login-session");
    const linkChangeLicense = document.getElementById("link-change-license");

    // Vérifier l'état de la licence et de la session au chargement
    function checkLicenseState() {
        const storedKey = localStorage.getItem("med_license_key");
        const isSessionActive = localStorage.getItem("med_session_active");
        const expectedKey = generateActivationKey(machineId);

        const loginPortalCard = document.getElementById("login-portal-card");
        const activationGrid = document.getElementById("activation-grid");

        if (storedKey === expectedKey) {
            // Machine activée de manière permanente !
            if (isSessionActive === "true") {
                // Session en cours : Aller directement au workspace
                landingPage.style.display = "none";
                mainWorkspace.style.display = "block";
                loadModels();
                loadIndexedDocuments();
                loadSavedFiches();
            } else {
                // Session fermée : Afficher l'écran de connexion simplifié
                landingPage.style.display = "block";
                mainWorkspace.style.display = "none";
                
                if (loginPortalCard && activationGrid) {
                    loginPortalCard.style.display = "block";
                    activationGrid.style.display = "none";
                }
            }
        } else {
            // Machine non activée (première utilisation ou clé erronée)
            landingPage.style.display = "block";
            mainWorkspace.style.display = "none";
            
            if (loginPortalCard && activationGrid) {
                loginPortalCard.style.display = "none";
                activationGrid.style.display = "grid";
            }
        }
    }

    // --- LOGIQUE D'IDENTIFICATION MACHINE & CLÉ CRYPTOGRAPHIQUE ---
    function generateMachineId() {
        let id = localStorage.getItem("med_machine_id");
        if (!id) {
            const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
            const genGroup = (len) => {
                let str = "";
                for (let i = 0; i < len; i++) {
                    str += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                return str;
            };
            id = `MED-${genGroup(4)}-${genGroup(4)}`;
            localStorage.setItem("med_machine_id", id);
        }
        return id;
    }

    function generateActivationKey(macId) {
        // Sel secret partagé avec le générateur de clés de l'administrateur
        const salt = "PedagogiAfrica2026SecretSalt";
        const input = macId + salt;
        let hash = 5381;
        for (let i = 0; i < input.length; i++) {
            hash = ((hash << 5) + hash) + input.charCodeAt(i);
        }
        const absHash = Math.abs(hash).toString(16).toUpperCase();
        let padded = absHash.padEnd(8, "A");
        const p1 = padded.substring(0, 4);
        const p2 = padded.substring(4, 8);
        return `ACT-${p1}-${p2}`;
    }

    const machineId = generateMachineId();
    if (displayMachineId) {
        displayMachineId.textContent = machineId;
    }

    if (btnCopyMachineId) {
        btnCopyMachineId.addEventListener("click", () => {
            navigator.clipboard.writeText(machineId);
            alert("Identifiant d'installation copié dans le presse-papiers !");
        });
    }

    // Toggle affichage champs facturation
    const reqInvoice = document.getElementById("req-invoice");
    const reqInvoiceFields = document.getElementById("invoice-fields");
    if (reqInvoice && reqInvoiceFields) {
        reqInvoice.addEventListener("change", () => {
            reqInvoiceFields.style.display = reqInvoice.checked ? "block" : "none";
        });
    }

    if (btnSendEmailRequest) {
        btnSendEmailRequest.addEventListener("click", () => {
            const docName = reqName.value.trim();
            const struct = reqStructure.value.trim();
            const invoiceChecked = reqInvoice ? reqInvoice.checked : false;
            const billingName = document.getElementById("req-billing-name") ? document.getElementById("req-billing-name").value.trim() : "";
            const clientNif = document.getElementById("req-nif") ? document.getElementById("req-nif").value.trim() : "";
            
            if (!docName || !struct) {
                alert("Veuillez renseigner votre nom et votre structure de médecine du travail avant d'envoyer la demande.");
                return;
            }

            const subject = encodeURIComponent("Demande d'activation - Assistant d'Aptitude Médicale");
            
            let bodyText = `Bonjour PedagogiAfrica,\n\n` +
                `Veuillez trouver ci-joint le reçu de mon virement BaridiMob de 5 000 DA pour l'activation permanente de mon Assistant d'Aptitude Médicale.\n\n` +
                `FORMULE SOUSCRITE :\n` +
                `[X] Application autonome de bureau (À vie - 5 000 DA - Licence définitive)\n\n` +
                `--------------------------------------------------\n` +
                `INFORMATIONS D'INSTALLATION OBLIGATOIRES :\n` +
                `Identifiant unique de ma machine : ${machineId}\n` +
                `Médecin demandeur : ${docName}\n` +
                `Structure médicale : ${struct}\n` +
                `--------------------------------------------------\n`;

            if (invoiceChecked) {
                bodyText += `\n--- DEMANDE DE FACTURE ACQUITTEE ---\n` +
                    `• Facture demandée : Oui\n` +
                    `• Raison sociale / Nom : ${billingName || docName}\n`;
                if (clientNif) {
                    bodyText += `• NIF Client : ${clientNif}\n`;
                }
                bodyText += `------------------------------------\n`;
            }

            bodyText += `\nMerci de bien vouloir me renvoyer ma clé d'activation.\n\n` +
                `Cordialement,\n` +
                `${docName}`;

            const body = encodeURIComponent(bodyText);

            window.location.href = `mailto:pedagogiafrica@gmail.com?subject=${subject}&body=${body}`;
        });
    }

    // Connexion à la session (si activée)
    if (btnLoginSession) {
        btnLoginSession.addEventListener("click", () => {
            localStorage.setItem("med_session_active", "true");
            landingPage.style.opacity = "0";
            setTimeout(() => {
                checkLicenseState();
                landingPage.style.opacity = "1";
            }, 300);
        });
    }

    // Réinitialiser / Changer la clé de licence
    if (linkChangeLicense) {
        linkChangeLicense.addEventListener("click", (e) => {
            e.preventDefault();
            if (confirm("Voulez-vous réinitialiser la clé de licence sur cet ordinateur ? (Une nouvelle activation sera nécessaire)")) {
                localStorage.removeItem("med_license_key");
                localStorage.removeItem("med_session_active");
                checkLicenseState();
            }
        });
    }

    // Gestion du clic d'activation
    btnActivateLicense.addEventListener("click", () => {
        const key = licenseInput.value.trim().toUpperCase();
        if (!key) {
            showLicenseError("Veuillez saisir une clé de licence.");
            return;
        }

        const expectedKey = generateActivationKey(machineId);

        if (key === expectedKey) {
            localStorage.setItem("med_license_key", key); // Stocker la clé de licence
            localStorage.setItem("med_session_active", "true"); // Ouvrir la session
            
            // Transition fluide
            landingPage.style.opacity = "0";
            setTimeout(() => {
                checkLicenseState();
                landingPage.style.opacity = "1";
            }, 300);
        } else {
            showLicenseError("Clé d'activation incorrecte pour cet ordinateur. Veuillez vérifier la clé reçue par e-mail.");
        }
    });

    function showLicenseError(msg) {
        licenseErrorMsg.textContent = msg;
        licenseErrorMsg.style.display = "block";
        licenseInput.classList.add("error-msg");
        setTimeout(() => licenseInput.classList.remove("error-msg"), 500);
    }

    // Déconnexion de la session
    btnLogout.addEventListener("click", () => {
        localStorage.removeItem("med_session_active");
        checkLicenseState();
    });

    // --- EASTER EGG / DOUBLE SÉCURITÉ POUR LE LIEN ADMINISTRATEUR ---
    const activationTitle = document.getElementById("activation-title");
    const adminLink = document.getElementById("admin-link");

    if (activationTitle && adminLink) {
        let clickCount = 0;
        let clickTimeout;
        activationTitle.addEventListener("click", () => {
            clickCount++;
            clearTimeout(clickTimeout);
            if (clickCount >= 5) {
                adminLink.style.display = "inline-flex";
                alert("Accès Administrateur : Le lien du générateur est maintenant disponible en bas de page.");
                clickCount = 0;
            } else {
                clickTimeout = setTimeout(() => {
                    clickCount = 0;
                }, 2000);
            }
        });
    }

    // Raccourci clavier de secours (Ctrl ou Cmd + Alt/Option + A)
    window.addEventListener("keydown", (e) => {
        const isModifier = e.ctrlKey || e.metaKey; // Ctrl ou Cmd (sur Mac)
        const isAlt = e.altKey;                    // Alt ou Option (sur Mac)
        const isA = e.code === "KeyA" || e.key === "a" || e.key === "A";

        if (isModifier && isAlt && isA) {
            if (adminLink) {
                e.preventDefault();
                adminLink.style.display = "inline-flex";
                alert("Accès Administrateur : Le lien du générateur est maintenant disponible en bas de page.");
            }
        }
    });

    // Gestion du Modal Guide d'utilisation
    btnShowGuide.addEventListener("click", () => {
        guideModal.style.display = "flex";
    });

    btnCloseGuide.addEventListener("click", () => {
        guideModal.style.display = "none";
    });

    // Fermer le modal en cliquant en dehors
    guideModal.addEventListener("click", (e) => {
        if (e.target === guideModal) {
            guideModal.style.display = "none";
        }
    });


    // === ÉLÉMENTS DU DOM DU WORKSPACE ===
    const modelSelect = document.getElementById("model-select");
    const ragToggle = document.getElementById("rag-toggle");
    const indexedDocsList = document.getElementById("indexed-docs-list");
    const btnSyncDocs = document.getElementById("btn-sync-docs");

    // Éléments des onglets Navigation
    const btnTabCopilot = document.getElementById("btn-tab-copilot");
    const btnTabForms = document.getElementById("btn-tab-forms");
    const viewCopilot = document.getElementById("view-copilot");
    const viewForms = document.getElementById("view-forms");

    // === ÉLÉMENTS DE LA VUE 1 : COPILOTE ===
    const recommendationInput = document.getElementById("recommendation-input");
    const btnAnalyze = document.getElementById("btn-analyze");
    const analyzeSpinner = document.getElementById("analyze-spinner");
    const btnText = document.getElementById("btn-text");
    
    const placeholderView = document.getElementById("placeholder-view");
    const resultView = document.getElementById("result-view");
    const scoreBadge = document.getElementById("score-badge");
    const scoreStatusText = document.getElementById("score-status-text");
    const scoreSubtext = document.getElementById("score-subtext");
    const reformulationTextContent = document.getElementById("reformulation-text-content");
    const btnCopyReformulation = document.getElementById("btn-copy-reformulation");
    const criteriaAnalysisList = document.getElementById("criteria-analysis-list");
    const ragSourcesSection = document.getElementById("rag-sources-section");
    const ragSourcesList = document.getElementById("rag-sources-list");

    // === ÉLÉMENTS DE LA VUE 2 : FORMULAIRES & IMPRESSION ===
    const formTypeSelect = document.getElementById("form-type-select");
    const formDoctor = document.getElementById("form-doctor");
    const formDoctorTitle = document.getElementById("form-doctor-title");
    const formStructure = document.getElementById("form-structure");
    const formEmployeur = document.getElementById("form-employeur");
    const formWorker = document.getElementById("form-worker");
    const formPost = document.getElementById("form-post");
    const formDate = document.getElementById("form-date");
    const formConclusion = document.getElementById("form-conclusion");
    const formRecommendation = document.getElementById("form-recommendation");
    const btnFormAnalyze = document.getElementById("btn-form-analyze");
    const formSpinner = document.getElementById("form-spinner");
    const btnFormPrint = document.getElementById("btn-form-print");
    const formCity = document.getElementById("form-city");

    const formFicheId = document.getElementById("form-fiche-id");
    const btnFormSave = document.getElementById("btn-form-save");
    const btnFormClear = document.getElementById("btn-form-clear");
    const savedFichesTbody = document.getElementById("saved-fiches-tbody");

    const btnTabDatabase = document.getElementById("btn-tab-database");
    const viewDatabase = document.getElementById("view-database");
    
    // Outils de filtrage et recherche
    const dbSearchInput = document.getElementById("db-search-input");
    const dbFilterType = document.getElementById("db-filter-type");
    const dbFilterConclusion = document.getElementById("db-filter-conclusion");
    
    // Actions globales de la base
    const btnExportCsv = document.getElementById("btn-export-csv");
    const btnExportJson = document.getElementById("btn-export-json");
    const btnTriggerImport = document.getElementById("btn-trigger-import");
    const dbImportFile = document.getElementById("db-import-file");
    
    // Panneau de statistiques
    const statsTotalFiches = document.getElementById("stats-total-fiches");
    const statsAptitudeRate = document.getElementById("stats-aptitude-rate");
    const statsAptitudeSub = document.getElementById("stats-aptitude-sub");
    const statsInaptitudeCount = document.getElementById("stats-inaptitude-count");

    const formPlaceholderView = document.getElementById("form-placeholder-view");
    const formResultView = document.getElementById("form-result-view");
    const formScoreBadge = document.getElementById("form-score-badge");
    const formScoreStatusText = document.getElementById("form-score-status-text");
    const formScoreSubtext = document.getElementById("form-score-subtext");
    const formReformulationContent = document.getElementById("form-reformulation-content");
    const btnFormUseReformulation = document.getElementById("btn-form-use-reformulation");
    const formCriteriaList = document.getElementById("form-criteria-list");

    // Éléments de la Zone d'Impression (print-area)
    const printDocTitle = document.getElementById("print-doc-title");
    const printValDoctor = document.getElementById("print-val-doctor");
    const printValStructure = document.getElementById("print-val-structure");
    const printValWorker = document.getElementById("print-val-worker");
    const printValCity = document.getElementById("print-val-city");
    const printValEmployeur = document.getElementById("print-val-employeur");
    const printValPost = document.getElementById("print-val-post");
    const printValType = document.getElementById("print-val-type");
    const printValRecommendations = document.getElementById("print-val-recommendations");
    const printValDate = document.getElementById("print-val-date");

    const checkApte = document.getElementById("check-apte");
    const checkApteReserves = document.getElementById("check-apte-reserves");
    const checkInapteTemp = document.getElementById("check-inapte-temp");
    const checkInapteDef = document.getElementById("check-inapte-def");

    // Initialiser la date du jour par défaut
    const today = new Date().toISOString().split('T')[0];
    formDate.value = today;

    // === GESTION DES ONGLETS ===
    btnTabCopilot.addEventListener("click", () => {
        btnTabCopilot.classList.add("active");
        btnTabForms.classList.remove("active");
        btnTabDatabase.classList.remove("active");
        viewCopilot.style.display = "grid";
        viewForms.style.display = "none";
        viewDatabase.style.display = "none";
    });

    btnTabForms.addEventListener("click", () => {
        btnTabForms.classList.add("active");
        btnTabCopilot.classList.remove("active");
        btnTabDatabase.classList.remove("active");
        viewForms.style.display = "grid";
        viewCopilot.style.display = "none";
        viewDatabase.style.display = "none";
        updatePrintPreview(); // Mettre à jour les données à l'ouverture
    });

    btnTabDatabase.addEventListener("click", () => {
        btnTabDatabase.classList.add("active");
        btnTabCopilot.classList.remove("active");
        btnTabForms.classList.remove("active");
        viewDatabase.style.display = "grid";
        viewCopilot.style.display = "none";
        loadSavedFiches(); // Recharger et calculer les stats
    });

    // Bouton de téléchargement rapide de Qwen 2.5 dans la bannière Ollama
    const btnQuickDownloadQwen = document.getElementById("btn-quick-download-qwen");
    if (btnQuickDownloadQwen) {
        btnQuickDownloadQwen.addEventListener("click", async () => {
            btnQuickDownloadQwen.disabled = true;
            btnQuickDownloadQwen.textContent = "⏳ Téléchargement de Qwen 2.5 en cours...";
            try {
                const response = await fetch("/api/pull", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ model_name: "qwen2.5:3b" })
                });
                if (response.ok) {
                    alert("Le téléchargement du modèle médical Qwen 2.5 (3B) a été initié. Le modèle sera disponible dans quelques instants.");
                    loadModels();
                } else {
                    alert("Impossible d'initier le téléchargement. Veuillez vous assurer qu'Ollama est démarré sur votre machine.");
                }
            } catch (e) {
                alert("Erreur de connexion à Ollama : " + e.message);
            } finally {
                btnQuickDownloadQwen.disabled = false;
                btnQuickDownloadQwen.textContent = "📥 Installer le modèle Qwen 2.5";
            }
        });
    }

    // === CHARGEMENT DES MODÈLES & DOCUMENTS (HYBRIDE CLIENT/SERVER) ===
    let autoPollingTimer = null;

    async function checkLocalOllamaFromBrowser() {
        try {
            const res = await fetch("http://127.0.0.1:11434/api/tags", {
                method: "GET",
                headers: { "Accept": "application/json" }
            });
            if (res.ok) {
                const data = await res.json();
                const models = data.models || [];
                return models
                    .filter(m => !m.name.toLowerCase().includes("embed"))
                    .map(m => ({
                        name: m.name,
                        provider: "ollama",
                        display_name: `Ollama Local - ${m.name}`,
                        installed: true
                    }));
            }
        } catch (e) {
            // Ollama local non accessible directement ou non démarré
        }
        return [];
    }

    async function loadModels() {
        try {
            // 1. Détection directe par le navigateur du client (Ollama local sur son ordinateur)
            const localModels = await checkLocalOllamaFromBrowser();
            
            // 2. Détection par le serveur backend
            let backendModels = [];
            try {
                const response = await fetch("/api/models");
                const data = await response.json();
                if (data.status === "success" && data.models) {
                    backendModels = data.models;
                }
            } catch (e) {}

            // Fusion des modèles détectés
            let allModels = [];
            if (localModels.length > 0) {
                allModels = [...localModels];
                backendModels.forEach(bm => {
                    if (bm.name !== "no_model" && !allModels.some(lm => lm.name === bm.name)) {
                        allModels.push(bm);
                    }
                });
            } else {
                allModels = backendModels;
            }

            // Si aucun modèle n'est détecté (ex: Démo Web en ligne sur Vercel sans Ollama), injecter le modèle de démo
            if (allModels.length === 0 || (allModels.length === 1 && allModels[0].name === "no_model")) {
                allModels = [
                    {
                        name: "qwen2.5-demo",
                        provider: "demo",
                        display_name: "🌐 Modèle Démo Web Anonyme",
                        installed: true
                    }
                ];
            }

            availableModels = allModels;
            modelSelect.innerHTML = "";

            hideOboardingModalIfReady();

            availableModels.forEach((model, index) => {
                if (model.name === "no_model" && localModels.length > 0) return;
                const option = document.createElement("option");
                option.value = model.name;
                option.textContent = model.display_name;
                option.dataset.provider = model.provider;
                option.dataset.installed = model.installed ? "true" : "false";
                if (index === 0) option.selected = true;
                modelSelect.appendChild(option);
            });

            checkReadyToAnalyze();
        } catch (error) {
            console.error("Erreur de chargement des modèles :", error);
            modelSelect.innerHTML = `<option value="qwen2.5-demo" data-provider="demo" data-installed="true" selected>🌐 Modèle Démo Web Anonyme</option>`;
            checkReadyToAnalyze();
            hideOboardingModalIfReady();
        }
    }

    function hideOboardingModalIfReady() {
        hideOllamaOnboardingModal();
    }

    // === GESTION DU WIZARD HYBRIDE OLLAMA & QWEN (2 ÉTAPES) ===
    const ollamaModal = document.getElementById("ollama-modal");
    const modalStepBadge = document.getElementById("modal-step-badge");
    const ollamaModalTitle = document.getElementById("ollama-modal-title");
    const ollamaModalDescription = document.getElementById("ollama-modal-description");
    const step1Actions = document.getElementById("step-1-actions");
    const step2Actions = document.getElementById("step-2-actions");
    const btnStartOllama = document.getElementById("btn-start-ollama");
    const btnSkipOllama = document.getElementById("btn-skip-ollama");
    const btnPullQwen = document.getElementById("btn-pull-qwen");
    const btnSkipModel = document.getElementById("btn-skip-model");
    const ollamaProgressContainer = document.getElementById("ollama-progress-container");
    const ollamaProgressStatus = document.getElementById("ollama-progress-status");
    const ollamaProgressBar = document.getElementById("ollama-progress-bar");

    function showOllamaStep1() {
        if (!ollamaModal) return;
        ollamaModal.style.display = "flex";
        if (modalStepBadge) modalStepBadge.textContent = "Étape 1 / 2 : Moteur Système";
        if (ollamaModalTitle) ollamaModalTitle.textContent = "Configuration du Moteur IA (Ollama)";
        if (ollamaModalDescription) ollamaModalDescription.innerHTML = "L'assistant médical fonctionne localement. Téléchargez d'abord le moteur Ollama (officiel & sécurisé).";
        if (step1Actions) step1Actions.style.display = "flex";
        if (step2Actions) step2Actions.style.display = "none";
        if (ollamaProgressContainer) ollamaProgressContainer.style.display = "none";
    }

    function showOllamaStep2() {
        if (!ollamaModal) return;
        ollamaModal.style.display = "flex";
        if (modalStepBadge) modalStepBadge.textContent = "Étape 2 / 2 : Modèle IA";
        if (ollamaModalTitle) ollamaModalTitle.textContent = "Téléchargement de l'IA (Qwen 2.5 3B)";
        if (ollamaModalDescription) ollamaModalDescription.innerHTML = "Le moteur Ollama est actif ! Téléchargez le modèle médical <b>Qwen 2.5 (3B - ~2.0 Go)</b> sans droit administrateur.";
        if (step1Actions) step1Actions.style.display = "none";
        if (step2Actions) step2Actions.style.display = "flex";
    }

    function hideOllamaOnboardingModal() {
        if (ollamaModal) ollamaModal.style.display = "none";
        stopAutoPolling();
    }

    function startAutoPolling() {
        if (autoPollingTimer) return;
        autoPollingTimer = setInterval(async () => {
            try {
                const local = await checkLocalOllamaFromBrowser();
                if (local.length > 0) {
                    stopAutoPolling();
                    await loadModels();
                    return;
                }
                const res = await fetch("/api/models");
                const d = await res.json();
                if (d.status === "success" && d.models.length > 0) {
                    const isOffline = d.models.some(m => m.name === "no_model");
                    if (!isOffline) {
                        stopAutoPolling();
                        await loadModels();
                    }
                }
            } catch (e) {}
        }, 3000);
    }

    function stopAutoPolling() {
        if (autoPollingTimer) {
            clearInterval(autoPollingTimer);
            autoPollingTimer = null;
        }
    }

    // Étape 1 : Démarrer Ollama si déjà installé
    if (btnStartOllama) {
        btnStartOllama.addEventListener("click", async () => {
            btnStartOllama.disabled = true;
            btnStartOllama.textContent = "⚡ Lancement d'Ollama en cours...";
            try {
                await fetch("/api/start-ollama", { method: "POST" });
                setTimeout(() => loadModels(), 2500);
            } catch (err) {
                console.error("Erreur de lancement :", err);
            } finally {
                setTimeout(() => {
                    btnStartOllama.disabled = false;
                    btnStartOllama.textContent = "🟢 2. J'ai installé / Lancer Ollama";
                }, 4000);
            }
        });
    }

    // Étape 1 : Passer en mode hors-ligne autonomne
    if (btnSkipOllama) {
        btnSkipOllama.addEventListener("click", () => {
            hideOllamaOnboardingModal();
        });
    }

    // Étape 2 : Passer le téléchargement du modèle
    if (btnSkipModel) {
        btnSkipModel.addEventListener("click", () => {
            hideOllamaOnboardingModal();
        });
    }

    // Étape 2 : Télécharger le modèle Qwen (sans droit admin) via API Stream NDJSON
    if (btnPullQwen) {
        btnPullQwen.addEventListener("click", async () => {
            btnPullQwen.disabled = true;
            if (btnSkipModel) btnSkipModel.style.display = "none";
            if (ollamaProgressContainer) ollamaProgressContainer.style.display = "block";
            if (ollamaProgressStatus) ollamaProgressStatus.textContent = "Connexion au serveur Ollama...";
            if (ollamaProgressBar) ollamaProgressBar.style.width = "0%";

            try {
                const response = await fetch("/api/pull", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ model_name: "qwen2.5:3b" })
                });

                if (!response.ok) throw new Error("Impossible d'initier le téléchargement du modèle Qwen.");

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop();

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const event = JSON.parse(line);
                            if (event.total && event.completed) {
                                const pct = Math.round((event.completed / event.total) * 100);
                                const completedMb = (event.completed / 1024 / 1024).toFixed(0);
                                const totalMb = (event.total / 1024 / 1024).toFixed(0);
                                if (ollamaProgressBar) ollamaProgressBar.style.width = `${pct}%`;
                                if (ollamaProgressStatus) ollamaProgressStatus.textContent = `Téléchargement Qwen : ${pct}% (${completedMb} Mo / ${totalMb} Mo)`;
                            } else if (event.status) {
                                if (ollamaProgressStatus) ollamaProgressStatus.textContent = `Statut : ${event.status}`;
                            }
                        } catch (e) {}
                    }
                }

                if (ollamaProgressStatus) ollamaProgressStatus.textContent = "Modèle Qwen installé avec succès !";
                setTimeout(async () => {
                    hideOllamaOnboardingModal();
                    await loadModels();
                }, 1500);

            } catch (error) {
                console.error("Erreur de téléchargement Qwen :", error);
                alert("Échec du téléchargement : " + error.message);
                btnPullQwen.disabled = false;
                if (btnSkipModel) btnSkipModel.style.display = "block";
            }
        });
    }

    async function loadIndexedDocuments() {
        try {
            const response = await fetch("/api/documents");
            const data = await response.json();
            
            if (data.status === "success" && data.documents.length > 0) {
                indexedDocsList.innerHTML = "";
                data.documents.forEach(docName => {
                    const docItem = document.createElement("div");
                    docItem.className = "doc-item";
                    docItem.innerHTML = `
                        <svg class="doc-item-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        <span>${docName}</span>
                    `;
                    indexedDocsList.appendChild(docItem);
                });
            } else {
                indexedDocsList.innerHTML = `<div class="doc-item" style="font-style: italic;">Aucun document de référence indexé.</div>`;
            }
        } catch (error) {
            console.error("Erreur de chargement des documents :", error);
            indexedDocsList.innerHTML = `<div class="doc-item" style="color: var(--danger);">Erreur de connexion.</div>`;
        }
    }

    function checkReadyToAnalyze() {
        const selectedOption = modelSelect.options[modelSelect.selectedIndex];
        const isNotInstalled = selectedOption && selectedOption.dataset.installed === "false";
        
        if (isNotInstalled) {
            btnAnalyze.disabled = false;
            btnText.textContent = getTranslation("btnDownloadModel");
        } else {
            const hasText = recommendationInput.value.trim().length > 5;
            const hasModel = modelSelect.value !== "" && modelSelect.value !== "no_model";
            btnAnalyze.disabled = !(hasText && hasModel);
            btnText.textContent = getTranslation("btnAnalyze");
        }
    }

    recommendationInput.addEventListener("input", checkReadyToAnalyze);
    modelSelect.addEventListener("change", checkReadyToAnalyze);

    // Sync des documents RAG
    btnSyncDocs.addEventListener("click", async () => {
        btnSyncDocs.disabled = true;
        const originalText = btnSyncDocs.innerHTML;
        btnSyncDocs.innerHTML = "Indexation...";
        
        try {
            const response = await fetch("/api/index", { method: "POST" });
            const data = await response.json();
            
            if (data.status === "success") {
                alert(data.message);
                await loadIndexedDocuments();
            } else {
                alert("Erreur lors de l'indexation : " + data.message);
            }
        } catch (error) {
            console.error("Erreur de synchronisation :", error);
            alert("Erreur de connexion.");
        } finally {
            btnSyncDocs.disabled = false;
            btnSyncDocs.innerHTML = originalText;
        }
    });

    // === LOGIQUE DE LA VUE 1 : ANALYSE DIRECTE (COPILOTE) ===
    const demoExampleBtns = document.querySelectorAll(".btn-demo-example");
    demoExampleBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const text = btn.dataset.text;
            if (text && recommendationInput) {
                recommendationInput.value = text;
                checkReadyToAnalyze();
                setTimeout(() => {
                    if (btnAnalyze && !btnAnalyze.disabled) {
                        btnAnalyze.click();
                    }
                }, 200);
            }
        });
    });

    // Initialiser l'affichage du compteur de démo web au chargement
    const demoCounterBadgeInit = document.getElementById("demo-counter-badge");
    if (demoCounterBadgeInit) {
        const storedKey = localStorage.getItem("med_license_key");
        const isActivated = (storedKey === generateActivationKey(machineId));
        if (isActivated) {
            demoCounterBadgeInit.style.display = "none";
        } else {
            const demoCount = parseInt(localStorage.getItem("med_demo_cert_count") || "0", 10);
            demoCounterBadgeInit.textContent = `🧪 Essais Démo Web : ${demoCount} / 3`;
        }
    }
    btnAnalyze.addEventListener("click", async () => {
        const text = recommendationInput.value.trim();
        const selectedOption = modelSelect.options[modelSelect.selectedIndex];
        const modelName = selectedOption.value;
        const provider = selectedOption.dataset.provider;
        const useRag = ragToggle.checked;

        // Si le modèle sélectionné n'est pas encore installé, proposer le téléchargement automatique
        if (selectedOption.dataset.installed === "false") {
            const confirmDownload = confirm(
                `Le modèle "${selectedOption.textContent.split(" (")[0]}" n'est pas encore téléchargé sur votre ordinateur.\n\n` +
                `Souhaitez-vous le télécharger et l'installer automatiquement ?\n` +
                `(C'est entièrement gratuit. Le téléchargement prendra quelques minutes selon votre connexion Internet).`
            );
            if (!confirmDownload) {
                return;
            }

            btnAnalyze.disabled = true;
            recommendationInput.disabled = true;
            analyzeSpinner.style.display = "inline-block";
            btnText.textContent = "Démarrage...";

            try {
                const response = await fetch("/api/pull", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ model_name: modelName })
                });

                if (!response.ok) {
                    throw new Error("Impossible de démarrer le téléchargement.");
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop();

                    for (const line of lines) {
                        if (line.trim() === "") continue;
                        try {
                            const statusObj = JSON.parse(line);
                            if (statusObj.total && statusObj.completed !== undefined && statusObj.total > 0) {
                                const pct = Math.round((statusObj.completed / statusObj.total) * 100);
                                btnText.textContent = `Téléchargement : ${pct}%`;
                            } else if (statusObj.status) {
                                // Traduire ou raccourcir le statut pour l'affichage du bouton
                                let statusMsg = statusObj.status;
                                if (statusMsg === "pulling manifest") statusMsg = "Vérification...";
                                if (statusMsg === "verifying sha256") statusMsg = "Finalisation...";
                                btnText.textContent = statusMsg;
                            }
                        } catch (e) {
                            // Ignorer les erreurs de parsing partielles
                        }
                    }
                }

                btnText.textContent = "Téléchargement terminé !";
                await loadModels();

                // Sélectionner le nouveau modèle dans la liste
                for (let i = 0; i < modelSelect.options.length; i++) {
                    if (modelSelect.options[i].value === modelName) {
                        modelSelect.selectedIndex = i;
                        break;
                    }
                }

                // Relancer l'analyse automatiquement après une courte pause
                setTimeout(() => {
                    btnAnalyze.click();
                }, 1000);
                return;

            } catch (error) {
                console.error("Erreur lors du téléchargement :", error);
                alert("Échec du téléchargement automatique : " + error.message);
                btnAnalyze.disabled = false;
                recommendationInput.disabled = false;
                analyzeSpinner.style.display = "none";
                btnText.textContent = getTranslation("btnAnalyze");
                return;
            }
        }

        // Vérification de la limite de 3 certificats pour le mode Démo Web
        const storedKey = localStorage.getItem("med_license_key");
        const isActivated = (storedKey === generateActivationKey(machineId));
        const demoCounterBadge = document.getElementById("demo-counter-badge");

        if (!isActivated) {
            let demoCount = parseInt(localStorage.getItem("med_demo_cert_count") || "0", 10);
            if (demoCount >= 3) {
                if (demoCounterBadge) demoCounterBadge.textContent = "🔒 Essais Démo Web : 3 / 3 (Limite atteinte)";
                alert("🔒 Limite du Mode Démonstration Web atteinte (3/3 analyses démo effectuées).\n\nConformément à la réglementation algérienne (interdiction d'hébergement externe des données de santé) et au RGPD international, l'utilisation complète et illimitée nécessite l'application de bureau.\n\nVeuillez télécharger l'Application Bureau et obtenir votre licence définitive à 5 000 DA (à vie).");
                return;
            }
            demoCount += 1;
            localStorage.setItem("med_demo_cert_count", demoCount.toString());
            if (demoCounterBadge) demoCounterBadge.textContent = `🧪 Essais Démo Web : ${demoCount} / 3`;
            console.log(`[Démo Web] Certificate analysis ${demoCount}/3 used.`);
        }

        btnAnalyze.disabled = true;
        recommendationInput.disabled = true;
        analyzeSpinner.style.display = "inline-block";
        btnText.textContent = getTranslation("btnAnalyzeRunning");

        const languageSelect = document.getElementById("language-select");
        const selectedLanguage = languageSelect ? languageSelect.value : "ar";

        try {
            let result = null;

            // Si le modèle sélectionné est Ollama local, tenter l'analyse directe depuis le navigateur du client
            if (provider === "ollama") {
                try {
                    result = await analyzeWithLocalOllama(modelName, text, [], selectedLanguage);
                } catch (localErr) {
                    console.warn("Analyse directe par le navigateur vers Ollama local a échoué. Bascule vers l'API backend...", localErr);
                }
            }

            // Si l'analyse directe n'a pas été réalisée (ex: modèle cloud ou échec local), interroger le backend
            if (!result) {
                const response = await fetch("/api/analyze", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        recommendation: text,
                        model_name: modelName,
                        provider: provider,
                        use_rag: useRag,
                        language: selectedLanguage
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || "Une erreur est survenue lors de l'analyse.");
                }

                result = await response.json();
            }

            renderResults(result, selectedLanguage);
            
        } catch (error) {
            console.error("Erreur d'analyse :", error);
            alert("Échec de l'analyse : " + error.message);
        } finally {
            btnAnalyze.disabled = false;
            recommendationInput.disabled = false;
            analyzeSpinner.style.display = "none";
            btnText.textContent = getTranslation("btnAnalyze");
        }
    });

    async function analyzeWithLocalOllama(modelName, text, contextChunks, language) {
        let systemPrompt = "";
        let userContent = "";

        if (language === "ar") {
            systemPrompt = `أنت طبيب عمل خبير ومستشار قانوني في الصحة والسلامة المهنية وطب العمل في الجزائر (وفق القانون 88-07 والمرسوم 93-120).
دورك هو التقييم النقدي وتصحيح التوصيات والاحتياطات المهنية (قيود واحتياطات منصب العمل) المدخلة من طرف طبيب العمل، للتأكد من وضوحها وتحديدها الزمني وسلامتها القانونية.

تنبيه جوهري ومحوري:
1. التوصية الطبية في طب العمل (Préconisation d'aptitude / Aménagement de poste) تتعلق حصراً بحماية صحة العامل وتكييف ظروف عمله وحمايته من الأخطار والملوثات المهنية في بيئة العمل (مثل: الغبار، غبار الحبوب poussières de céréales، الأتربة، الضوضاء، الحرارة، حمل الأثقال، الوضعيات الإجهادية، العمل الليلي).
2. التوصية في طب العمل ليست وصفة علاجات ولا علاقة لها مطلقاً بالأدوية أو العقاقير أو المضادات الحيوية! يمنع منعاً باتاً ذكر الأدوية أو العلاجات!
3. عند تقديم إعادة الصياغة المقترحة (reformulation_proposed)، يجب أن تكون صياغة مهنية دقيقة ومباشرة في طب العمل لحماية العامل. مثال لغبار الحبوب (poussières de céréales):
"المنع التام من التعرض للغبار الجوي للحبوب في منصب العمل لمدة 3 أشهر مع توفير وسائل الحماية التنفسية المناسبة."

قم بتحليل التوصية بناءً على العيوب الـ 5 التالية:
1. عدم الدقة وصعوبات التطبيق (غياب المدة الزمنية أو التحديد الدقيق)
2. الشك في القوة الإلزامية (استعمال صيغ التردد مثل "ينبغي" بدل "يمنع" أو "يلزم")
3. معلومات خارج نطاق التنظيم (ذكر مناقشات أو تفاصيل غير متعلقة باللياقة)
4. تغيير الوظيفة أو عدم القدرة المقنعة (فرض قيود تعجيزية بدلاً من تقرير عدم القدرة)
5. خرق السر الطبي أو الحياة الخاصة (ذكر التشخيص أو أسماء الأمراض)

أجب حتماً وبشكل صارم بصيغة JSON التالية وباللغة العربية فقط:
{
  "has_defects": true/false,
  "analysis": [
    {"criterion": 1, "name": "عدم الدقة وصعوبات التطبيق", "has_defect": true/false, "explanation": "شرح الدليل بصيغة مهنية دقيقة في طب العمل", "suggestions": ["مقترح تصحيح دقيق"]},
    {"criterion": 2, "name": "الشك في القوة الإلزامية", "has_defect": true/false, "explanation": "شرح الدليل", "suggestions": []},
    {"criterion": 3, "name": "معلومات خارج نطاق التنظيم", "has_defect": true/false, "explanation": "شرح الدليل", "suggestions": []},
    {"criterion": 4, "name": "تغيير الوظيفة أو عدم القدرة المقنعة", "has_defect": true/false, "explanation": "شرح الدليل", "suggestions": []},
    {"criterion": 5, "name": "خرق السر الطبي أو الحياة الخاصة", "has_defect": true/false, "explanation": "شرح الدليل", "suggestions": []}
  ],
  "reformulation_proposed": "صياغة التوصية المهنية النموذجية والمصححة تماماً باللغة العربية"
}`;
            userContent = `حلل نقديّاً هذه التوصية الطبية في طب العمل وحرّر صياغتها باللغة العربية:\n"${text}"`;
        } else if (language === "en") {
            systemPrompt = `You are an expert occupational health physician and legal advisor in occupational health and safety.
Your role is to critically evaluate and reformulate medical work-fitness recommendations issued by occupational doctors.

CRITICAL MANDATORY REQUIREMENT:
1. YOU MUST WRITE ALL EXPLANATIONS, SUGGESTIONS, AND REFORMULATIONS STRICTLY AND 100% IN ENGLISH. Do NOT write any sentence or word in French! Even if the input recommendation is written in French, your analysis, explanations, suggestions, and reformulation MUST be translated and written entirely in professional English!
2. An occupational fitness recommendation concerns workplace hazards and job adaptations (e.g. cereal dust exposure, noise levels, heavy lifting, night work).
3. It is NOT a therapeutic prescription and HAS NOTHING TO DO WITH DRUGS OR ANTIBIOTICS. Do not mention medication or treatment!
4. Example for cereal dust exposure (poussières de céréales):
   - Reformulation: "Strict contraindication to airborne cereal dust exposure at the workplace for a duration of 3 months, with provision of appropriate respiratory protective equipment."
   - Explanation: "The recommendation lacks a clear timeframe or duration."
   - Suggestion: "Specify a precise period (e.g. 3 months) and required protective measures."

JSON Format (Respond in valid JSON only using English):
{
  "has_defects": true/false,
  "analysis": [
    {"criterion": 1, "name": "Imprecisions and application issues", "has_defect": true/false, "explanation": "Detailed explanation written strictly in English", "suggestions": ["Actionable suggestion written strictly in English"]},
    {"criterion": 2, "name": "Doubt on binding force", "has_defect": true/false, "explanation": "Explanation written strictly in English", "suggestions": []},
    {"criterion": 3, "name": "Information outside regulatory framework", "has_defect": true/false, "explanation": "Explanation written strictly in English", "suggestions": []},
    {"criterion": 4, "name": "Job change or disguised unfitness", "has_defect": true/false, "explanation": "Explanation written strictly in English", "suggestions": []},
    {"criterion": 5, "name": "Breach of medical confidentiality", "has_defect": true/false, "explanation": "Explanation written strictly in English", "suggestions": []}
  ],
  "reformulation_proposed": "Exemplary, fully corrected occupational health recommendation written strictly in English."
}`;
            userContent = `Critically analyze and reformulate the following medical recommendation. Respond STRICTLY AND ENTIRELY IN ENGLISH for all explanations, suggestions, and reformulation:\n"${text}"`;
        } else {
            systemPrompt = `Tu es un médecin du travail expert et un conseiller juridique en santé au travail.
Ton rôle est d'analyser de manière critique la préconisation d'aménagement ou d'aptitude médicale saisie par un médecin du travail.

RÈGLE ESSENTIELLE :
1. Une préconisation en médecine du travail concerne la protection du salarié face aux risques professionnels (poussières, bruit, charges, travail de nuit, etc.).
2. Ce n'est PAS une prescription médicamenteuse (aucun médicament, traitement ou antibiotique ne doit être mentionné) !
3. Réponds STRICTEMENT au format JSON en français uniquement.

JSON Format:
{
  "has_defects": true/false,
  "analysis": [
    {"criterion": 1, "name": "Imprécisions et difficultés d'application", "has_defect": true/false, "explanation": "...", "suggestions": ["..."]},
    {"criterion": 2, "name": "Doute sur la force d'obligation", "has_defect": true/false, "explanation": "...", "suggestions": ["..."]},
    {"criterion": 3, "name": "Informations hors cadre réglementaire", "has_defect": true/false, "explanation": "...", "suggestions": ["..."]},
    {"criterion": 4, "name": "Changement de poste ou inaptitude déguisée", "has_defect": true/false, "explanation": "...", "suggestions": ["..."]},
    {"criterion": 5, "name": "Rupture du secret médical ou vie privée", "has_defect": true/false, "explanation": "...", "suggestions": ["..."]}
  ],
  "reformulation_proposed": "Préconisation médicale exemplaire reformulée et exempte de tout défaut."
}`;
            userContent = `Voici la préconisation médicale à analyser :\n"${text}"`;
        }

        const res = await fetch("http://127.0.0.1:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: modelName,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userContent }
                ],
                stream: false,
                format: "json",
                options: { temperature: 0.1, num_ctx: 8192 }
            })
        });

        if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
        const data = await res.json();
        const rawText = data.message?.content || "";
        
        let jsonCandidate = rawText.trim();
        const firstBrace = jsonCandidate.indexOf('{');
        const lastBrace = jsonCandidate.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonCandidate = jsonCandidate.substring(firstBrace, lastBrace + 1);
        }
        return JSON.parse(jsonCandidate);
    }

    function getTranslation(key) {
        const langSelect = document.getElementById("language-select");
        const lang = langSelect ? langSelect.value : "ar";
        const dict = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS["ar"];
        return dict[key] || "";
    }

    // === DICTIONNAIRE MULTILINGUE I18N DE L'INTERFACE ===
    const UI_TRANSLATIONS = {
        ar: {
            appHeaderTitle: "مساعد اللياقة الطبية للعمل",
            appHeaderSubtitle: "الجزائر - المساعدة على اتخاذ القرار والشهادات التنظيمية",
            tabCopilot: "مساعد المراجعة",
            tabForms: "نماذج الشهادات والطباعة",
            tabDatabase: "قاعدة البيانات",
            tabGuide: "دليل الاستخدام",
            tabLogout: "تسجيل الخروج",
            
            ollamaBannerTitle: "الذكاء الاصطناعي المحلي (Ollama) وسرية البيانات",
            ollamaBannerText: "وفقاً للتشريع الجزائري وRGPD، تُنفّذ جميع التحليلات 100% بدون اتصال بالإنترنت على جهازك.",
            ollamaStatusActive: "الاتصال نشط.",
            btnInstallQwen: "📥 تثبيت نموذج Qwen 2.5",
            btnSupportMail: "✉️ الدعم عبر البريد",
            
            demoExamplesLabel: "💡 أمثلة للتجربة بنقرة واحدة:",
            ex1Btn: "🌾 غبار الحبوب",
            ex1Text: "يعاني العامل من انزعاج مرتبط بغبار الحبوب في منصب التخزين، للمراجعة عند الحاجة.",
            ex2Btn: "🏗️ حمل الأثقال",
            ex2Text: "ينبغي على العامل تجنب حمل الأثقال التي تتجاوز 15 كغ في ورشة البناء.",
            ex3Btn: "🌙 العمل الليلي والسر الطبي",
            ex3Text: "عدم القدرة المؤقتة على العمل الليلي لأن العامل يعاني من مرض إرتفاع ضغط الدم الشديد تحت العلاج.",

            titleInput: "إدخال التوصية الطبية",
            labelInput: "حرر أو ألصق التوصية الطبية:",
            placeholderInput: "مثال: مريض يعاني من مانع طبي نهائي للتعرض لأدخنة اللحام...",
            labelModel: "نموذج الذكاء الاصطناعي:",
            labelLang: "لغة التحليل والترجمة:",
            labelRagToggle: "الاعتماد على النصوص التنظيمية والدلائل الرسمية",
            btnAnalyze: "بدء التحليل النقدي",
            btnAnalyzeRunning: "جاري التحليل...",
            btnDownloadModel: "تنزيل وتثبيت النموذج",
            labelDocsHeader: "النصوص المرجعية والدلائل الرسمية",
            btnSyncDocs: "تحديث / مزامنة",

            titleEval: "التقييم النقدي",
            placeholderEval: "أدخل توصية طبية على اليسار ثم اضغط على بدء التحليل لإنشاء التقييم.",
            defectsDetected: "تم اكتشاف عيوب صياغة",
            noDefects: "توصية مطابقة للضوابط التنظيمية",
            actionRequired: "إجراء مطلوب",
            statusValid: "مطابقة وصالحة",
            titleReformulation: "إعادة الصياغة المقترحة",
            btnCopy: "نسخ",
            titleDetailedAnalysis: "التحليل التفصيلي للعيوب",
            titleSources: "النصوص المرجعية المرتبطة",
            suggestionsBoxTitle: "مقترحات التصحيح",
            badgeDefect: "عيب صياغة",
            badgeOk: "مطابق",

            crit_1: "عدم الدقة وصعوبات التطبيق",
            crit_2: "الشك في القوة الإلزامية",
            crit_3: "معلومات خارج نطاق التنظيم",
            crit_4: "تغيير الوظيفة أو عدم القدرة المقنعة",
            crit_5: "خرق السر الطبي أو الحياة الخاصة",

            titleForms: "إدخال بيانات الشهادة التنظيمية",
            labelFormType: "نوع شهادة اللياقة الطبية:",
            optTypeEmbauche: "1. شهادة الفحص الطبي عند التوظيف",
            optTypePeriodique: "2. شهادة الفحص الطبي الدوري",
            optTypeReprise: "3. شهادة الفحص الطبي لاستئناف العمل",
            optTypeInaptitude: "4. إشعار عدم القدرة الطبية / التوصيات",
            labelFormDoctor: "اسم ولقب الطبيب:",
            placeholderDoctor: "مثال: عبد المالك نزال...",
            labelFormStructure: "مصلحة طب العمل / الهيئة:",
            placeholderStructure: "مثال: مصلحة طب العمل الرويبة...",
            labelFormEmployer: "الهيئة المستخدمة / المؤسسة:",
            placeholderEmployeur: "مثال: سوناطراك، سيفيتال...",
            labelFormWorker: "اسم ولقب العامل:",
            placeholderWorker: "مثال: مصطفى...",
            labelFormPost: "المهنة / منصب العمل:",
            placeholderPost: "مثال: لحام، سائق...",
            labelFormDate: "تاريخ الفحص الطبي:",
            labelFormCity: "حرر بـ (المكان):",
            placeholderCity: "مثال: عنابة، الجزائر...",
            labelFormConclusion: "النتيجة الطبية للياقة البدنية والمهنية:",
            optCApte: "قادر (بدون قيود)",
            optCReserves: "قادر مع تحفظات (تكييف منصب العمل مطلوب)",
            optCInapteTemp: "غير قادر مؤقتاً (عدم قدرة مؤقتة)",
            optCInapteDef: "غير قادر نهائياً (مانع دائم من المنصب)",
            labelFormRec: "التوصيات والاحتياطات المهنية في المنصب:",
            placeholderFormRec: "أكتب هنا القيود الطبية (مثال: تجنب حمل الأثقال، عدم التعرض للغبار...)",
            btnFormAnalyzeText: "مراجعة (الذكاء الاصطناعي)",
            btnFormSaveText: "حفظ الملف",
            btnFormClearText: "جديد",
            btnFormPrintText: "طباعة A4",
            titleFormsEval: "المساعدة على المصادقة (المساعد)",
            formPlaceholderText: "أدخل التوصيات على اليسار ثم اضغط على مراجعة (الذكاء الاصطناعي) للمصادقة القانونية قبل الطباعة.",
            formReformulationTitle: "إعادة الصياغة التلقائية المطبقة",
            btnFormUseRef: "اعتماد هذه الصياغة",
            formCriteriaTitle: "تحليل معايير جودة الصياغة"
        },
        fr: {
            appHeaderTitle: "Assistant d'Aptitude Médicale",
            appHeaderSubtitle: "Algérie - Aide à la décision & fiches réglementaires",
            tabCopilot: "Copilote de Relecture",
            tabForms: "Modèles de Fiches & Impression",
            tabDatabase: "Base de Données",
            tabGuide: "Guide d'Utilisation",
            tabLogout: "Déconnexion",
            
            titleInput: "Saisie de la Préconisation",
            labelInput: "Rédiger ou coller la préconisation médicale :",
            placeholderInput: "Exemple : Patient présentant une contre-indication définitive à l'exposition aux fumées de soudure...",
            labelModel: "Modèle d'analyse :",
            labelLang: "Langue d'analyse / Traduction :",
            labelRagToggle: "Se baser sur les textes réglementaires et guides de référence",
            btnAnalyze: "Lancer l'analyse critique",
            btnAnalyzeRunning: "Analyse...",
            btnDownloadModel: "Télécharger et installer le modèle",
            labelDocsHeader: "Textes de référence et guides officiels",
            btnSyncDocs: "Synchroniser",

            titleEval: "Évaluation critique",
            placeholderEval: "Saisissez une préconisation médicale à gauche et lancez l'analyse pour afficher l'évaluation.",
            defectsDetected: "Défauts rédactionnels détectés",
            noDefects: "Préconisation conforme",
            actionRequired: "Action requise",
            statusValid: "Valide",
            titleReformulation: "Reformulation recommandée",
            btnCopy: "Copier",
            titleDetailedAnalysis: "Analyse détaillée",
            titleSources: "Documents de référence associés",
            suggestionsBoxTitle: "Suggestions de correction",
            badgeDefect: "DÉFAUT",
            badgeOk: "OK",

            crit_1: "Imprécisions et difficultés d'application",
            crit_2: "Doute sur la force d'obligation",
            crit_3: "Informations hors cadre réglementaire",
            crit_4: "Changement de poste ou inaptitude déguisée",
            crit_5: "Rupture du secret médical ou vie privée",

            titleForms: "Saisie réglementaire de la Fiche",
            labelFormType: "Type de fiche d'aptitude :",
            optTypeEmbauche: "1. Fiche de visite médicale d'embauchage",
            optTypePeriodique: "2. Fiche de visite médicale périodique",
            optTypeReprise: "3. Fiche de visite médicale de reprise",
            optTypeInaptitude: "4. Avis d'inaptitude médicale / préconisations",
            labelFormDoctor: "Nom & Prénom du médecin :",
            placeholderDoctor: "Ex: Nezzal Abdelmalek...",
            labelFormStructure: "Structure de médecine du travail :",
            placeholderStructure: "Ex: SPST Rouiba...",
            labelFormEmployer: "Organisme Employeur :",
            placeholderEmployeur: "Ex: Sonatrach, Cévital...",
            labelFormWorker: "Nom & Prénom du travailleur :",
            placeholderWorker: "Ex: Mustapha...",
            labelFormPost: "Profession / Poste de travail :",
            placeholderPost: "Ex: Soudeur, Chauffeur...",
            labelFormDate: "Date de l'examen :",
            labelFormCity: "Fait à (Lieu) :",
            placeholderCity: "Ex: Annaba, Alger...",
            labelFormConclusion: "Conclusion médicale d'aptitude :",
            optCApte: "APTE (sans restriction)",
            optCReserves: "APTE AVEC RÉSERVES (Aménagements requis)",
            optCInapteTemp: "INAPTE TEMPORAIRE (Inaptitude momentanée)",
            optCInapteDef: "INAPTE DÉFINITIF (Contre-indication permanente)",
            labelFormRec: "Préconisations / Restrictions de poste :",
            placeholderFormRec: "Rédiger ici les restrictions médicales (ex: éviter de porter des charges...)",
            btnFormAnalyzeText: "Relecture (IA)",
            btnFormSaveText: "Sauvegarder",
            btnFormClearText: "Nouveau",
            btnFormPrintText: "Imprimer A4",
            titleFormsEval: "Aide à la validation (Copilote)",
            formPlaceholderText: "Remplissez la zone \"Préconisations\" à gauche et cliquez sur \"Relecture critique\" pour valider juridiquement le texte avant l'impression.",
            formReformulationTitle: "Reformulation automatique appliquée",
            btnFormUseRef: "Utiliser cette version",
            formCriteriaTitle: "Analyse des critères de qualité"
        },
        en: {
            appHeaderTitle: "Medical Fitness Assistant",
            appHeaderSubtitle: "Algeria - Decision Support & Regulatory Records",
            tabCopilot: "Review Copilot",
            tabForms: "Forms & Printing",
            tabDatabase: "Database",
            tabGuide: "User Guide",
            tabLogout: "Logout",
            
            titleInput: "Medical Recommendation Input",
            labelInput: "Write or paste medical recommendation:",
            placeholderInput: "Example: Patient presenting a permanent contraindication to welding fume exposure...",
            labelModel: "Analysis Model:",
            labelLang: "Analysis / Translation Language:",
            labelRagToggle: "Base analysis on official regulatory guides",
            btnAnalyze: "Run Critical Analysis",
            btnAnalyzeRunning: "Analyzing...",
            btnDownloadModel: "Download & Install Model",
            labelDocsHeader: "Official Reference Texts & Guides",
            btnSyncDocs: "Synchronize",

            titleEval: "Critical Evaluation",
            placeholderEval: "Enter a medical recommendation on the left and run analysis to view evaluation.",
            defectsDetected: "Editorial Defects Detected",
            noDefects: "Compliant Recommendation",
            actionRequired: "Action Required",
            statusValid: "Valid",
            titleReformulation: "Recommended Reformulation",
            btnCopy: "Copy",
            titleDetailedAnalysis: "Detailed Analysis",
            titleSources: "Associated Reference Documents",
            suggestionsBoxTitle: "Correction Suggestions",
            badgeDefect: "DEFECT",
            badgeOk: "OK",

            crit_1: "Imprecisions and application issues",
            crit_2: "Doubt on binding force",
            crit_3: "Information outside regulatory framework",
            crit_4: "Job change or disguised unfitness",
            crit_5: "Breach of medical confidentiality",

            titleForms: "Regulatory Form Entry",
            labelFormType: "Fitness Certificate Type:",
            optTypeEmbauche: "1. Pre-employment Medical Visit",
            optTypePeriodique: "2. Periodic Medical Visit",
            optTypeReprise: "3. Return-to-Work Medical Visit",
            optTypeInaptitude: "4. Unfitness Notice / Recommendations",
            labelFormDoctor: "Doctor Name & Surname:",
            placeholderDoctor: "Ex: Nezzal Abdelmalek...",
            labelFormStructure: "Occupational Health Service:",
            placeholderStructure: "Ex: Rouiba OH Service...",
            labelFormEmployer: "Employer Organization:",
            placeholderEmployeur: "Ex: Sonatrach, Cevital...",
            labelFormWorker: "Worker Name & Surname:",
            placeholderWorker: "Ex: Mustapha...",
            labelFormPost: "Occupation / Job Position:",
            placeholderPost: "Ex: Welder, Driver...",
            labelFormDate: "Examination Date:",
            labelFormCity: "Issued at (Location):",
            placeholderCity: "Ex: Annaba, Algiers...",
            labelFormConclusion: "Medical Fitness Conclusion:",
            optCApte: "FIT (unrestricted)",
            optCReserves: "FIT WITH RESERVATIONS (Job adaptations required)",
            optCInapteTemp: "TEMPORARILY UNFIT (Momentary unfitness)",
            optCInapteDef: "PERMANENTLY UNFIT (Permanent contraindication)",
            labelFormRec: "Recommendations / Job Restrictions:",
            placeholderFormRec: "Write medical restrictions here (e.g. avoid heavy lifting...)",
            btnFormAnalyzeText: "AI Review",
            btnFormSaveText: "Save Record",
            btnFormClearText: "New",
            btnFormPrintText: "Print A4",
            titleFormsEval: "Validation Support (Copilot)",
            formPlaceholderText: "Fill in Recommendations on the left and click AI Review for legal validation before printing.",
            formReformulationTitle: "Applied Automatic Reformulation",
            btnFormUseRef: "Use this version",
            formCriteriaTitle: "Quality Criteria Analysis"
        }
    };

    function applyUiTranslations(lang = "ar") {
        const dict = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS["ar"];

        const workspace = document.getElementById("main-workspace");
        if (workspace) {
            if (lang === "ar") {
                workspace.setAttribute("dir", "rtl");
            } else {
                workspace.removeAttribute("dir");
            }
        }

        // En-tête de marque
        const appHeaderTitle = document.getElementById("app-header-title");
        if (appHeaderTitle && dict.appHeaderTitle) appHeaderTitle.textContent = dict.appHeaderTitle;

        const appHeaderSubtitle = document.getElementById("app-header-subtitle");
        if (appHeaderSubtitle && dict.appHeaderSubtitle) appHeaderSubtitle.textContent = dict.appHeaderSubtitle;

        // Bannière Ollama
        const ollamaBannerTitle = document.querySelector("#ollama-info-banner strong");
        if (ollamaBannerTitle && dict.ollamaBannerTitle) ollamaBannerTitle.textContent = dict.ollamaBannerTitle;

        const ollamaBannerText = document.querySelector("#ollama-info-banner p");
        if (ollamaBannerText && dict.ollamaBannerText) {
            ollamaBannerText.innerHTML = `${dict.ollamaBannerText} <span id="ollama-status-details" style="color: var(--success); font-weight: 500;">${dict.ollamaStatusActive || ""}</span>`;
        }

        const btnQuickDownloadQwen = document.getElementById("btn-quick-download-qwen");
        if (btnQuickDownloadQwen && dict.btnInstallQwen) btnQuickDownloadQwen.textContent = dict.btnInstallQwen;

        const btnSupportMailLink = document.querySelector("#ollama-action-container a");
        if (btnSupportMailLink && dict.btnSupportMail) btnSupportMailLink.textContent = dict.btnSupportMail;

        // Barre d'exemples en 1-clic
        const demoExamplesLabel = document.querySelector(".btn-demo-example")?.previousElementSibling;
        if (demoExamplesLabel && dict.demoExamplesLabel) demoExamplesLabel.textContent = dict.demoExamplesLabel;

        const demoBtns = document.querySelectorAll(".btn-demo-example");
        if (demoBtns.length >= 3) {
            if (dict.ex1Btn) { demoBtns[0].textContent = dict.ex1Btn; demoBtns[0].dataset.text = dict.ex1Text; }
            if (dict.ex2Btn) { demoBtns[1].textContent = dict.ex2Btn; demoBtns[1].dataset.text = dict.ex2Text; }
            if (dict.ex3Btn) { demoBtns[2].textContent = dict.ex3Btn; demoBtns[2].dataset.text = dict.ex3Text; }
        }

        // Navigation
        const btnCopilot = document.getElementById("btn-tab-copilot");
        if (btnCopilot && dict.tabCopilot) btnCopilot.textContent = dict.tabCopilot;

        const btnForms = document.getElementById("btn-tab-forms");
        if (btnForms && dict.tabForms) btnForms.textContent = dict.tabForms;

        const btnDatabase = document.getElementById("btn-tab-database");
        if (btnDatabase && dict.tabDatabase) btnDatabase.textContent = dict.tabDatabase;

        const btnGuide = document.getElementById("btn-show-guide");
        if (btnGuide && dict.tabGuide) btnGuide.textContent = dict.tabGuide;

        const btnLogout = document.getElementById("btn-logout");
        if (btnLogout && dict.tabLogout) btnLogout.textContent = dict.tabLogout;

        // Colonne Gauche
        const cardTitleInput = document.querySelector("#card-title-input span");
        if (cardTitleInput && dict.titleInput) cardTitleInput.textContent = dict.titleInput;

        const labelRecInput = document.getElementById("label-rec-input");
        if (labelRecInput && dict.labelInput) labelRecInput.textContent = dict.labelInput;

        const recInput = document.getElementById("recommendation-input");
        if (recInput && dict.placeholderInput) recInput.placeholder = dict.placeholderInput;

        const labelModelSelect = document.getElementById("label-model-select");
        if (labelModelSelect && dict.labelModel) labelModelSelect.textContent = dict.labelModel;

        const labelLangSelect = document.getElementById("label-lang-select");
        if (labelLangSelect && dict.labelLang) labelLangSelect.textContent = dict.labelLang;

        const labelRagToggle = document.getElementById("label-rag-toggle");
        if (labelRagToggle && dict.labelRagToggle) labelRagToggle.textContent = dict.labelRagToggle;

        const btnText = document.getElementById("btn-text");
        if (btnText && dict.btnAnalyze && btnText.textContent !== dict.btnAnalyzeRunning) {
            btnText.textContent = dict.btnAnalyze;
        }

        const labelDocsHeader = document.getElementById("label-docs-header");
        if (labelDocsHeader && dict.labelDocsHeader) labelDocsHeader.textContent = dict.labelDocsHeader;

        const syncDocsBtnText = document.getElementById("sync-docs-btn-text");
        if (syncDocsBtnText && dict.btnSyncDocs) syncDocsBtnText.textContent = dict.btnSyncDocs;

        // Colonne Droite
        const cardTitleEval = document.querySelector("#card-title-eval span");
        if (cardTitleEval && dict.titleEval) cardTitleEval.textContent = dict.titleEval;

        const placeholderText = document.getElementById("placeholder-text");
        if (placeholderText && dict.placeholderEval) placeholderText.textContent = dict.placeholderEval;

        const reformulationTitleText = document.getElementById("reformulation-title-text");
        if (reformulationTitleText && dict.titleReformulation) reformulationTitleText.textContent = dict.titleReformulation;

        const btnCopyRef = document.getElementById("btn-copy-reformulation");
        if (btnCopyRef && dict.btnCopy) btnCopyRef.textContent = dict.btnCopy;

        const detailedAnalysisTitle = document.getElementById("detailed-analysis-title");
        if (detailedAnalysisTitle && dict.titleDetailedAnalysis) detailedAnalysisTitle.textContent = dict.titleDetailedAnalysis;

        const sourcesTitleText = document.getElementById("sources-title-text");
        if (sourcesTitleText && dict.titleSources) sourcesTitleText.textContent = dict.titleSources;

        // Vue 2 : Formulaires & Impression
        const cardTitleForms = document.querySelector("#card-title-forms span");
        if (cardTitleForms && dict.titleForms) cardTitleForms.textContent = dict.titleForms;

        const labelFormType = document.getElementById("label-form-type");
        if (labelFormType && dict.labelFormType) labelFormType.textContent = dict.labelFormType;

        const optTypeEmbauche = document.getElementById("opt-type-embauche");
        if (optTypeEmbauche && dict.optTypeEmbauche) optTypeEmbauche.textContent = dict.optTypeEmbauche;

        const optTypePeriodique = document.getElementById("opt-type-periodique");
        if (optTypePeriodique && dict.optTypePeriodique) optTypePeriodique.textContent = dict.optTypePeriodique;

        const optTypeReprise = document.getElementById("opt-type-reprise");
        if (optTypeReprise && dict.optTypeReprise) optTypeReprise.textContent = dict.optTypeReprise;

        const optTypeInaptitude = document.getElementById("opt-type-inaptitude");
        if (optTypeInaptitude && dict.optTypeInaptitude) optTypeInaptitude.textContent = dict.optTypeInaptitude;

        const labelFormDoctor = document.getElementById("label-form-doctor");
        if (labelFormDoctor && dict.labelFormDoctor) labelFormDoctor.textContent = dict.labelFormDoctor;

        const formDoctor = document.getElementById("form-doctor");
        if (formDoctor && dict.placeholderDoctor) formDoctor.placeholder = dict.placeholderDoctor;

        const labelFormStructure = document.getElementById("label-form-structure");
        if (labelFormStructure && dict.labelFormStructure) labelFormStructure.textContent = dict.labelFormStructure;

        const formStructure = document.getElementById("form-structure");
        if (formStructure && dict.placeholderStructure) formStructure.placeholder = dict.placeholderStructure;

        const labelFormEmployeur = document.getElementById("label-form-employeur");
        if (labelFormEmployeur && (dict.labelFormEmployer || dict.labelFormEmployeur)) {
            labelFormEmployeur.textContent = dict.labelFormEmployer || dict.labelFormEmployeur;
        }

        const formEmployeur = document.getElementById("form-employeur");
        if (formEmployeur && dict.placeholderEmployeur) formEmployeur.placeholder = dict.placeholderEmployeur;

        const labelFormWorker = document.getElementById("label-form-worker");
        if (labelFormWorker && dict.labelFormWorker) labelFormWorker.textContent = dict.labelFormWorker;

        const formWorker = document.getElementById("form-worker");
        if (formWorker && dict.placeholderWorker) formWorker.placeholder = dict.placeholderWorker;

        const labelFormPost = document.getElementById("label-form-post");
        if (labelFormPost && dict.labelFormPost) labelFormPost.textContent = dict.labelFormPost;

        const formPost = document.getElementById("form-post");
        if (formPost && dict.placeholderPost) formPost.placeholder = dict.placeholderPost;

        const labelFormDate = document.getElementById("label-form-date");
        if (labelFormDate && dict.labelFormDate) labelFormDate.textContent = dict.labelFormDate;

        const labelFormCity = document.getElementById("label-form-city");
        if (labelFormCity && dict.labelFormCity) labelFormCity.textContent = dict.labelFormCity;

        const formCity = document.getElementById("form-city");
        if (formCity && dict.placeholderCity) formCity.placeholder = dict.placeholderCity;

        const labelFormConclusion = document.getElementById("label-form-conclusion");
        if (labelFormConclusion && dict.labelFormConclusion) labelFormConclusion.textContent = dict.labelFormConclusion;

        const optCApte = document.getElementById("opt-c-apte");
        if (optCApte && dict.optCApte) optCApte.textContent = dict.optCApte;

        const optCReserves = document.getElementById("opt-c-reserves");
        if (optCReserves && dict.optCReserves) optCReserves.textContent = dict.optCReserves;

        const optCInapteTemp = document.getElementById("opt-c-inapte-temp");
        if (optCInapteTemp) optCInapteTemp.textContent = dict.optCInapteTemp;

        const optCInapteDef = document.getElementById("opt-c-inapte-def");
        if (optCInapteDef) optCInapteDef.textContent = dict.optCInapteDef;

        const labelFormRecommendation = document.getElementById("label-form-recommendation");
        if (labelFormRecommendation) labelFormRecommendation.textContent = dict.labelFormRec;

        const formRecommendation = document.getElementById("form-recommendation");
        if (formRecommendation && dict.placeholderFormRec) formRecommendation.placeholder = dict.placeholderFormRec;

        const btnFormAnalyzeText = document.getElementById("btn-form-analyze-text");
        if (btnFormAnalyzeText) btnFormAnalyzeText.textContent = dict.btnFormAnalyzeText;

        const btnFormSaveText = document.getElementById("btn-form-save-text");
        if (btnFormSaveText) btnFormSaveText.textContent = dict.btnFormSaveText;

        const btnFormClearText = document.getElementById("btn-form-clear-text");
        if (btnFormClearText) btnFormClearText.textContent = dict.btnFormClearText;

        const btnFormPrintText = document.getElementById("btn-form-print-text");
        if (btnFormPrintText) btnFormPrintText.textContent = dict.btnFormPrintText;

        const cardTitleFormsEval = document.querySelector("#card-title-forms-eval span");
        if (cardTitleFormsEval) cardTitleFormsEval.textContent = dict.titleFormsEval;

        const formPlaceholderText = document.getElementById("form-placeholder-text");
        if (formPlaceholderText) formPlaceholderText.textContent = dict.formPlaceholderText;

        const formReformulationTitle = document.getElementById("form-reformulation-title");
        if (formReformulationTitle) formReformulationTitle.textContent = dict.formReformulationTitle;

        const btnFormUseReformulation = document.getElementById("btn-form-use-reformulation");
        if (btnFormUseReformulation) btnFormUseReformulation.textContent = dict.btnFormUseRef;

        const formCriteriaTitle = document.getElementById("form-criteria-title");
        if (formCriteriaTitle) formCriteriaTitle.textContent = dict.formCriteriaTitle;

        // Re-vérifier l'état du bouton d'analyse
        checkReadyToAnalyze();
    }

    // Écouteur de changement de langue dynamique
    const languageSelectElement = document.getElementById("language-select");
    if (languageSelectElement) {
        languageSelectElement.addEventListener("change", () => {
            applyUiTranslations(languageSelectElement.value);
        });
        // Initialiser avec la langue sélectionnée
        applyUiTranslations(languageSelectElement.value);
    }

    function renderResults(result, lang = "ar") {
        const dict = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS["ar"];
        placeholderView.style.display = "none";
        resultView.style.display = "block";

        if (lang === "ar") {
            resultView.setAttribute("dir", "rtl");
            resultView.style.textAlign = "right";
        } else {
            resultView.removeAttribute("dir");
            resultView.style.textAlign = "left";
        }

        // Afficher la bannière d'avertissement RAG hors-ligne si fallback actif
        const existingBanner = document.getElementById("fallback-warning-banner");
        if (existingBanner) existingBanner.remove();

        if (result.is_fallback && result.fallback_note) {
            const banner = document.createElement("div");
            banner.id = "fallback-warning-banner";
            banner.style.cssText = "background: rgba(255, 171, 0, 0.15); border: 1px solid rgba(255, 171, 0, 0.4); color: #ffab00; padding: 12px 16px; border-radius: 8px; font-weight: 600; font-size: 0.9rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 10px;";
            banner.innerHTML = `<span>${result.fallback_note}</span>`;
            resultView.insertBefore(banner, resultView.firstChild);
        }

        scoreBadge.className = "score-badge-container";
        if (result.has_defects) {
            scoreBadge.classList.add("has-defects");
            scoreStatusText.textContent = dict.defectsDetected;
            scoreSubtext.className = "status-indicator defect";
            scoreSubtext.textContent = dict.actionRequired;
        } else {
            scoreBadge.classList.add("no-defects");
            scoreStatusText.textContent = dict.noDefects;
            scoreSubtext.className = "status-indicator ok";
            scoreSubtext.textContent = dict.statusValid;
        }

        reformulationTextContent.textContent = result.reformulation_proposed || "Aucune reformulation nécessaire.";

        criteriaAnalysisList.innerHTML = "";
        result.analysis.forEach(item => {
            const card = document.createElement("div");
            card.className = "criterion-card";
            if (item.has_defect) card.classList.add("has-defect-border");

            const suggestionsHtml = (item.suggestions && item.suggestions.length > 0) 
                ? `<div class="suggestions-box">
                    <h5>${dict.suggestionsBoxTitle}</h5>
                    <ul class="suggestions-list">
                        ${item.suggestions.map(sug => `<li>${sug}</li>`).join("")}
                    </ul>
                   </div>`
                : "";

            const critKey = `crit_${item.criterion}`;
            const translatedCritName = dict[critKey] || item.name;

            card.innerHTML = `
                <div class="criterion-header">
                    <div class="criterion-title-group">
                        <span class="criterion-number">${item.criterion}</span>
                        <span class="criterion-name">${translatedCritName}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <span class="status-indicator ${item.has_defect ? 'defect' : 'ok'}">
                            ${item.has_defect ? dict.badgeDefect : dict.badgeOk}
                        </span>
                        <i class="arrow"></i>
                    </div>
                </div>
                <div class="criterion-body">
                    <div class="criterion-explanation">${item.explanation || ""}</div>
                    ${suggestionsHtml}
                </div>
            `;

            const header = card.querySelector(".criterion-header");
            const body = card.querySelector(".criterion-body");
            header.addEventListener("click", () => {
                const isOpen = card.classList.contains("open");
                if (isOpen) {
                    card.classList.remove("open");
                    body.style.display = "none";
                } else {
                    card.classList.add("open");
                    body.style.display = "block";
                }
            });

            if (item.has_defect) {
                card.classList.add("open");
                body.style.display = "block";
            }

            criteriaAnalysisList.appendChild(card);
        });

        if (result.rag_sources && result.rag_sources.length > 0) {
            ragSourcesSection.style.display = "block";
            ragSourcesList.innerHTML = "";
            result.rag_sources.forEach(source => {
                const sourceItem = document.createElement("div");
                sourceItem.className = "source-chunk";
                sourceItem.innerHTML = `
                    <div class="source-chunk-meta">
                        <span>Fichier : ${source.filename}</span>
                        <span>Similarité : ${(source.similarity * 100).toFixed(1)}%</span>
                    </div>
                    <div class="source-chunk-text">"${source.text.substring(0, 300)}..."</div>
                `;
                ragSourcesList.appendChild(sourceItem);
            });
        } else {
            ragSourcesSection.style.display = "none";
        }
    }

    btnCopyReformulation.addEventListener("click", () => {
        const text = reformulationTextContent.textContent.trim();
        if (text) {
            navigator.clipboard.writeText(text).then(() => {
                const originalText = btnCopyReformulation.textContent;
                btnCopyReformulation.textContent = "Copié !";
                setTimeout(() => btnCopyReformulation.textContent = originalText, 2000);
            });
        }
    });

    // === LOGIQUE DE LA VUE 2 : FORMULAIRES & IMPRESSION ===

    // Mettre à jour la prévisualisation imprimable (print-area)
    function updatePrintPreview() {
        // 1. Mettre à jour les textes simples
        const docName = formDoctor.value.trim();
        const docTitle = formDoctorTitle.value;
        printValDoctor.textContent = docName ? `${docTitle} ${docName}` : `${docTitle} ...................................`;
        printValStructure.textContent = formStructure.value.trim() || "......................................................................";
        printValCity.textContent = formCity.value.trim() || "...................................";
        printValWorker.textContent = formWorker.value.trim() || "......................................................................";
        printValEmployeur.textContent = formEmployeur.value.trim() || "......................................................................";
        printValPost.textContent = formPost.value.trim() || "......................................................................";
        printValRecommendations.textContent = formRecommendation.value.trim() || "(Aucune préconisation formulée)";
        
        // Formater la date en français
        const rawDate = formDate.value;
        if (rawDate) {
            const parts = rawDate.split('-');
            printValDate.textContent = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else {
            printValDate.textContent = "........................";
        }

        // 2. Adapter le titre du document selon le type sélectionné
        const formType = formTypeSelect.value;
        if (formType === "embauche") {
            printDocTitle.textContent = "FICHE DE VISITE MÉDICALE D'EMBAUCHAGE";
            printValType.textContent = "Examen médical d'embauchage (Loi 88-07)";
        } else if (formType === "periodique") {
            printDocTitle.textContent = "FICHE DE VISITE MÉDICALE PÉRIODIQUE";
            printValType.textContent = "Examen médical périodique de suivi";
        } else if (formType === "reprise") {
            printDocTitle.textContent = "FICHE DE VISITE MÉDICALE DE REPRISE";
            printValType.textContent = "Examen de reprise après arrêt de travail";
        } else if (formType === "inaptitude") {
            printDocTitle.textContent = "AVIS D'INAPTITUDE MÉDICALE DU TRAVAIL";
            printValType.textContent = "Examen d'aptitude spéciale d'inaptitude";
        }

        // 3. Adapter les conclusions (cochage visuel des cases de la fiche)
        const conclusion = formConclusion.value;
        checkApte.textContent = "[ ] APTE";
        checkApteReserves.textContent = "[ ] APTE AVEC RÉSERVES (Aménagements requis)";
        checkInapteTemp.textContent = "[ ] INAPTE TEMPORAIRE (Inaptitude momentanée)";
        checkInapteDef.textContent = "[ ] INAPTE DÉFINITIF (Contre-indication permanente)";

        if (conclusion === "APTE") {
            checkApte.textContent = "[X] APTE";
        } else if (conclusion === "APTE_RESERVES") {
            checkApteReserves.textContent = "[X] APTE AVEC RÉSERVES (Aménagements requis)";
        } else if (conclusion === "INAPTE_TEMPORAIRE") {
            checkInapteTemp.textContent = "[X] INAPTE TEMPORAIRE (Inaptitude momentanée)";
        } else if (conclusion === "INAPTE_DEFINITIF") {
            checkInapteDef.textContent = "[X] INAPTE DÉFINITIF (Contre-indication permanente)";
        }
    }

    // Ajouter des écouteurs de modification pour mettre à jour l'impression en direct
    [formTypeSelect, formDoctorTitle, formDoctor, formStructure, formEmployeur, formWorker, formPost, formDate, formCity, formConclusion, formRecommendation].forEach(input => {
        input.addEventListener("input", updatePrintPreview);
        input.addEventListener("change", updatePrintPreview);
    });

    // Relecture critique de la préconisation du formulaire
    btnFormAnalyze.addEventListener("click", async () => {
        const text = formRecommendation.value.trim();
        if (!text) {
            alert("Veuillez saisir un texte dans les préconisations pour pouvoir l'analyser.");
            return;
        }

        const selectedOption = modelSelect.options[modelSelect.selectedIndex];
        const modelName = selectedOption.value;
        const provider = selectedOption.dataset.provider;
        const useRag = ragToggle.checked;

        btnFormAnalyze.disabled = true;
        formSpinner.style.display = "inline-block";

        try {
            const response = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recommendation: text,
                    model_name: modelName,
                    provider: provider,
                    use_rag: useRag
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Une erreur est survenue.");
            }

            const result = await response.json();
            renderFormResults(result);

        } catch (error) {
            console.error("Erreur de relecture du formulaire :", error);
            alert("Échec de la relecture critique : " + error.message);
        } finally {
            btnFormAnalyze.disabled = false;
            formSpinner.style.display = "none";
        }
    });

    function renderFormResults(result) {
        formPlaceholderView.style.display = "none";
        formResultView.style.display = "block";

        formScoreBadge.className = "score-badge-container";
        if (result.has_defects) {
            formScoreBadge.classList.add("has-defects");
            formScoreStatusText.textContent = "Défauts rédactionnels identifiés";
            formScoreSubtext.className = "status-indicator defect";
            formScoreSubtext.textContent = "Action requise";
        } else {
            formScoreBadge.classList.add("no-defects");
            formScoreStatusText.textContent = "Texte conforme";
            formScoreSubtext.className = "status-indicator ok";
            formScoreSubtext.textContent = "Valide";
        }

        formReformulationContent.textContent = result.reformulation_proposed || "Aucune reformulation nécessaire.";

        formCriteriaList.innerHTML = "";
        result.analysis.forEach(item => {
            const card = document.createElement("div");
            card.className = "criterion-card";
            if (item.has_defect) card.classList.add("has-defect-border");

            const suggestionsHtml = (item.suggestions && item.suggestions.length > 0) 
                ? `<div class="suggestions-box">
                    <h5>Suggestions</h5>
                    <ul class="suggestions-list">
                        ${item.suggestions.map(sug => `<li>${sug}</li>`).join("")}
                    </ul>
                   </div>`
                : "";

            card.innerHTML = `
                <div class="criterion-header">
                    <div class="criterion-title-group">
                        <span class="criterion-number">${item.criterion}</span>
                        <span class="criterion-name">${item.name}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <span class="status-indicator ${item.has_defect ? 'defect' : 'ok'}">
                            ${item.has_defect ? 'DÉFAUT' : 'OK'}
                        </span>
                        <i class="arrow"></i>
                    </div>
                </div>
                <div class="criterion-body">
                    <div class="criterion-explanation">${item.explanation || "Aucun commentaire."}</div>
                    ${suggestionsHtml}
                </div>
            `;

            const header = card.querySelector(".criterion-header");
            const body = card.querySelector(".criterion-body");
            header.addEventListener("click", () => {
                const isOpen = card.classList.contains("open");
                if (isOpen) {
                    card.classList.remove("open");
                    body.style.display = "none";
                } else {
                    card.classList.add("open");
                    body.style.display = "block";
                }
            });

            if (item.has_defect) {
                card.classList.add("open");
                body.style.display = "block";
            }

            formCriteriaList.appendChild(card);
        });
    }

    // --- GESTION DE LA SAUVEGARDE & HISTORIQUE DES FICHES ---
    let allSavedFiches = []; // Stockage en mémoire pour filtrage rapide client

    async function loadSavedFiches() {
        try {
            const response = await fetch("/api/fiches");
            const data = await response.json();
            
            if (data.status === "success") {
                allSavedFiches = data.fiches || [];
                updateDatabaseStats(allSavedFiches);
                applyDatabaseFilters(); // Filtrer et faire le rendu de la table
            } else {
                savedFichesTbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="padding: 2rem; text-align: center; color: var(--danger); font-style: italic;">
                            Erreur de chargement : ${data.message}
                        </td>
                    </tr>
                `;
            }
        } catch (error) {
            console.error("Erreur de chargement des fiches :", error);
            savedFichesTbody.innerHTML = `
                <tr>
                    <td colspan="6" style="padding: 2rem; text-align: center; color: var(--danger); font-style: italic;">
                        Erreur de connexion avec le serveur.
                    </td>
                </tr>
            `;
        }
    }

    function updateDatabaseStats(fiches) {
        const total = fiches.length;
        statsTotalFiches.textContent = total;
        
        if (total === 0) {
            statsAptitudeRate.textContent = "0%";
            statsAptitudeSub.textContent = "0 fiche de type APTE";
            statsInaptitudeCount.textContent = "0";
            return;
        }
        
        // Ratios d'aptitude
        const apteCount = fiches.filter(f => f.conclusion === "APTE").length;
        const aptitudeRate = Math.round((apteCount / total) * 100);
        statsAptitudeRate.textContent = `${aptitudeRate}%`;
        statsAptitudeSub.textContent = `${apteCount} fiches de type APTE`;
        
        // Inaptitudes
        const inapteCount = fiches.filter(f => f.conclusion === "INAPTE_TEMPORAIRE" || f.conclusion === "INAPTE_DEFINITIF").length;
        statsInaptitudeCount.textContent = inapteCount;
    }

    function applyDatabaseFilters() {
        const searchQuery = dbSearchInput.value.toLowerCase().trim();
        const typeFilter = dbFilterType.value;
        const conclusionFilter = dbFilterConclusion.value;

        const filtered = allSavedFiches.filter(fiche => {
            // 1. Filtrer par texte
            const matchesSearch = !searchQuery || 
                                  fiche.worker.toLowerCase().includes(searchQuery) || 
                                  fiche.employeur.toLowerCase().includes(searchQuery) ||
                                  fiche.post.toLowerCase().includes(searchQuery);
            
            // 2. Filtrer par type
            const matchesType = typeFilter === "ALL" || fiche.type === typeFilter;
            
            // 3. Filtrer par conclusion
            const matchesConclusion = conclusionFilter === "ALL" || fiche.conclusion === conclusionFilter;
            
            return matchesSearch && matchesType && matchesConclusion;
        });

        renderFichesTable(filtered);
    }

    function renderFichesTable(fiches) {
        if (fiches.length > 0) {
            savedFichesTbody.innerHTML = "";
            fiches.forEach(fiche => {
                const tr = document.createElement("tr");
                tr.style.borderBottom = "1px solid var(--border-color)";
                tr.style.fontSize = "0.95rem";
                
                // Formater le type de fiche
                let typeLabel = fiche.type;
                if (fiche.type === "embauche") typeLabel = "Embauchage";
                else if (fiche.type === "periodique") typeLabel = "Périodique";
                else if (fiche.type === "reprise") typeLabel = "Reprise";
                else if (fiche.type === "inaptitude") typeLabel = "Inaptitude";
                
                // Formater la conclusion
                let conclusionText = fiche.conclusion;
                let conclusionClass = "ok";
                if (fiche.conclusion === "APTE") {
                    conclusionText = "Apte";
                } else if (fiche.conclusion === "APTE_RESERVES") {
                    conclusionText = "Avec réserves";
                    conclusionClass = "warning";
                } else if (fiche.conclusion === "INAPTE_TEMPORAIRE") {
                    conclusionText = "Inapte Temp.";
                    conclusionClass = "defect";
                } else if (fiche.conclusion === "INAPTE_DEFINITIF") {
                    conclusionText = "Inapte Déf.";
                    conclusionClass = "defect";
                }

                // Formater la date en FR
                let frDate = fiche.date;
                if (fiche.date && fiche.date.includes("-")) {
                    const parts = fiche.date.split('-');
                    frDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                }

                tr.innerHTML = `
                    <td style="padding: 0.85rem 1rem;">${frDate}</td>
                    <td style="padding: 0.85rem 1rem; font-weight: 600; color: var(--text-primary);">${fiche.worker}</td>
                    <td style="padding: 0.85rem 1rem;">${fiche.employeur}</td>
                    <td style="padding: 0.85rem 1rem;">${typeLabel}</td>
                    <td style="padding: 0.85rem 1rem;"><span class="status-indicator ${conclusionClass}">${conclusionText}</span></td>
                    <td style="padding: 0.85rem 1rem; display: flex; gap: 0.35rem;">
                        <button class="btn-history-load" data-id="${fiche.id}">Charger</button>
                        <button class="btn-history-delete" data-id="${fiche.id}">Supprimer</button>
                    </td>
                `;
                
                // Attacher les événements aux boutons
                tr.querySelector(".btn-history-load").addEventListener("click", () => loadFicheIntoForm(fiche));
                tr.querySelector(".btn-history-delete").addEventListener("click", () => deleteFiche(fiche.id));
                
                savedFichesTbody.appendChild(tr);
            });
        } else {
            savedFichesTbody.innerHTML = `
                <tr>
                    <td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-muted); font-style: italic;">
                        Aucune fiche ne correspond aux critères de recherche ou de filtres.
                    </td>
                </tr>
            `;
        }
    }

    function loadFicheIntoForm(fiche) {
        formFicheId.value = fiche.id;
        formTypeSelect.value = fiche.type;
        formDoctorTitle.value = fiche.doctor_title;
        formDoctor.value = fiche.doctor_name;
        formStructure.value = fiche.structure;
        formEmployeur.value = fiche.employeur;
        formWorker.value = fiche.worker;
        formPost.value = fiche.post;
        formDate.value = fiche.date;
        formCity.value = fiche.city;
        formConclusion.value = fiche.conclusion;
        formRecommendation.value = fiche.recommendation;
        
        // Mettre à jour la zone d'impression
        updatePrintPreview();
        
        // Cacher les résultats de relecture IA précédents
        formPlaceholderView.style.display = "flex";
        formResultView.style.display = "none";
        
        // Basculer automatiquement sur l'onglet Formulaire
        btnTabForms.click();
        
        alert(`La fiche de ${fiche.worker} a été chargée dans le formulaire.`);
    }

    async function deleteFiche(ficheId) {
        if (!confirm("Voulez-vous supprimer définitivement cette fiche de votre historique ?")) {
            return;
        }
        try {
            const response = await fetch(`/api/fiches/${ficheId}`, { method: "DELETE" });
            const data = await response.json();
            if (data.status === "success") {
                if (formFicheId.value === ficheId) {
                    formFicheId.value = "";
                }
                await loadSavedFiches();
            } else {
                alert("Erreur lors de la suppression : " + data.message);
            }
        } catch (error) {
            console.error("Erreur de suppression :", error);
            alert("Erreur de connexion.");
        }
    }

    btnFormSave.addEventListener("click", async () => {
        const doctor = formDoctor.value.trim();
        const structure = formStructure.value.trim();
        const worker = formWorker.value.trim();
        const date = formDate.value;

        if (!doctor || !structure || !worker || !date) {
            alert("Veuillez remplir au moins les champs obligatoires (Médecin, Structure, Travailleur et Date) pour sauvegarder.");
            return;
        }

        const ficheData = {
            id: formFicheId.value ? formFicheId.value : null,
            type: formTypeSelect.value,
            doctor_title: formDoctorTitle.value,
            doctor_name: doctor,
            structure: structure,
            employeur: formEmployeur.value.trim(),
            worker: worker,
            post: formPost.value.trim(),
            date: date,
            city: formCity.value.trim(),
            conclusion: formConclusion.value,
            recommendation: formRecommendation.value.trim()
        };

        btnFormSave.disabled = true;
        const originalText = btnFormSave.textContent;
        btnFormSave.textContent = "Enregistrement...";

        try {
            const response = await fetch("/api/fiches", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(ficheData)
            });
            const data = await response.json();
            if (data.status === "success") {
                formFicheId.value = data.fiche.id; // Stocker l'ID généré si nouvelle fiche
                alert(data.message);
                await loadSavedFiches();
            } else {
                alert("Erreur de sauvegarde : " + data.message);
            }
        } catch (error) {
            console.error("Erreur de sauvegarde :", error);
            alert("Erreur de connexion lors de la sauvegarde.");
        } finally {
            btnFormSave.disabled = false;
            btnFormSave.textContent = originalText;
        }
    });

    btnFormClear.addEventListener("click", () => {
        if (!confirm("Voulez-vous réinitialiser le formulaire pour démarrer une nouvelle fiche ? Les modifications non sauvegardées seront perdues.")) {
            return;
        }
        formFicheId.value = "";
        formWorker.value = "";
        formEmployeur.value = "";
        formPost.value = "";
        formDate.value = today;
        formCity.value = "";
        formConclusion.value = "APTE";
        formRecommendation.value = "";
        
        formPlaceholderView.style.display = "flex";
        formResultView.style.display = "none";
        
        updatePrintPreview();
    });

    // Écouteurs d'événements pour le filtrage et la recherche
    dbSearchInput.addEventListener("input", applyDatabaseFilters);
    dbFilterType.addEventListener("change", applyDatabaseFilters);
    dbFilterConclusion.addEventListener("change", applyDatabaseFilters);

    // --- LOGIQUE D'EXPORTATION ET IMPORTATION (CSV / JSON) ---

    // 1. Export CSV (Excel)
    btnExportCsv.addEventListener("click", () => {
        if (allSavedFiches.length === 0) {
            alert("Aucune fiche dans la base à exporter.");
            return;
        }
        
        // En-têtes CSV
        const headers = ["ID", "Date de Visite", "Travailleur", "Employeur", "Profession", "Type de Visite", "Conclusion", "Preconisations", "Nom Medecin", "Structure", "Ville"];
        
        const rows = allSavedFiches.map(f => {
            let typeLabel = f.type;
            if (f.type === "embauche") typeLabel = "Embauchage";
            else if (f.type === "periodique") typeLabel = "Periodique";
            else if (f.type === "reprise") typeLabel = "Reprise";
            else if (f.type === "inaptitude") typeLabel = "Inaptitude";
            
            let conclusionLabel = f.conclusion;
            if (f.conclusion === "APTE") conclusionLabel = "Apte";
            else if (f.conclusion === "APTE_RESERVES") conclusionLabel = "Apte avec reserves";
            else if (f.conclusion === "INAPTE_TEMPORAIRE") conclusionLabel = "Inapte temporaire";
            else if (f.conclusion === "INAPTE_DEFINITIF") conclusionLabel = "Inapte definitif";

            const clean = val => {
                if (val === null || val === undefined) return '""';
                // Remplacer les retours à la ligne par des espaces et échapper les guillemets doubles
                const stringVal = String(val).replace(/\r?\n|\r/g, " ").replace(/"/g, '""');
                return `"${stringVal}"`;
            };

            return [
                clean(f.id),
                clean(f.date),
                clean(f.worker),
                clean(f.employeur),
                clean(f.post),
                clean(typeLabel),
                clean(conclusionLabel),
                clean(f.recommendation),
                clean(`${f.doctor_title} ${f.doctor_name}`),
                clean(f.structure),
                clean(f.city)
            ].join(",");
        });
        
        // Encodage BOM UTF-8 (\uFEFF) pour assurer la bonne lecture des accents sous Microsoft Excel
        const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `export_fiches_medicales_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // 2. Export JSON (Backup complet)
    btnExportJson.addEventListener("click", () => {
        if (allSavedFiches.length === 0) {
            alert("Aucune fiche dans la base à sauvegarder.");
            return;
        }
        const jsonContent = JSON.stringify(allSavedFiches, null, 2);
        const blob = new Blob([jsonContent], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `sauvegarde_fiches_medicales_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // 3. Déclencher le téléversement du fichier JSON d'import
    btnTriggerImport.addEventListener("click", () => {
        dbImportFile.click();
    });

    // 4. Traiter le fichier JSON téléversé
    dbImportFile.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (!Array.isArray(importedData)) {
                    alert("Format de fichier invalide. La sauvegarde doit être un tableau JSON de fiches.");
                    return;
                }
                
                if (!confirm(`Voulez-vous importer et restaurer les ${importedData.length} fiches de ce fichier de sauvegarde dans votre base locale ?`)) {
                    return;
                }
                
                let successCount = 0;
                // Envoyer chaque fiche au serveur
                for (const fiche of importedData) {
                    try {
                        const response = await fetch("/api/fiches", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(fiche)
                        });
                        const resData = await response.json();
                        if (resData.status === "success") {
                            successCount++;
                        }
                    } catch (err) {
                        console.error("Erreur lors de l'import :", err);
                    }
                }
                
                alert(`Restauration terminée ! ${successCount} fiches ont été importées.`);
                await loadSavedFiches();
                
            } catch (err) {
                alert("Erreur de lecture du fichier : " + err.message);
            } finally {
                dbImportFile.value = "";
            }
        };
        reader.readAsText(file);
    });

    // Copier la reformulation proposée vers le champ de préconisation du formulaire
    btnFormUseReformulation.addEventListener("click", () => {
        const text = formReformulationContent.textContent.trim();
        if (text) {
            formRecommendation.value = text;
            updatePrintPreview(); // Mettre à jour l'imprimable
            alert("La préconisation a été remplacée par la version corrigée par l'IA.");
        }
    });

    // Lancer l'impression A4
    btnFormPrint.addEventListener("click", () => {
        // S'assurer de la fraîcheur des données
        updatePrintPreview();
        // Lancer le module d'impression du navigateur
        window.print();
    });

    // === INITIALISATION DÉMARRAGE ===
    checkLicenseState();
});
