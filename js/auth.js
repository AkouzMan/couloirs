document.addEventListener('DOMContentLoaded', function() {
    console.log("Module d'authentification chargé");
    
    // Éléments du DOM
    const loginBtn = document.getElementById('loginBtn');
    const loginModal = document.getElementById('loginModal');
    const closeBtn = document.querySelector('.close');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const userStatus = document.getElementById('userStatus');
    
    // S'assurer que les éléments du DOM sont trouvés
    if (!loginBtn) console.error("Élément 'loginBtn' non trouvé");
    if (!loginModal) console.error("Élément 'loginModal' non trouvé");
    if (!closeBtn) console.error("Élément '.close' non trouvé");
    if (!loginForm) console.error("Élément 'loginForm' non trouvé");
    
    // Fonction simple de hachage pour les mots de passe
    // Note: Dans une application réelle, utilisez bcrypt ou un autre algorithme plus sécurisé
    function hashPassword(password) {
        // Vérifier que CryptoJS est disponible
        if (typeof CryptoJS === 'undefined') {
            console.error("Erreur: CryptoJS n'est pas chargé");
            return password; // Fallback simple pour éviter les erreurs
        }
        // Utilisation de SHA-256 (simple à des fins de démonstration)
        return CryptoJS.SHA256(password).toString();
    }
    
    // Utilisateurs avec mots de passe hachés
    const users = [
        { username: 'admin', passwordHash: hashPassword('alpine2024') },
        { username: 'demo', passwordHash: hashPassword('demo123') },
        { username: 'ak', passwordHash: hashPassword('16081995') }
    ];
    
    // État d'authentification
    let isAuthenticated = false;
    
    // Vérifier s'il y a un token dans le localStorage
    function checkAuth() {
        console.log("Vérification de l'authentification...");
        const authToken = localStorage.getItem('authToken');
        if (authToken) {
            try {
                const tokenData = JSON.parse(atob(authToken.split('.')[1]));
                if (tokenData.exp > Date.now() / 1000) {
                    isAuthenticated = true;
                    userStatus.textContent = `Connecté en tant que ${tokenData.username}`;
                    loginBtn.textContent = 'Déconnexion';
                    updateUIState();
                    console.log("Utilisateur authentifié:", tokenData.username);
                    return true;
                } else {
                    console.log("Token expiré");
                    // Nettoyage du token expiré
                    localStorage.removeItem('authToken');
                }
            } catch (e) {
                console.error('Erreur lors de la vérification du token:', e);
                localStorage.removeItem('authToken'); // Suppression du token en cas d'erreur
            }
        }
        isAuthenticated = false;
        loginBtn.textContent = 'Connexion';
        userStatus.textContent = '';
        updateUIState();
        console.log("Utilisateur non authentifié");
        return false;
    }
    
    // Mettre à jour l'état de l'interface en fonction de l'authentification
    function updateUIState() {
        console.log("Mise à jour de l'interface, authentifié:", isAuthenticated);
        
        // Mettre à jour l'affichage des éléments qui nécessitent une authentification
        document.querySelectorAll('.auth-required').forEach(el => {
            el.style.display = isAuthenticated ? 'block' : 'none';
        });
        
        // Mettre à jour les couches de la carte
        updateMapVisibility();
        
        // Déclencher un événement personnalisé pour notifier les autres scripts
        const authEvent = new CustomEvent('authStateChanged', { 
            detail: { isAuthenticated } 
        });
        document.dispatchEvent(authEvent);
    }
    
    // Fonction pour mettre à jour les couches de la carte
    function updateMapVisibility() {
        console.log("Tentative de mise à jour des couches de la carte");
        
        // Vérifier si la fonction est disponible
        if (window.updateMapLayersVisibility && typeof window.updateMapLayersVisibility === 'function') {
            console.log("Fonction updateMapLayersVisibility trouvée, mise à jour des couches");
            window.updateMapLayersVisibility(isAuthenticated);
        } else {
            console.warn("La fonction updateMapLayersVisibility n'est pas disponible, nouvelle tentative après délai");
            // Si la fonction n'est pas encore disponible, réessayer après un court délai
            setTimeout(() => {
                if (window.updateMapLayersVisibility && typeof window.updateMapLayersVisibility === 'function') {
                    console.log("Fonction updateMapLayersVisibility maintenant disponible après délai");
                    window.updateMapLayersVisibility(isAuthenticated);
                } else {
                    // Dernier recours: mise à jour directe des couches si la fonction n'est pas disponible
                    console.warn("La fonction updateMapLayersVisibility n'est pas disponible après attente, mise à jour manuelle");
                    updateLayersManually();
                }
            }, 1000); // Délai plus long pour s'assurer que tous les scripts sont chargés
        }
    }
    
    // Fonction de secours pour mettre à jour manuellement les couches
    function updateLayersManually() {
        if (window.map && window.authLayers && Array.isArray(window.authLayers)) {
            console.log("Mise à jour manuelle des couches - Authentifié:", isAuthenticated);
            window.authLayers.forEach(layer => {
                if (isAuthenticated) {
                    // Ajouter la couche si l'utilisateur est authentifié
                    if (!window.map.hasLayer(layer)) {
                        window.map.addLayer(layer);
                    }
                } else {
                    // Retirer la couche si l'utilisateur n'est pas authentifié
                    if (window.map.hasLayer(layer)) {
                        window.map.removeLayer(layer);
                    }
                }
            });
            
            // Mettre à jour les éléments du DOM qui dépendent de l'authentification
            document.querySelectorAll('.auth-required').forEach(el => {
                el.style.display = isAuthenticated ? 'block' : 'none';
            });
        }
    }
    
    // Ouvrir la modal de connexion
    if (loginBtn) {
        loginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log("Bouton de connexion cliqué, état authentifié:", isAuthenticated);
            
            if (isAuthenticated) {
                // Si déjà connecté, se déconnecter
                logout();
            } else {
                // Sinon ouvrir la modale de connexion
                loginModal.style.display = 'block';
            }
        });
    }
    
    // Fermer la modal en cliquant sur le X
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            loginModal.style.display = 'none';
        });
    }
    
    // Fermer la modal en cliquant en dehors
    window.addEventListener('click', function(event) {
        if (event.target === loginModal) {
            loginModal.style.display = 'none';
        }
    });
    
    // Traiter la soumission du formulaire
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log("Tentative de connexion...");
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            // Hacher le mot de passe entré pour le comparer
            const hashedPassword = hashPassword(password);
            
            // Vérifier les identifiants avec le hash du mot de passe
            const user = users.find(u => u.username === username && u.passwordHash === hashedPassword);
            
            if (user) {
                console.log("Connexion réussie pour:", username);
                // Créer un token JWT simplifié (dans un cas réel, cela serait fait côté serveur)
                const now = Math.floor(Date.now() / 1000);
                const payload = {
                    username: user.username,
                    iat: now,
                    exp: now + 3600 // Expire dans 1 heure
                };
                
                // Format simplifié d'un JWT (header.payload.signature)
                const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify(payload))}.fake-signature`;
                
                // Stocker le token
                localStorage.setItem('authToken', token);
                isAuthenticated = true;
                userStatus.textContent = `Connecté en tant que ${user.username}`;
                loginBtn.textContent = 'Déconnexion';
                loginModal.style.display = 'none';
                loginForm.reset();
                loginError.textContent = '';
                updateUIState();
            } else {
                console.log("Échec de connexion pour:", username);
                loginError.textContent = 'Nom d\'utilisateur ou mot de passe incorrect';
            }
        });
    }
    
    // Fonction de déconnexion
    function logout() {
        console.log("Déconnexion de l'utilisateur");
        localStorage.removeItem('authToken');
        isAuthenticated = false;
        userStatus.textContent = '';
        loginBtn.textContent = 'Connexion';
        
        // Actualiser l'interface immédiatement
        updateUIState();
        
        // Rafraîchir les points sur la carte
        if (window.fetchAndDisplayPoints && typeof window.fetchAndDisplayPoints === 'function') {
            window.fetchAndDisplayPoints().catch(error => {
                console.error("Erreur lors de l'actualisation des points après déconnexion:", error);
            });
        }
    }
    
    // Créer un objet authModule pour encapsuler les fonctions d'authentification
    window.authModule = {
        // Fonctions et propriétés d'authentification
        isAuthenticated: function() {
            // Logique pour vérifier si l'utilisateur est authentifié
            return sessionStorage.getItem('authToken') !== null;
        },
        
        checkAuthStatus: function() {
            // Vérifier si un token existe dans sessionStorage
            const authToken = sessionStorage.getItem('authToken');
            const userStatus = document.getElementById('userStatus');
            const loginBtn = document.getElementById('loginBtn');
            
            if (authToken) {
                if (userStatus) userStatus.textContent = 'Connecté';
                if (loginBtn) loginBtn.textContent = 'Déconnexion';
                
                // Mettre à jour l'état d'authentification
                document.dispatchEvent(new CustomEvent('authStateChanged', { 
                    detail: { isAuthenticated: true }
                }));
            } else {
                if (userStatus) userStatus.textContent = '';
                if (loginBtn) loginBtn.textContent = 'Connexion';
                
                // Mettre à jour l'état d'authentification
                document.dispatchEvent(new CustomEvent('authStateChanged', { 
                    detail: { isAuthenticated: false }
                }));
            }
            
            // Signaler que l'authentification est initialisée
            window.appState = window.appState || {};
            window.appState.authInitialized = true;
            document.dispatchEvent(new Event('authInitialized'));
        }
        
        // Autres fonctions d'authentification...
    };
    
    // Exposer les fonctions et variables nécessaires globalement
    window.authModule = {
        isAuthenticated: () => isAuthenticated,
        updateUIState: updateUIState,
        
        // Ajouter ces fonctions
        hashPassword: hashPassword,
        checkAuthStatus: checkAuth, // Assurer que checkAuthStatus est bien défini
        
        // Fonction pour obtenir l'utilisateur actuel
        getCurrentUser: function() {
            const authToken = localStorage.getItem('authToken');
            
            if (!authToken) {
                console.warn("Aucun token d'authentification trouvé");
                return null;
            }
            
            try {
                const tokenData = JSON.parse(atob(authToken.split('.')[1]));
                const username = tokenData.username;
                
                // Trouver l'utilisateur correspondant
                const user = users.find(u => u.username === username);
                
                if (!user) {
                    console.warn(`Utilisateur ${username} non trouvé`);
                    return null;
                }
                
                return user;
            } catch (e) {
                console.error('Erreur lors de la récupération de l\'utilisateur actuel:', e);
                return null;
            }
        }
    };
    
    // Ajouter un écouteur d'événement pour recharger les points après changement d'authentification
    document.addEventListener('authStateChanged', function(event) {
        if (window.fetchAndDisplayPoints && typeof window.fetchAndDisplayPoints === 'function') {
            window.fetchAndDisplayPoints().catch(error => {
                console.error("Erreur lors de l'actualisation des points après changement d'authentification:", error);
            });
        }
    });
    
    // Vérifier l'authentification au chargement
    checkAuth();
    
    // Signaler que le module d'authentification est initialisé
    window.appState = window.appState || {};
    window.appState.authInitialized = true;
    document.dispatchEvent(new Event('authInitialized'));
    console.log("Module d'authentification initialisé");
});
