/**
 * Module de chargement des données de test
 */
const DataLoader = (function() {
    // Variable pour stocker les données téléchargées
    let cachedCouloirsData = null;
    let couloirsDataPromise = null;

    /**
     * Charge les données de test des couloirs depuis un fichier JSON
     * @returns {Promise<Array>} - Promesse avec les données des couloirs
     */
    async function loadTestCouloirs() {
        // Si nous avons déjà une promesse en cours, la retourner
        if (couloirsDataPromise) {
            return couloirsDataPromise;
        }
        
        // Si les données sont déjà en cache, les retourner
        if (cachedCouloirsData) {
            return Promise.resolve(cachedCouloirsData);
        }
        
        // Créer une nouvelle promesse pour charger les données
        couloirsDataPromise = new Promise(async (resolve, reject) => {
            try {
                console.log("Chargement des données de test des couloirs depuis le fichier JSON...");
                const response = await fetch('/data/test-couloirs.json');
                
                if (!response.ok) {
                    throw new Error(`Erreur lors du chargement des données: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log(`${data.length} couloirs de test chargés avec succès`);
                
                // Mettre en cache les données
                cachedCouloirsData = data;
                
                resolve(data);
            } catch (error) {
                console.error("Erreur lors du chargement des données de test:", error);
                reject(error);
            } finally {
                // Réinitialiser la promesse pour permettre de réessayer en cas d'échec
                couloirsDataPromise = null;
            }
        });
        
        return couloirsDataPromise;
    }
    
    /**
     * Réinitialise le cache des données 
     */
    function resetCache() {
        cachedCouloirsData = null;
        couloirsDataPromise = null;
        console.log("Cache des données de test réinitialisé");
    }
    
    // API publique du module
    return {
        loadTestCouloirs,
        resetCache
    };
})();

// Exposer le module globalement
window.DataLoader = DataLoader;

/**
 * Met à jour les indicateurs de validité du bulletin d'avalanche
 * @param {string} validityText - Le texte à afficher pour la validité
 * @param {string} nextEmissionText - Le texte à afficher pour la prochaine émission
 * @param {boolean} isLoading - Indique si les données sont en cours de chargement
 * @param {boolean} isError - Indique s'il y a eu une erreur
 */
function updateBulletinStatus(validityText, nextEmissionText, isLoading = false, isError = false) {
    const validityElement = document.getElementById('bulletinValidity');
    const nextEmissionElement = document.getElementById('nextEmission');
    
    if (!validityElement || !nextEmissionElement) return;
    
    // Appliquer des styles selon l'état
    if (isLoading) {
        validityElement.innerHTML = '<em>Chargement...</em>';
        nextEmissionElement.innerHTML = '<em>Chargement...</em>';
        
        validityElement.style.color = '#666';
        nextEmissionElement.style.color = '#666';
    } else if (isError) {
        validityElement.textContent = validityText || 'Données non disponibles';
        nextEmissionElement.textContent = nextEmissionText || 'Données non disponibles';
        
        validityElement.style.color = '#e74c3c';
        nextEmissionElement.style.color = '#e74c3c';
    } else {
        validityElement.textContent = validityText;
        nextEmissionElement.textContent = nextEmissionText;
        
        validityElement.style.color = '';
        nextEmissionElement.style.color = '';
    }
}

// Lors du chargement initial, indiquer que les données sont en cours de chargement
document.addEventListener('DOMContentLoaded', function() {
    updateBulletinStatus(null, null, true);
});
