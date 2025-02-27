// Constants for database
const DB_NAME = "couloirsDB";
const DB_VERSION = 2; // Augmenter la version pour forcer la mise à niveau
const STORE_NAME = "couloirs";
const USER_STORE_NAME = "users";

let dbPromise = null;

// Open database connection
function openDatabase() {
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
        console.log("Ouverture de la base de données IndexedDB...");
        
        // Check if IndexedDB is available
        if (!window.indexedDB) {
            console.error("Votre navigateur ne supporte pas IndexedDB");
            reject("IndexedDB non supporté");
            return;
        }
        
        // Open database with updated version
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        // Handle database upgrade (called if the database doesn't exist or version changes)
        request.onupgradeneeded = function(event) {
            console.log("Mise à niveau de la base de données vers la version", DB_VERSION);
            const db = event.target.result;
            
            // Create object store for couloirs if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                console.log("Création du magasin d'objets 'couloirs'");
                const store = db.createObjectStore(STORE_NAME, { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                
                // Create indexes for commonly queried fields
                store.createIndex('nom', 'nom', { unique: false });
                store.createIndex('user', 'user', { unique: false });
                store.createIndex('exposition', 'exposition', { unique: false });
                
                console.log("Structure de la base de données Couloirs créée");
            } else {
                console.log("Le magasin d'objets 'couloirs' existe déjà");
            }
            
            // Create object store for users if it doesn't exist
            if (!db.objectStoreNames.contains(USER_STORE_NAME)) {
                console.log("Création du magasin d'objets 'users'");
                const userStore = db.createObjectStore(USER_STORE_NAME, { 
                    keyPath: 'username'
                });
                
                // Create index for username (although it's the key)
                userStore.createIndex('username', 'username', { unique: true });
                
                console.log("Structure de la base de données Users créée");
            } else {
                console.log("Le magasin d'objets 'users' existe déjà");
            }
        };
        
        // Log any errors during upgrade
        request.onupgradeneeded.onerror = function(event) {
            console.error("Erreur lors de la mise à niveau de la base de données:", event.target.error);
            reject(event.target.error);
        };
        
        // Success handler
        request.onsuccess = function(event) {
            const db = event.target.result;
            console.log("Base de données ouverte avec succès, version:", db.version);
            
            // Vérification des magasins d'objets
            const storeNames = Array.from(db.objectStoreNames);
            console.log("Magasins d'objets disponibles:", storeNames);
            
            resolve(db);
        };
        
        // Error handler
        request.onerror = function(event) {
            console.error("Erreur lors de l'ouverture de la base de données", event.target.error);
            reject(event.target.error);
        };
        
        // Bloqué (pour débogage)
        request.onblocked = function(event) {
            console.warn("Ouverture de la base de données bloquée, fermez les autres onglets utilisant la base de données");
            alert("Veuillez fermer tous les autres onglets de cette application pour permettre la mise à niveau de la base de données");
        };
    });
    
    return dbPromise;
}

