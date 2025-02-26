
// Ajoutez cette modification au début de votre fichier node.js existant

// Déclarer une variable globale pour la couche de marqueurs
window.markersLayer = null;

// Modification de la fonction d'initialisation des points (à adapter selon votre code existant)
function initializePoints(data) {
    // Créer une couche pour les marqueurs
    window.markersLayer = L.layerGroup();
    
    // Ajouter vos points à cette couche...
    // ...
    
    // Vérifier l'état d'authentification
    const isAuthenticated = localStorage.getItem('authToken') !== null;
    
    // Ajouter la couche à la carte seulement si l'utilisateur est authentifié
    if (isAuthenticated) {
        window.markersLayer.addTo(map);
    }
    
    // Le reste de votre code d'initialisation...
}

// Le reste de votre code existant...