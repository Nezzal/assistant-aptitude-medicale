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
                `Veuillez trouver ci-joint le reçu de mon virement BaridiMob pour l'activation de mon assistant d'aptitude médicale.\n\n` +
                `OPTION CHOISIE (Cochez avec un X) :\n` +
                `[ ] Abonnement annuel en ligne (3 000 DA / an)\n` +
                `[ ] Application autonome de bureau à vie (5 000 DA - Licence définitive)\n\n` +
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

    // === CHARGEMENT DES MODÈLES & DOCUMENTS (HYBRIDE) ===
    let autoPollingTimer = null;

    async function loadModels() {
        try {
            const response = await fetch("/api/models");
            const data = await response.json();
            
            if (data.status === "success" && data.models.length > 0) {
                availableModels = data.models;
                modelSelect.innerHTML = "";
                
                const isOllamaOffline = availableModels.some(model => model.name === "no_model");
                const hasInstalledModel = availableModels.some(model => model.provider === "ollama" && model.installed === true);

                if (isOllamaOffline) {
                    // ÉTAPE 1 : Moteur Ollama absent / éteint
                    showOllamaStep1();
                    startAutoPolling();
                } else if (!hasInstalledModel) {
                    // ÉTAPE 2 : Ollama actif, mais aucun modèle installé (ex: qwen2.5:3b)
                    stopAutoPolling();
                    showOllamaStep2();
                } else {
                    // PRÊT : Tout est configuré
                    stopAutoPolling();
                    hideOllamaOnboardingModal();
                }

                availableModels.forEach((model, index) => {
                    const option = document.createElement("option");
                    option.value = model.name;
                    option.textContent = model.display_name;
                    option.dataset.provider = model.provider;
                    option.dataset.installed = model.installed;
                    if (index === 0) option.selected = true;
                    modelSelect.appendChild(option);
                });
                
                checkReadyToAnalyze();
            } else {
                showOllamaStep1();
                startAutoPolling();
            }
        } catch (error) {
            console.error("Erreur de chargement des modèles :", error);
            showOllamaStep1();
            startAutoPolling();
        }
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
            btnText.textContent = "Télécharger et installer le modèle";
        } else {
            const hasText = recommendationInput.value.trim().length > 5;
            const hasModel = modelSelect.value !== "" && modelSelect.value !== "no_model";
            btnAnalyze.disabled = !(hasText && hasModel);
            btnText.textContent = "Lancer l'analyse critique";
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
    // === LOGIQUE DE LA VUE 1 : ANALYSE DIRECTE (COPILOTE) ===
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
                btnText.textContent = "Lancer l'analyse critique";
                return;
            }
        }

        btnAnalyze.disabled = true;
        recommendationInput.disabled = true;
        analyzeSpinner.style.display = "inline-block";
        btnText.textContent = "Analyse...";

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
                throw new Error(errorData.detail || "Une erreur est survenue lors de l'analyse.");
            }

            const result = await response.json();
            renderResults(result);
            
        } catch (error) {
            console.error("Erreur d'analyse :", error);
            alert("Échec de l'analyse : " + error.message);
        } finally {
            btnAnalyze.disabled = false;
            recommendationInput.disabled = false;
            analyzeSpinner.style.display = "none";
            btnText.textContent = "Lancer l'analyse critique";
        }
    });

    function renderResults(result) {
        placeholderView.style.display = "none";
        resultView.style.display = "block";

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
            scoreStatusText.textContent = "Défauts rédactionnels détectés";
            scoreSubtext.className = "status-indicator defect";
            scoreSubtext.textContent = "Action requise";
        } else {
            scoreBadge.classList.add("no-defects");
            scoreStatusText.textContent = "Préconisation conforme";
            scoreSubtext.className = "status-indicator ok";
            scoreSubtext.textContent = "Valide";
        }

        reformulationTextContent.textContent = result.reformulation_proposed || "Aucune reformulation nécessaire.";

        criteriaAnalysisList.innerHTML = "";
        result.analysis.forEach(item => {
            const card = document.createElement("div");
            card.className = "criterion-card";
            if (item.has_defect) card.classList.add("has-defect-border");

            const suggestionsHtml = (item.suggestions && item.suggestions.length > 0) 
                ? `<div class="suggestions-box">
                    <h5>Suggestions de correction</h5>
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
