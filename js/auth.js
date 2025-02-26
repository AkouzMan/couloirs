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
                }
            } catch (e) {
                console.error('Erreur lors de la vérification du token:', e);
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
        
        // Vérifier si les éléments de carte sont chargés
        if (window.updateMapLayersVisibility && typeof window.updateMapLayersVisibility === 'function') {
            // Appeler la fonction dans script.js pour mettre à jour la visibilité des couches de carte
            window.updateMapLayersVisibility(isAuthenticated);
        } else {
            // Si la fonction n'est pas encore disponible, réessayer après un court délai
            setTimeout(() => {
                if (window.updateMapLayersVisibility && typeof window.updateMapLayersVisibility === 'function') {
                    window.updateMapLayersVisibility(isAuthenticated);
                } else {
                    console.warn("La fonction updateMapLayersVisibility n'est pas disponible");
                }
            }, 500);
        }
        
        // Déclencher un événement personnalisé pour notifier les autres scripts
        const authEvent = new CustomEvent('authStateChanged', { detail: { isAuthenticated } });
        document.dispatchEvent(authEvent);
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
        updateUIState();
    }
    
    // Exposer les fonctions et variables nécessaires globalement
    window.authModule = {
        isAuthenticated: () => isAuthenticated,
        updateUIState: updateUIState
    };
    
    // Vérifier l'authentification au chargement
    checkAuth();
    
    // Signaler que le module d'authentification est initialisé
    window.appState = window.appState || {};
    window.appState.authInitialized = true;
    document.dispatchEvent(new Event('authInitialized'));
    console.log("Module d'authentification initialisé");
});