// Check if database is initialized with couloirs table
async function checkDatabaseExists() {
    try {
        const db = await openDatabase();
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        
        // Count the number of items in the store
        const countRequest = store.count();
        
        return new Promise((resolve, reject) => {
            countRequest.onsuccess = function() {
                resolve(countRequest.result > 0);
            };
            
            countRequest.onerror = function(event) {
                console.error("Erreur lors de la vérification de la base de données", event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error("Erreur lors de la vérification de la base de données:", error);
        return false;
    }
}

// Initialize database
async function initDatabase() {
    try {
        const dbExists = await checkDatabaseExists();
        
        if (!dbExists) {
            console.log("Base de données vide, insertion des données de test...");
            await insertTestData();
            console.log("Base de données initialisée avec succès");
            
            // Initialiser les utilisateurs également
            await initUsers();
            console.log("Base de données d'utilisateurs initialisée avec succès");
        } else {
            console.log("Base de données déjà initialisée");
            
            // Vérifier quand même les utilisateurs
            await initUsers();
        }
        
        return true;
    } catch (error) {
        console.error("Erreur lors de l'initialisation de la base de données:", error);
        return false;
    }
}

// Add a single couloir to the database
async function addCouloir(couloir) {
    try {
        const db = await openDatabase();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.add(couloir);
            
            request.onsuccess = function(event) {
                const newId = event.target.result;
                console.log("Couloir ajouté avec succès, ID:", newId);
                
                // Notifier les autres fenêtres de la mise à jour de la base de données
                notifyDatabaseChange("add", { id: newId, data: couloir });
                
                resolve(newId);
            };
            
            request.onerror = function(event) {
                console.error("Erreur lors de l'ajout du couloir:", event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error("Erreur lors de l'ajout du couloir:", error);
        throw error;
    }
}

// Insert test data into the database
async function insertTestData() {
    const testData = [
        { nom: "Couloir E du Portalet", latitude: 46.007, longitude: 7.042, exposition: "E", altitude_max: 3344, altitude_min: 2344, pente: 43, cotation_ski: "4.3", exposition_ski: "E2", commentaire: "", lien: "https://www.camptocamp.org/routes/160967/fr/le-portalet-couloir-e", user: "..." },
        { nom: "Couloir de Bel Oiseau", latitude: 46.062, longitude: 6.929, exposition: "NE", altitude_max: 2525, altitude_min: 1725, pente: 43, cotation_ski: "4.3", exposition_ski: "E2", commentaire: "", lien: "https://www.camptocamp.org/routes/115525/fr/bel-oiseau-couloir-ene", user: "..." },
        { nom: "L'aile et la rampe de la colombe", latitude: 46.168, longitude: 6.749, exposition: "NE", altitude_max: 2406, altitude_min: 1806, pente: 42, cotation_ski: "4.2", exposition_ski: "E2", commentaire: "", lien: "https://www.camptocamp.org/routes/732886/fr/tete-de-bossetan-bostan-l-aile-de-la-colombe", user: "..." },
        { nom: "Rampe des chamois", latitude: 46.168, longitude: 6.749, exposition: "N", altitude_max: 2406, altitude_min: 1706, pente: 43, cotation_ski: "4.3", exposition_ski: "E3", commentaire: "", lien: "https://www.camptocamp.org/routes/732887/fr/tete-de-bossetan-bostan-rampe-des-chamois", user: "..." },
        { nom: "Couloirs du Bürglen", latitude: 46.875, longitude: 8.628, exposition: "S", altitude_max: 2165, altitude_min: 1665, pente: 41, cotation_ski: "4.1", exposition_ski: "E1", commentaire: "", lien: "https://www.camptocamp.org/routes/47398/fr/burglen-couloirs-ne", user: "..." },
        { nom: "Couloir de la Table (Aiguille du Tour)", latitude: 45.983, longitude: 7.005, exposition: "S", altitude_max: 3540, altitude_min: 2940, pente: 43, cotation_ski: "4.3", exposition_ski: "E2", commentaire: "", lien: "https://www.camptocamp.org/routes/46737/fr/aiguille-du-tour-couloir-de-la-table", user: "..." },
        { nom: "Couloir Copt", latitude: 45.976, longitude: 7.002, exposition: "N", altitude_max: 3680, altitude_min: 2980, pente: 51, cotation_ski: "5.1", exposition_ski: "E2", commentaire: "Rappel nécessaire", lien: "https://www.camptocamp.org/routes/56242/fr/aiguille-sans-nom-dorees-couloir-copt", user: "..." },
        { nom: "Couloir Annibal", latitude: 45.923, longitude: 7.208, exposition: "W", altitude_max: 3730, altitude_min: 2930, pente: 43, cotation_ski: "4.3", exposition_ski: "E2", commentaire: "", lien: "https://www.camptocamp.org/routes/45518/fr/mont-velan-couloir-d-annibal", user: "..." },
        { nom: "Génépi", latitude: 46.013, longitude: 7.052, exposition: "NE", altitude_max: 2880, altitude_min: 2280, pente: 42, cotation_ski: "4.2", exposition_ski: "E2", commentaire: "", lien: "https://www.camptocamp.org/routes/45232/fr/le-genepi-arpette-couloir-ne-depuis-le-plan-de-l-au", user: "..." },
        { nom: "Couloirs W du Petit Combin", latitude: 45.998, longitude: 7.317, exposition: "W", altitude_max: 3663, altitude_min: 3063, pente: 42, cotation_ski: "4.2", exposition_ski: "E2", commentaire: "", lien: "https://www.camptocamp.org/routes/46038/fr/petit-combin-couloir-w-par-le-glacier-pendant", user: "..." },
        { nom: "Couloir ENE de Barme", latitude: 46.155, longitude: 6.835, exposition: "NE", altitude_max: 2685, altitude_min: 2085, pente: 52, cotation_ski: "5.2", exposition_ski: "E3", commentaire: "", lien: "https://www.camptocamp.org/routes/53598/fr/dents-blanches-dent-de-barme-couloirs-ene", user: "..." },
        { nom: "Couloir de la Tsa", latitude: 45.984, longitude: 7.579, exposition: "W", altitude_max: 3668, altitude_min: 2868, pente: 51, cotation_ski: "5.1", exposition_ski: "E2", commentaire: "", lien: "https://www.camptocamp.org/routes/49377/fr/aiguille-de-la-tsa-couloirs-w", user: "..." },
        { nom: "Grand Golliat", latitude: 45.865, longitude: 7.185, exposition: "NE", altitude_max: 3238, altitude_min: 2638, pente: 42, cotation_ski: "4.2", exposition_ski: "E2", commentaire: "Partie sommitale en mode crapahutage pas facile (Labande 20.)", lien: "https://www.camptocamp.org/routes/45770/fr/grand-golliat-couloir-ne", user: "..." },
        { nom: "Mont de la Gouille", latitude: 46.019, longitude: 7.423, exposition: "NE", altitude_max: 3212, altitude_min: 2412, pente: 43, cotation_ski: "4.3", exposition_ski: "E2", commentaire: "Longue approche, remontée dans le couloir", lien: "https://www.camptocamp.org/routes/1172007/fr/mont-de-la-gouille-couloir-ne", user: "..." },
        { nom: "Couloir N de la Pointe des Savolaires", latitude: 46.274, longitude: 7.056, exposition: "NW", altitude_max: 2980, altitude_min: 2380, pente: 33, cotation_ski: "3.3", exposition_ski: "E2", commentaire: "", lien: "https://www.camptocamp.org/routes/45922/fr/pointe-des-savolaires-couloir-n", user: "..." },
        { nom: "Couloir NW de la Pointe de Pré Fleuri", latitude: 46.201, longitude: 7.059, exposition: "NW", altitude_max: 3310, altitude_min: 2710, pente: 41, cotation_ski: "4.1", exposition_ski: "E2", commentaire: "", lien: "https://www.camptocamp.org/routes/147513/fr/pointe-de-pre-fleuri-couloir-nw", user: "..." }
    ];
    
    try {
        for (const couloir of testData) {
            await addCouloir(couloir);
        }
        console.log(`${testData.length} couloirs insérés avec succès`);
        return true;
    } catch (error) {
        console.error("Erreur lors de l'insertion des données de test:", error);
        return false;
    }
}

// Get all couloirs from the database
async function getAllCouloirs() {
    try {
        const db = await openDatabase();
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            
            request.onsuccess = function(event) {
                console.log(`${event.target.result.length} couloirs récupérés`);
                resolve(event.target.result);
            };
            
            request.onerror = function(event) {
                console.error("Erreur lors de la récupération des couloirs:", event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des couloirs:", error);
        return [];
    }
}

// Get a specific couloir by ID
async function getCouloirById(id) {
    try {
        const db = await openDatabase();
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.get(id);
            
            request.onsuccess = function(event) {
                if (event.target.result) {
                    resolve(event.target.result);
                } else {
                    resolve(null);
                }
            };
            
            request.onerror = function(event) {
                console.error("Erreur lors de la récupération du couloir:", event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error("Erreur lors de la récupération du couloir:", error);
        return null;
    }
}

// Display all couloirs in the console
async function displayAllCouloirs() {
    try {
        const couloirs = await getAllCouloirs();
        console.table(couloirs);
        return couloirs;
    } catch (error) {
        console.error("Erreur lors de l'affichage des couloirs:", error);
        return [];
    }
}

// Count the number of couloirs in the database
async function countCouloirs() {
    try {
        const db = await openDatabase();
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.count();
            
            request.onsuccess = function(event) {
                const count = event.target.result;
                console.log(`Nombre de couloirs dans la base de données: ${count}`);
                resolve(count);
            };
            
            request.onerror = function(event) {
                console.error("Erreur lors du comptage des couloirs:", event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error("Erreur lors du comptage des couloirs:", error);
        return 0;
    }
}

// Update an existing couloir
async function updateCouloir(couloir) {
    try {
        const db = await openDatabase();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.put(couloir);
            
            request.onsuccess = function(event) {
                console.log("Couloir mis à jour avec succès, ID:", event.target.result);
                
                // Notifier les autres fenêtres de la mise à jour de la base de données
                notifyDatabaseChange("update", { id: couloir.id, data: couloir });
                
                resolve(event.target.result);
            };
            
            request.onerror = function(event) {
                console.error("Erreur lors de la mise à jour du couloir:", event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error("Erreur lors de la mise à jour du couloir:", error);
        throw error;
    }
}

// Delete a couloir by ID
async function deleteCouloir(id) {
    try {
        const db = await openDatabase();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            
            request.onsuccess = function() {
                console.log(`Couloir avec ID ${id} supprimé avec succès`);
                
                // Notifier les autres fenêtres de la mise à jour de la base de données
                notifyDatabaseChange("delete", { id: id });
                
                resolve(true);
            };
            
            request.onerror = function(event) {
                console.error("Erreur lors de la suppression du couloir:", event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error("Erreur lors de la suppression du couloir:", error);
        return false;
    }
}

// Fonction pour réinitialiser la base de données
async function resetDatabase() {
    try {
        // Ouvrir la base de données
        const db = await openDatabase();
        
        // Supprimer toutes les données existantes
        return new Promise((resolve, reject) => {
            // Supprimer la base de données entièrement
            const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
            
            deleteRequest.onsuccess = function() {
                console.log("Base de données supprimée avec succès");
                
                // Réinitialiser la variable dbPromise
                dbPromise = null;
                
                // Ouvrir à nouveau la base de données et initialiser
                setTimeout(async () => {
                    try {
                        await initDatabase();
                        console.log("Base de données réinitialisée avec succès");
                        resolve(true);
                    } catch (error) {
                        console.error("Erreur lors de la réinitialisation de la base de données:", error);
                        reject(error);
                    }
                }, 500);
            };
            
            deleteRequest.onerror = function(event) {
                console.error("Erreur lors de la suppression de la base de données:", event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error("Erreur lors de la réinitialisation de la base de données:", error);
        throw error;
    }
}

// Système de synchronisation entre fenêtres
function notifyDatabaseChange(operation, data) {
    // Utiliser BroadcastChannel API pour la communication entre fenêtres
    if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel('couloirs_db_sync');
        channel.postMessage({ operation, data, timestamp: Date.now() });
        channel.close();
    } else {
        // Fallback pour les navigateurs sans BroadcastChannel : utiliser localStorage
        const syncMessage = JSON.stringify({ operation, data, timestamp: Date.now() });
        localStorage.setItem('couloirs_db_sync', syncMessage);
        // Déclencher un événement storage pour notifier les autres onglets
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'couloirs_db_sync',
            newValue: syncMessage
        }));
    }
}

// Configuration des écouteurs pour les mises à jour de la base de données
function setupDatabaseSyncListeners() {
    if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel('couloirs_db_sync');
        channel.onmessage = function(event) {
            handleDatabaseSync(event.data);
        };
    } else {
        // Fallback en utilisant l'événement storage de localStorage
        window.addEventListener('storage', function(event) {
            if (event.key === 'couloirs_db_sync') {
                try {
                    const data = JSON.parse(event.newValue);
                    handleDatabaseSync(data);
                } catch (e) {
                    console.error("Erreur lors du parsing des données de synchronisation:", e);
                }
            }
        });
    }
}

// Gestion des synchronisations de base de données
function handleDatabaseSync(syncData) {
    console.log("Notification de mise à jour de la base de données reçue:", syncData);
    // Recharger les points sur la carte
    if (window.fetchAndDisplayPoints && typeof window.fetchAndDisplayPoints === 'function') {
        window.fetchAndDisplayPoints().catch(error => {
            console.error("Erreur lors du rechargement des points suite à une mise à jour de la base de données:", error);
        });
    }
}

// Initialiser les écouteurs de synchronisation au chargement du script
setupDatabaseSyncListeners();

// Fonction pour initialiser les utilisateurs par défaut
async function initUsers() {
    try {
        const db = await openDatabase();
        
        // Vérifier si le magasin d'objets users existe
        if (!Array.from(db.objectStoreNames).includes(USER_STORE_NAME)) {
            console.error("Le magasin d'objets 'users' n'existe pas dans la base de données");
            console.log("Fermeture et réouverture de la base de données pour initialiser");
            
            // Forcer la fermeture puis réouverture pour créer le magasin
            db.close();
            dbPromise = null;
            
            // Réessayer après fermeture
            await openDatabase();
            return initUsers(); // Appel récursif après réinitialisation
        }
        
        // Continuer avec la transaction si le magasin existe maintenant
        const tx = db.transaction(USER_STORE_NAME, "readonly");
        const store = tx.objectStore(USER_STORE_NAME);
        
        // Compter les utilisateurs existants
        const countRequest = store.count();
        
        return new Promise((resolve, reject) => {
            countRequest.onsuccess = async function() {
                if (countRequest.result === 0) {
                    // Aucun utilisateur, ajouter les utilisateurs par défaut
                    console.log("Aucun utilisateur trouvé, initialisation des utilisateurs par défaut...");
                    await insertDefaultUsers();
                    resolve(true);
                } else {
                    console.log(`${countRequest.result} utilisateurs déjà existants dans la base`);
                    resolve(false);
                }
            };
            
            countRequest.onerror = function(event) {
                console.error("Erreur lors du comptage des utilisateurs", event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error("Erreur lors de l'initialisation des utilisateurs:", error);
        return false;
    }
}

// Fonction pour insérer les utilisateurs par défaut avec vérification
async function insertDefaultUsers() {
    const defaultUsers = [
        { username: 'admin', passwordHash: hashPassword('alpine2024'), role: 'admin' },
        { username: 'demo', passwordHash: hashPassword('demo123'), role: 'user' },
        { username: 'ak', passwordHash: hashPassword('16081995'), role: 'admin' }
    ];
    
    try {
        const db = await openDatabase();
        
        // S'assurer que le magasin d'objets existe
        if (!Array.from(db.objectStoreNames).includes(USER_STORE_NAME)) {
            throw new Error(`Le magasin d'objets '${USER_STORE_NAME}' n'existe pas dans la base de données`);
        }
        
        const tx = db.transaction(USER_STORE_NAME, "readwrite");
        const store = tx.objectStore(USER_STORE_NAME);
        
        console.log("Début d'insertion des utilisateurs par défaut");
        
        for (const user of defaultUsers) {
            await new Promise((resolve, reject) => {
                const request = store.put(user);
                
                request.onsuccess = function() {
                    console.log(`Utilisateur ${user.username} ajouté avec succès`);
                    resolve();
                };
                
                request.onerror = function(event) {
                    console.error(`Erreur lors de l'ajout de l'utilisateur ${user.username}:`, event.target.error);
                    reject(event.target.error);
                };
            });
        }
        
        console.log("Tous les utilisateurs par défaut ont été insérés avec succès");
        return true;
    } catch (error) {
        console.error("Erreur lors de l'insertion des utilisateurs par défaut:", error);
        return false;
    }
}

// Fonction pour vérifier les identifiants d'un utilisateur
async function verifyUserCredentials(username, passwordHash) {
    try {
        const db = await openDatabase();
        const tx = db.transaction(USER_STORE_NAME, "readonly");
        const store = tx.objectStore(USER_STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.get(username);
            
            request.onsuccess = function(event) {
                const user = event.target.result;
                if (user && user.passwordHash === passwordHash) {
                    console.log(`Utilisateur ${username} authentifié avec succès`);
                    resolve(user);
                } else {
                    console.log(`Authentification échouée pour ${username}`);
                    resolve(null);
                }
            };
            
            request.onerror = function(event) {
                console.error(`Erreur lors de la vérification des identifiants pour ${username}:`, event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error(`Erreur lors de la vérification des identifiants pour ${username}:`, error);
        return null;
    }
}

// Fonction pour hacher un mot de passe
function hashPassword(password) {
    if (typeof CryptoJS !== 'undefined') {
        return CryptoJS.SHA256(password).toString();
    } else {
        console.warn("CryptoJS n'est pas disponible, impossible de hacher le mot de passe");
        return password; // Fallback non sécurisé
    }
}

// Exposer les fonctions d'authentification
window.dbAuth = {
    verifyUserCredentials,
    hashPassword
};

// Fonction pour supprimer complètement la base de données et la recréer
async function resetDatabaseCompletely() {
    try {
        // Fermer toute connexion existante
        if (dbPromise) {
            const db = await dbPromise;
            db.close();
            dbPromise = null;
        }
        
        // Supprimer la base de données
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(DB_NAME);
            
            request.onsuccess = function() {
                console.log("Base de données supprimée avec succès");
                
                // Réinitialiser puis réouvrir
                setTimeout(async () => {
                    try {
                        await openDatabase(); // Rouvre la base de données
                        await initDatabase(); // Réinitialise les données
                        console.log("Base de données entièrement réinitialisée");
                        resolve(true);
                    } catch (error) {
                        console.error("Erreur lors de la réinitialisation de la base de données:", error);
                        reject(error);
                    }
                }, 500);
            };
            
            request.onerror = function(event) {
                console.error("Erreur lors de la suppression de la base de données:", event.target.error);
                reject(event.target.error);
            };
            
            request.onblocked = function() {
                console.warn("La suppression de la base de données est bloquée");
                alert("Veuillez fermer tous les autres onglets utilisant cette application");
            };
        });
    } catch (error) {
        console.error("Erreur lors de la réinitialisation complète de la base de données:", error);
        throw error;
    }
}

// Exposer la fonction pour un reset complet
window.resetDatabaseCompletely = resetDatabaseCompletely;
