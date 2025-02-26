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
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM chargé - initialisation des modules");
    
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
