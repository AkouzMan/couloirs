/**
 * Script d'initialisation pour assurer le chargement correct et l'interaction entre les modules
 */

console.log("Script d'initialisation chargé");

// Initialiser l'état global de l'application
window.appState = {
    mapInitialized: false,
    authInitialized: false
};

// Détecter quand la page est complètement chargée
document.addEventListener('DOMContentLoaded', async function() {
    console.log("DOM chargé - initialisation des modules");
    
    // S'assurer que tous les scripts sont chargés avant d'initialiser l'application
    try {
        // Initialiser l'application
        await initApplication();
    } catch (error) {
        console.error("Erreur lors de l'initialisation de l'application:", error);
    }
    
    // Fonction pour synchroniser les modules
    function synchronizeModules() {
        console.log("Synchronisation des modules - Map:", window.appState.mapInitialized, 
                    "Auth:", window.appState.authInitialized);
        
        if (window.appState.mapInitialized && window.appState.authInitialized) {
            console.log('Tous les modules sont chargés, synchronisation...');
            
            // Si l'authentification est initialisée et que nous connaissons son état
            if (window.authModule && typeof window.authModule.isAuthenticated === 'function') {
                const isAuthenticated = window.authModule.isAuthenticated();
                console.log("État d'authentification détecté:", isAuthenticated);
                
                // Si la carte est prête, mettre à jour la visibilité des couches
                if (window.map && window.updateMapLayersVisibility) {
                    console.log("Mise à jour des couches de la carte");
                    window.updateMapLayersVisibility(isAuthenticated);
                } else {
                    console.warn("La carte ou la fonction updateMapLayersVisibility n'est pas disponible");
                }
            } else {
                console.warn("Le module d'authentification n'est pas correctement initialisé");
            }
        }
    }

    // Écouter les événements des différents modules
    document.addEventListener('mapInitialized', function() {
        window.appState.mapInitialized = true;
        synchronizeModules();
    });

    document.addEventListener('authInitialized', function() {
        window.appState.authInitialized = true;
        synchronizeModules();
    });

    // En cas de problème, réessayer après un délai
    setTimeout(function() {
        if (!window.appState.mapInitialized || !window.appState.authInitialized) {
            console.warn('Certains modules ne se sont pas initialisés correctement. Tentative de synchronisation forcée...');
            synchronizeModules();
        }
    }, 2000);
});

// Émettre un événement lorsque ce script est chargé
document.dispatchEvent(new Event('initScriptLoaded'));

async function initApplication() {
    console.log("Initialisation de l'application...");
    
    // On initialise d'abord l'authentification
    if (typeof window.authModule !== 'undefined' && typeof window.authModule.checkAuthStatus === 'function') {
        console.log("Initialisation de l'authentification...");
        window.authModule.checkAuthStatus();
    } else {
        console.warn("Le module d'authentification n'est pas disponible");
    }
    
    // Ensuite on vérifie si la carte est initialisée avant de continuer
    if (!window.map) {
        console.log("Initialisation de la carte...");
        if (typeof window.initMap === 'function') {
            window.initMap();
        } else {
            console.warn("La fonction initMap n'est pas disponible");
        }
    } else {
        console.log("La carte est déjà initialisée");
    }
    
    // Enfin on charge les données si nécessaire
    if (typeof window.loadData === 'function') {
        console.log("Chargement des données...");
        // On attend un peu pour s'assurer que tout est bien initialisé
        setTimeout(() => {
            window.loadData().catch(error => {
                console.error("Erreur lors du chargement des données:", error);
            });
        }, 500);
    } else {
        console.warn("La fonction loadData n'est pas disponible");
    }
}
