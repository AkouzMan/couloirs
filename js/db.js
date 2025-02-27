// Constants for database
const DB_NAME = "couloirsDB";
const DB_VERSION = 1;
const STORE_NAME = "couloirs";

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
        
        // Open database
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        // Handle database upgrade (called if the database doesn't exist or version changes)
        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            
            // Create object store with auto-incrementing key
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                
                // Create indexes for commonly queried fields
                store.createIndex('nom', 'nom', { unique: false });
                store.createIndex('user', 'user', { unique: false });
                store.createIndex('exposition', 'exposition', { unique: false });
                
                console.log("Structure de la base de données créée");
            }
        };
        
        // Success handler
        request.onsuccess = function(event) {
            const db = event.target.result;
            console.log("Base de données ouverte avec succès");
            resolve(db);
        };
        
        // Error handler
        request.onerror = function(event) {
            console.error("Erreur lors de l'ouverture de la base de données", event.target.error);
            reject(event.target.error);
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
        } else {
            console.log("Base de données déjà initialisée");
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
                console.log("Couloir ajouté avec succès, ID:", event.target.result);
                resolve(event.target.result);
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
        { nom: "Couloir E du Portalet", latitude: 46.007, longitude: 7.042, exposition: "E", altitude_max: 3344, altitude_min: 2344, pente: 43, cotation_ski: "4.3", exposition_ski: "E2", commentaire: "", lien: "https://www.camptocamp.org/routes/160967/fr/le-portalet-couloir-e", user: "AK" },
        { nom: "Couloir de Bel Oiseau", latitude: 46.062, longitude: 6.929, exposition: "NE", altitude_max: 2525, altitude_min: 1725, pente: 43, cotation_ski: "4.3", exposition_ski: "E2", commentaire: "", lien: "https://www.camptocamp.org/routes/115525/fr/bel-oiseau-couloir-ene", user: "MJ" },
        { nom: "L'aile et la rampe de la colombe", latitude: 46.168, longitude: 6.749, exposition: "NE", altitude_max: 2406, altitude_min: 1806, pente: 42, cotation_ski: "4.2", exposition_ski: "E2", commentaire: "", lien: "https://www.camptocamp.org/routes/732886/fr/tete-de-bossetan-bostan-l-aile-de-la-colombe", user: "MJ" },
        { nom: "Rampe des chamois", latitude: 46.168, longitude: 6.746, exposition: "N", altitude_max: 2406, altitude_min: 1706, pente: 43, cotation_ski: "4.3", exposition_ski: "E3", commentaire: "", lien: "https://www.camptocamp.org/routes/732887/fr/tete-de-bossetan-bostan-rampe-des-chamois", user: "AK" },
        { nom: "Couloirs du Bürglen", latitude: 46.875, longitude: 8.628, exposition: "S", altitude_max: 2165, altitude_min: 1665, pente: 41, cotation_ski: "4.1", exposition_ski: "E1", commentaire: "", lien: "https://www.camptocamp.org/routes/47398/fr/burglen-couloirs-ne", user: "MJ" },
        { nom: "Couloir de la Table (Aiguille du Tour)", latitude: 45.983, longitude: 7.005, exposition: "S", altitude_max: 3540, altitude_min: 2940, pente: 43, cotation_ski: "4.3", exposition_ski: "E2", commentaire: "", lien: "https://www.camptocamp.org/routes/46737/fr/aiguille-du-tour-couloir-de-la-table", user: "AK" }
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
