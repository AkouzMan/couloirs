document.addEventListener('DOMContentLoaded', function() {
    console.log("Module d'authentification chargé");
    
    // Éléments du DOM
    const loginBtn = document.getElementById('loginBtn');
    const loginModal = document.getElementById('loginModal');
    const closeBtn = document.querySelector('#loginModal .close');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const userStatus = document.getElementById('userStatus');
    
    // Éléments de la modale de profil
    const profileModal = document.getElementById('profileModal');
    const closeProfileBtn = profileModal?.querySelector('.close');
    const userInfoForm = document.getElementById('userInfoForm');
    const passwordForm = document.getElementById('passwordForm');
    const editUsername = document.getElementById('editUsername');
    const currentPassword = document.getElementById('currentPassword');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const infoUpdateMessage = document.getElementById('infoUpdateMessage');
    const passwordUpdateMessage = document.getElementById('passwordUpdateMessage');
    
    // Gestion des onglets de la modale de profil
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            // Désactiver tous les onglets et contenus
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Activer l'onglet cliqué et son contenu
            this.classList.add('active');
            const tabId = this.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // S'assurer que les éléments du DOM sont trouvés
    if (!loginBtn) console.error("Élément 'loginBtn' non trouvé");
    if (!loginModal) console.error("Élément 'loginModal' non trouvé");
    if (!closeBtn) console.error("Élément '.close' non trouvé");
    if (!loginForm) console.error("Élément 'loginForm' non trouvé");
    
    // Fonction simple de hachage pour les mots de passe
    function hashPassword(password) {
        // Vérifier que CryptoJS est disponible
        if (typeof CryptoJS === 'undefined') {
            console.error("Erreur: CryptoJS n'est pas chargé");
            return password; // Fallback simple pour éviter les erreurs
        }
        // Utilisation de SHA-256 (simple à des fins de démonstration)
        return CryptoJS.SHA256(password).toString();
    }
    
    // État d'authentification
    let isAuthenticated = false;
    let currentUser = null;
    
    // Vérifier s'il y a un token dans le localStorage
    function checkAuth() {
        console.log("Vérification de l'authentification...");
        const authToken = localStorage.getItem('authToken');
        if (authToken) {
            try {
                const tokenData = JSON.parse(atob(authToken.split('.')[1]));
                if (tokenData.exp > Date.now() / 1000) {
                    isAuthenticated = true;
                    currentUser = { 
                        username: tokenData.username,
                        role: tokenData.role
                    };
                    
                    // Récupérer le hash du mot de passe depuis la base de données pour les vérifications
                    window.dbAuth.getUserPasswordHash(tokenData.username)
                        .then(passwordHash => {
                            if (passwordHash) {
                                currentUser.passwordHash = passwordHash;
                            }
                            updateUserInterface();
                        })
                        .catch(error => {
                            console.error("Erreur lors de la récupération du hash de mot de passe:", error);
                            updateUserInterface();
                        });
                        
                    console.log("Utilisateur authentifié:", tokenData.username);
                    return true;
                } else {
                    console.log("Token expiré");
                    localStorage.removeItem('authToken');
                }
            } catch (e) {
                console.error('Erreur lors de la vérification du token:', e);
                localStorage.removeItem('authToken'); // Suppression du token en cas d'erreur
            }
        }
        isAuthenticated = false;
        currentUser = null;
        updateUserInterface();
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
    
    // Fonction pour mettre à jour l'interface utilisateur - version avec menu déroulant
    function updateUserInterface() {
        const dropdownContent = document.querySelector('.dropdown-content');
        
        if (isAuthenticated && currentUser) {
            // Mise à jour du contenu du bouton de statut utilisateur
            // Utiliser un span pour le texte pour mieux contrôler sa position
            userStatus.innerHTML = `<span>${currentUser.username}</span>`;
            userStatus.title = "Cliquez pour afficher les options";
            loginBtn.style.display = 'none'; // Cacher le bouton de connexion quand l'utilisateur est connecté
            
            // S'assurer que le menu déroulant est créé si l'utilisateur est connecté
            createUserDropdownIfNeeded();
        } else {
            userStatus.innerHTML = '';
            userStatus.title = "";
            loginBtn.style.display = 'block'; // Afficher le bouton de connexion
            loginBtn.textContent = 'Connexion';
            
            // Supprimer le menu déroulant si présent
            if (dropdownContent) {
                dropdownContent.parentElement.removeChild(dropdownContent);
            }
        }
        updateUIState();
    }
    
    // Fonction pour créer le menu déroulant s'il n'existe pas déjà
    function createUserDropdownIfNeeded() {
        if (!document.querySelector('.dropdown-content')) {
            const dropdownContent = document.createElement('div');
            dropdownContent.className = 'dropdown-content';
            
            // Options du menu - Déconnexion en premier
            dropdownContent.innerHTML = `
                <a class="logout">Déconnexion</a>
                <a class="change-password">Modifier le mot de passe</a>
                <a class="edit-username">Modifier le nom d'utilisateur</a>
            `;
            
            // Ajouter les gestionnaires d'événements
            dropdownContent.querySelector('.logout').addEventListener('click', logout);
            dropdownContent.querySelector('.change-password').addEventListener('click', showChangePasswordModal);
            dropdownContent.querySelector('.edit-username').addEventListener('click', showEditUsernameModal);
            
            // Insérer le menu après le bouton userStatus
            userStatus.parentNode.appendChild(dropdownContent);
        }
    }
    
    // Gérer l'affichage du menu déroulant - Simplifier pour éviter l'ouverture du panneau de profil
    if (userStatus) {
        userStatus.addEventListener('click', function(e) {
            e.stopPropagation();
            
            if (isAuthenticated && currentUser) {
                const dropdownContent = document.querySelector('.dropdown-content');
                if (dropdownContent) {
                    dropdownContent.classList.toggle('show');
                    userStatus.classList.toggle('dropdown-open');
                }
            }
        });
        
        // Fermer le menu déroulant en cliquant ailleurs
        document.addEventListener('click', function(e) {
            if (!userStatus.contains(e.target)) {
                const dropdownContent = document.querySelector('.dropdown-content');
                if (dropdownContent && dropdownContent.classList.contains('show')) {
                    dropdownContent.classList.remove('show');
                    userStatus.classList.remove('dropdown-open');
                }
            }
        });
    }
    
    // Fonction pour afficher la modale de modification du nom d'utilisateur
    function showEditUsernameModal() {
        // Fermer le menu déroulant
        document.querySelector('.dropdown-content').classList.remove('show');
        userStatus.classList.remove('dropdown-open');
        
        // Créer et afficher la modale
        if (!document.getElementById('editUsernameModal')) {
            createEditUsernameModal();
        }
        
        // Pré-remplir le champ avec le nom d'utilisateur actuel
        document.getElementById('newUsername').value = currentUser.username;
        document.getElementById('confirmPasswordUsername').value = '';
        document.getElementById('editUsernameError').textContent = '';
        
        // Afficher la modale
        document.getElementById('editUsernameModal').style.display = 'block';
    }
    
    // Fonction pour afficher la modale de modification du mot de passe
    function showChangePasswordModal() {
        // Fermer le menu déroulant
        document.querySelector('.dropdown-content').classList.remove('show');
        userStatus.classList.remove('dropdown-open');
        
        // Créer et afficher la modale
        if (!document.getElementById('changePasswordModal')) {
            createChangePasswordModal();
        }
        
        // Réinitialiser les champs
        document.getElementById('oldPassword').value = '';
        document.getElementById('newPasswordField').value = '';
        document.getElementById('confirmNewPassword').value = '';
        document.getElementById('changePasswordError').textContent = '';
        
        // Afficher la modale
        document.getElementById('changePasswordModal').style.display = 'block';
    }
    
    // Fonction pour créer la modale de modification du nom d'utilisateur
    function createEditUsernameModal() {
        const modal = document.createElement('div');
        modal.id = 'editUsernameModal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>Modifier le nom d'utilisateur</h2>
                <form id="editUsernameForm">
                    <div class="form-group">
                        <label for="newUsername">Nouveau nom d'utilisateur:</label>
                        <input type="text" id="newUsername" required>
                    </div>
                    <div class="form-group">
                        <label for="confirmPasswordUsername">Mot de passe pour confirmer:</label>
                        <input type="password" id="confirmPasswordUsername" required>
                    </div>
                    <div class="form-group">
                        <button type="submit" class="primary-btn action-button">Modifier</button>
                    </div>
                    <div id="editUsernameError" class="error-message"></div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Gestionnaires d'événements pour la modale
        const closeBtn = modal.querySelector('.close');
        const form = modal.querySelector('#editUsernameForm');
        
        closeBtn.addEventListener('click', function() {
            modal.style.display = 'none';
        });
        
        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
        
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const newUsername = document.getElementById('newUsername').value.trim();
            const password = document.getElementById('confirmPasswordUsername').value;
            const errorElement = document.getElementById('editUsernameError');
            
            if (!newUsername) {
                errorElement.textContent = "Le nom d'utilisateur ne peut pas être vide";
                return;
            }
            
            // Vérifier le mot de passe
            const hashedPassword = hashPassword(password);
            if (hashedPassword !== currentUser.passwordHash) {
                errorElement.textContent = "Mot de passe incorrect";
                return;
            }
            
            try {
                // Utiliser la fonction de base de données pour mettre à jour le nom d'utilisateur
                const success = await window.dbAuth.updateUsername(currentUser.username, newUsername);
                
                if (success) {
                    // Mettre à jour les informations de l'utilisateur actuel
                    currentUser.username = newUsername;
                    
                    // Mettre à jour le token dans localStorage
                    updateUserToken();
                    
                    // Mettre à jour l'interface
                    updateUserInterface();
                    
                    // Fermer la modale
                    modal.style.display = 'none';
                    
                    // Notification de succès
                    showNotification('success', "Nom d'utilisateur modifié avec succès");
                } else {
                    errorElement.textContent = "Erreur lors de la mise à jour du nom d'utilisateur";
                }
            } catch (error) {
                console.error("Erreur lors de la mise à jour du nom d'utilisateur:", error);
                errorElement.textContent = "Une erreur est survenue";
            }
        });
    }
    
    // Fonction pour créer la modale de modification du mot de passe
    function createChangePasswordModal() {
        const modal = document.createElement('div');
        modal.id = 'changePasswordModal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>Modifier le mot de passe</h2>
                <form id="changePasswordForm">
                    <div class="form-group">
                        <label for="oldPassword">Mot de passe actuel:</label>
                        <input type="password" id="oldPassword" required>
                    </div>
                    <div class="form-group">
                        <label for="newPasswordField">Nouveau mot de passe:</label>
                        <input type="password" id="newPasswordField" required minlength="6">
                    </div>
                    <div class="form-group">
                        <label for="confirmNewPassword">Confirmer le mot de passe:</label>
                        <input type="password" id="confirmNewPassword" required minlength="6">
                    </div>
                    <div class="form-group">
                        <button type="submit" class="primary-btn action-button">Modifier</button>
                    </div>
                    <div id="changePasswordError" class="error-message"></div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Gestionnaires d'événements pour la modale
        const closeBtn = modal.querySelector('.close');
        const form = modal.querySelector('#changePasswordForm');
        
        closeBtn.addEventListener('click', function() {
            modal.style.display = 'none';
        });
        
        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
        
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const oldPassword = document.getElementById('oldPassword').value;
            const newPassword = document.getElementById('newPasswordField').value;
            const confirmPassword = document.getElementById('confirmNewPassword').value;
            const errorElement = document.getElementById('changePasswordError');
            
            // Vérifier que le nouveau mot de passe correspond à la confirmation
            if (newPassword !== confirmPassword) {
                errorElement.textContent = "Les mots de passe ne correspondent pas";
                return;
            }
            
            // Vérifier que le mot de passe actuel est correct
            const hashedCurrentPwd = hashPassword(oldPassword);
            if (hashedCurrentPwd !== currentUser.passwordHash) {
                errorElement.textContent = "Mot de passe actuel incorrect";
                return;
            }
            
            try {
                // Générer le hash du nouveau mot de passe
                const hashedNewPwd = hashPassword(newPassword);
                
                // Utiliser la fonction de base de données pour mettre à jour le mot de passe
                const success = await window.dbAuth.updatePassword(currentUser.username, hashedNewPwd);
                
                if (success) {
                    // Mettre à jour les informations de l'utilisateur actuel
                    currentUser.passwordHash = hashedNewPwd;
                    
                    // Mettre à jour le token dans localStorage
                    updateUserToken();
                    
                    // Fermer la modale
                    modal.style.display = 'none';
                    
                    // Notification de succès
                    showNotification('success', "Mot de passe modifié avec succès");
                } else {
                    errorElement.textContent = "Erreur lors de la modification du mot de passe";
                }
            } catch (error) {
                console.error("Erreur lors de la modification du mot de passe:", error);
                errorElement.textContent = "Une erreur est survenue";
            }
        });
    }
    
    // Fonction utilitaire pour afficher des notifications
    function showNotification(type, message) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `<p>${message}</p>`;
        
        document.body.appendChild(notification);
        
        // Faire disparaître la notification après 3 secondes
        setTimeout(() => {
            notification.classList.add('fadeOut');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 500);
        }, 3000);
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
    
    // Supprimer la partie qui ouvre la modale de profil en cliquant sur userStatus
    // car nous utilisons maintenant un menu déroulant à la place
    if (userStatus) {
        // Supprimer l'ancien gestionnaire d'événement s'il existe
        const oldClickHandler = userStatus._clickHandler;
        if (oldClickHandler) {
            userStatus.removeEventListener('click', oldClickHandler);
        }
    }
    
    // Gérer la soumission du formulaire d'information utilisateur
    if (userInfoForm) {
        userInfoForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (!isAuthenticated || !currentUser) {
                console.error("Non autorisé à modifier les informations");
                return;
            }
            
            const newUsername = editUsername.value.trim();
            
            if (!newUsername) {
                infoUpdateMessage.textContent = "Le nom d'utilisateur ne peut pas être vide";
                infoUpdateMessage.style.color = '#e74c3c';
                infoUpdateMessage.classList.add('visible');
                return;
            }
            
            try {
                // Utiliser la fonction de base de données pour mettre à jour le nom d'utilisateur
                const success = await window.dbAuth.updateUsername(currentUser.username, newUsername);
                
                if (success) {
                    // Mettre à jour les informations de l'utilisateur actuel
                    currentUser.username = newUsername;
                    
                    // Mettre à jour le token dans localStorage
                    updateUserToken();
                    
                    // Mettre à jour l'interface
                    updateUserInterface();
                    
                    // Afficher un message de succès
                    infoUpdateMessage.textContent = "Nom d'utilisateur mis à jour avec succès!";
                    infoUpdateMessage.style.color = '#28a745';
                    infoUpdateMessage.classList.add('visible');
                    
                    // Masquer le message après un délai
                    setTimeout(() => {
                        infoUpdateMessage.classList.remove('visible');
                    }, 3000);
                } else {
                    infoUpdateMessage.textContent = "Erreur lors de la mise à jour";
                    infoUpdateMessage.style.color = '#e74c3c';
                    infoUpdateMessage.classList.add('visible');
                }
            } catch (error) {
                console.error("Erreur lors de la mise à jour du nom d'utilisateur:", error);
                infoUpdateMessage.textContent = "Une erreur est survenue";
                infoUpdateMessage.style.color = '#e74c3c';
                infoUpdateMessage.classList.add('visible');
            }
        });
    }
    
    // Gérer la soumission du formulaire de changement de mot de passe
    if (passwordForm) {
        passwordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (!isAuthenticated || !currentUser) {
                console.error("Non autorisé à modifier le mot de passe");
                return;
            }
            
            const currentPwd = currentPassword.value;
            const newPwd = newPassword.value;
            const confirmPwd = confirmPassword.value;
            
            // Vérifier que le nouveau mot de passe correspond à la confirmation
            if (newPwd !== confirmPwd) {
                passwordUpdateMessage.textContent = "Les mots de passe ne correspondent pas";
                passwordUpdateMessage.style.color = '#e74c3c';
                passwordUpdateMessage.classList.add('visible');
                return;
            }
            
            // Vérifier que le mot de passe actuel est correct
            const hashedCurrentPwd = hashPassword(currentPwd);
            if (hashedCurrentPwd !== currentUser.passwordHash) {
                passwordUpdateMessage.textContent = "Mot de passe actuel incorrect";
                passwordUpdateMessage.style.color = '#e74c3c';
                passwordUpdateMessage.classList.add('visible');
                return;
            }
            
            try {
                // Générer le hash du nouveau mot de passe
                const hashedNewPwd = hashPassword(newPwd);
                
                // Utiliser la fonction de base de données pour mettre à jour le mot de passe
                const success = await window.dbAuth.updatePassword(currentUser.username, hashedNewPwd);
                
                if (success) {
                    // Mettre à jour les informations de l'utilisateur actuel
                    currentUser.passwordHash = hashedNewPwd;
                    
                    // Mettre à jour le token dans localStorage (si nécessaire)
                    updateUserToken();
                    
                    // Afficher un message de succès
                    passwordUpdateMessage.textContent = "Mot de passe modifié avec succès!";
                    passwordUpdateMessage.style.color = '#28a745';
                    passwordUpdateMessage.classList.add('visible');
                    
                    // Réinitialiser le formulaire
                    passwordForm.reset();
                    
                    // Masquer le message après un délai
                    setTimeout(() => {
                        passwordUpdateMessage.classList.remove('visible');
                    }, 3000);
                } else {
                    passwordUpdateMessage.textContent = "Erreur lors de la modification du mot de passe";
                    passwordUpdateMessage.style.color = '#e74c3c';
                    passwordUpdateMessage.classList.add('visible');
                }
            } catch (error) {
                console.error("Erreur lors de la modification du mot de passe:", error);
                passwordUpdateMessage.textContent = "Une erreur est survenue";
                passwordUpdateMessage.style.color = '#e74c3c';
                passwordUpdateMessage.classList.add('visible');
            }
        });
    }
    
    // Fonction pour mettre à jour le token utilisateur dans le localStorage
    function updateUserToken() {
        if (isAuthenticated && currentUser) {
            const now = Math.floor(Date.now() / 1000);
            const payload = {
                username: currentUser.username,
                role: currentUser.role,
                iat: now,
                exp: now + 3600 // Expire dans 1 heure
            };
            
            // Format simplifié d'un JWT
            const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify(payload))}.fake-signature`;
            
            // Stocker le token
            localStorage.setItem('authToken', token);
        }
    }
    
    // Gestion de la fermeture de la modale de profil
    if (closeProfileBtn) {
        closeProfileBtn.addEventListener('click', function() {
            profileModal.style.display = 'none';
        });
    }
    
    // Fermer la modale de profil en cliquant en dehors
    window.addEventListener('click', function(event) {
        if (event.target === profileModal) {
            profileModal.style.display = 'none';
        }
    });
    
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
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log("Tentative de connexion...");
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            // Hacher le mot de passe entré pour le comparer
            const hashedPassword = hashPassword(password);
            
            try {
                // Utiliser la fonction de vérification des identifiants depuis la base de données
                const user = await window.dbAuth.verifyUserCredentials(username, hashedPassword);
                
                if (user) {
                    console.log("Connexion réussie pour:", username);
                    // Créer un token JWT simplifié
                    const now = Math.floor(Date.now() / 1000);
                    const payload = {
                        username: user.username,
                        role: user.role,
                        iat: now,
                        exp: now + 3600 // Expire dans 1 heure
                    };
                    
                    // Format simplifié d'un JWT
                    const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify(payload))}.fake-signature`;
                    
                    // Stocker le token
                    localStorage.setItem('authToken', token);
                    isAuthenticated = true;
                    currentUser = {
                        username: user.username,
                        role: user.role,
                        passwordHash: user.passwordHash // Conservé pour la vérification de mot de passe
                    };
                    
                    // Mise à jour de l'interface utilisateur
                    updateUserInterface(); // Appeler la fonction au lieu de manipuler directement les éléments
                    
                    // Fermer la modale et réinitialiser le formulaire
                    loginModal.style.display = 'none';
                    loginForm.reset();
                    loginError.textContent = '';
                } else {
                    console.log("Échec de connexion pour:", username);
                    loginError.textContent = 'Nom d\'utilisateur ou mot de passe incorrect';
                }
            } catch (error) {
                console.error("Erreur lors de la connexion:", error);
                loginError.textContent = 'Une erreur est survenue lors de la connexion';
            }
        });
    }
    
    // Fonction de déconnexion
    function logout() {
        console.log("Déconnexion de l'utilisateur");
        localStorage.removeItem('authToken');
        isAuthenticated = false;
        currentUser = null;
        
        // Actualiser l'interface
        updateUserInterface();
        
        // Rafraîchir les points sur la carte
        if (window.fetchAndDisplayPoints && typeof window.fetchAndDisplayPoints === 'function') {
            window.fetchAndDisplayPoints().catch(error => {
                console.error("Erreur lors de l'actualisation des points après déconnexion:", error);
            });
        }
    }
    
    // Supprimer la fonction initAuthUI qui gère le bouton de déconnexion supprimé
    // Cette fonction n'est plus nécessaire car nous n'utilisons qu'un seul bouton qui toggle

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
        hashPassword: hashPassword,
        checkAuthStatus: checkAuth,
        
        // Fonction pour obtenir l'utilisateur actuel
        getCurrentUser: function() {
            return currentUser;
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
