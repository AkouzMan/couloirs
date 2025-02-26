// Variables globales
var map;
var regions = []; // Variable globale pour stocker les régions (polygones de danger)
var markersLayer; // Couche pour stocker tous les marqueurs
var currentPopup = null; // Pour suivre le popup actuellement ouvert
var currentRegion = null; // Pour suivre la région actuellement sélectionnée

document.addEventListener('DOMContentLoaded', function() {
    // Initialiser la carte
    map = L.map('map').setView([46.8182, 8.2275], 8);
    window.map = map; // Rendre la carte accessible globalement
    
    L.tileLayer('https://wmts20.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg', {
        maxZoom: 19,
        attribution: '© <a href="https://www.swisstopo.admin.ch/">swisstopo</a>'
    }).addTo(map);
    
    // Initialiser la couche de marqueurs (vide pour l'instant)
    markersLayer = L.layerGroup();
    window.markersLayer = markersLayer;
    
    // Initialiser les couches qui nécessitent une authentification
    window.authLayers = [];
    
    // Charger les données du bulletin d'avalanche (accessible sans authentification)
    fetchAvalancheData().then(() => {
        console.log("Données avalanche chargées.");
        
        // Signaler que la carte est initialisée
        window.appState = window.appState || {};
        window.appState.mapInitialized = true;
        document.dispatchEvent(new Event('mapInitialized'));
        
        // Charger les données CSV (qui nécessitent une authentification)
        fetchAndDisplayCSV().then(() => {
            console.log("Données CSV chargées et affichées !");
            
            // Vérifier l'état d'authentification pour mettre à jour l'affichage
            if (window.authModule && typeof window.authModule.isAuthenticated === 'function') {
                updateMapFeatures(window.authModule.isAuthenticated());
            }
        }).catch((error) => {
            console.error("Erreur lors du chargement du CSV :", error);
        });
    }).catch((error) => {
        console.error("Erreur lors du chargement des données d'avalanche :", error);
    });
});

// Fonction pour récupérer les données d'avalanche
async function fetchAvalancheData() {
    const url = `https://aws.slf.ch/api/bulletin/caaml/fr/geojson`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Erreur lors de la récupération des données');

        const data = await response.json();
        
        // Mettre à jour la date du bulletin
        updateBulletinInfo(data);

        data.features.forEach(feature => {
            const properties = feature.properties;
            const geometry = feature.geometry;
            const avalancheProblems = properties.avalancheProblems[0];
            const dangerRating = properties.dangerRatings[0];

            // Danger information
            const dangerLevel = dangerRating.mainValue;
            const dangerSub = dangerRating.customData.CH.subdivision || '';

            // Avalanche problem and situation
            const aspects = avalancheProblems?.aspects?.join(', ') || 'Non spécifié';
            const upperLimit = avalancheProblems?.elevation?.lowerBound || 'Non spécifié';
            const lowerLimit = avalancheProblems?.elevation?.upperBound || 'Non spécifié';
            const altitude = `<b>Au dessus de :</b> ${upperLimit} <br><b>En dessous de :</b> ${lowerLimit}`;
            const problemeTyp = avalancheProblems?.comment || 'Non spécifié';
            const situation = properties.snowpackStructure?.comment || '-';
            const tendence = properties.tendency?.[0]?.comment || '-';
            const meteo = properties.weatherForecast?.comment || '-';

            // Fill color
            const fillColor = properties.fill || '#FFFFFF';

            // Create the region (GeoJSON feature)
            let region = L.geoJSON(geometry, {
                style: {
                    fillColor: fillColor,
                    fillOpacity: 0.4,
                    color: 'black',
                    weight: 2,
                }
            });

            // Add region data to the 'regions' array
            regions.push({
                geometry, dangerLevel, fillColor, aspects, upperLimit, lowerLimit, altitude,
                problemeTyp, tendence, meteo, dangerSub, situation, region // Stocker l'objet region
            });

            // Region click event to display detailed data
            region.on('click', function (event) {
                // Fermer tout popup existant
                if (currentPopup) {
                    map.closePopup(currentPopup);
                }
                
                // Réinitialiser l'opacité de la région précédente si elle existe
                if (currentRegion && currentRegion !== region) {
                    currentRegion.setStyle({
                        fillOpacity: 0.4  // Remettre l'opacité initiale
                    });
                }
                
                // Créer et ouvrir le nouveau popup
                let popupContent = `
                    <div style="border: 3px solid ${fillColor}; padding: 10px; border-radius: 6px;">
                        <b>Niveau de danger :</b> ${getNumDangerLevel(dangerLevel)}${getSubDangerLevel(dangerSub)}<br>
                        <b>Aux expositions :</b> ${aspects}<br>
                        <b>Au dessus de :</b> ${upperLimit}<br>
                        <b>En dessous de :</b> ${lowerLimit}<br>
                    </div>
                `;
                
                currentPopup = L.popup()
                    .setLatLng(event.latlng)
                    .setContent(popupContent)
                    .openOn(map);
                
                // Mémoriser la région actuelle
                currentRegion = region;

                // Augmenter l'opacité de la région sélectionnée
                region.setStyle({
                    fillOpacity: 0.75  // Opacité plus élevée pour la région sélectionnée
                });

                // Mettre à jour le panneau gauche et s'assurer que le panneau droit est fermé
                hideRightPanel();
                updateLeftPanel({
                    title: 'Bulletin',
                    fillColor,
                    dangerLevel,
                    dangerSub,
                    aspects,
                    altitude,
                    problemeTyp,
                    situation,
                    tendence,
                    meteo
                });
                
                // Empêcher la propagation du clic pour éviter de déclencher le clic sur la carte
                L.DomEvent.stopPropagation(event);
            });

            // Add region to the map
            region.addTo(map);
        });
    } catch (error) {
        console.error('Erreur:', error);
        throw error;
    }
}

// Fonction pour mettre à jour la date du bulletin
function updateBulletinInfo(data) {
    if (data && data.validTime) {
        const validFrom = new Date(data.validTime.startTime);
        const validTo = new Date(data.validTime.endTime);
        
        document.getElementById('bulletinValidity').textContent = 
            `${validFrom.toLocaleDateString('fr-FR')} au ${validTo.toLocaleDateString('fr-FR')}`;
        
        // Calculer la prochaine émission
        const nextEmission = new Date(validTo);
        nextEmission.setDate(nextEmission.getDate() + 1);
        
        document.getElementById('nextEmission').textContent = 
            `${nextEmission.toLocaleDateString('fr-FR')}`;
    }
}

// Fonction pour mettre à jour le panneau gauche
function updateLeftPanel({ title, fillColor, dangerLevel, dangerSub, aspects, altitude,
    problemeTyp, situation, tendence, meteo }) {
    const infoPanelLeft = document.getElementById('infoPanelLeft');
    if (!infoPanelLeft) return;
    
    document.getElementById('panelLeftTitre').textContent = title;
    document.getElementById('panelLeftTitre').style.backgroundColor = fillColor;
    document.getElementById('panelDanger').textContent = getNumDangerLevel(dangerLevel) + getSubDangerLevel(dangerSub);
    document.getElementById('panelExpositions').textContent = aspects;
    document.getElementById('panelAltitude').innerHTML = altitude;
    document.getElementById('panelproblemTyp').innerHTML = problemeTyp;
    document.getElementById('panelSituation').innerHTML = situation;
    document.getElementById('panelComment').innerHTML = tendence;
    document.getElementById('panelMeteo').innerHTML = meteo;

    // Afficher le panneau avec animation
    infoPanelLeft.style.transition = 'left 0.3s ease-in-out';
    infoPanelLeft.style.left = '0';
    infoPanelLeft.style.borderColor = fillColor;
    
    // Ajuster les autres éléments
    document.getElementById('legend').style.left = '340px';
    document.querySelector('.leaflet-control-zoom').style.left = '340px';
    
    // Signal que le panneau est ouvert
    infoPanelLeft.dataset.isOpen = 'true';
}

// Configurer les panneaux d'information
var infoPanelRight = document.getElementById('infoPanelRight');
var closePanelRight = document.getElementById('closePanelRight');
var closePanelLeft = document.getElementById('closePanelLeft');

// Fonction d'affichage du panneau droit
function showRightPanel(name, lat, lon, pointExposition, altitudeMax, altitudeMin, pente, cotationSki, expositionSki, commentaire, lien, dangerCalc, dangerSub, pointColor) {
    if (!infoPanelRight) return;
    
    const loginBtn = document.getElementById('loginBtn');
    
    // Gestion de l'altitude
    let altitude = altitudeMin === ''
        ? `À ${altitudeMax}m`
        : `De ${altitudeMax}m à ${altitudeMin}m`;

    // Mise à jour du contenu du panneau droit
    document.getElementById('panelRightTitre').textContent = name;
    document.getElementById('panelRightDanger').textContent = `${dangerCalc.danger}${dangerSub}`;
    document.getElementById('panelRightPente').textContent = pente;
    document.getElementById('panelRightExposition').textContent = pointExposition;
    document.getElementById('panelRightCotationSki').textContent = cotationSki;
    document.getElementById('panelRightExpositionSki').textContent = expositionSki;
    document.getElementById('panelRightAltitude').textContent = altitude;
    document.getElementById('panelRightComment').textContent = commentaire;
    document.getElementById('panelRightLien').href = lien;

    // Affichage du panneau avec animation
    infoPanelRight.style.transition = 'right 0.3s ease-in-out';
    infoPanelRight.style.right = '0';
    infoPanelRight.style.borderColor = pointColor;
    document.getElementById('panelRightTitre').style.backgroundColor = pointColor;
    
    // Repositionner le bouton login quand le panneau est ouvert
    if (loginBtn) {
        loginBtn.style.transition = 'right 0.3s ease-in-out';
        loginBtn.style.right = '310px';
    }
    
    // Signal que le panneau est ouvert
    infoPanelRight.dataset.isOpen = 'true';
}

// Fonction pour masquer le panneau droit
function hideRightPanel() {
    if (!infoPanelRight) return;
    
    const loginBtn = document.getElementById('loginBtn');
    
    infoPanelRight.style.transition = 'right 0.3s ease-in-out';
    infoPanelRight.style.right = '-300px';
    
    // Repositionner le bouton login quand le panneau est fermé
    if (loginBtn) {
        loginBtn.style.transition = 'right 0.3s ease-in-out';
        loginBtn.style.right = '10px';
    }
    
    // Signal que le panneau est fermé
    infoPanelRight.dataset.isOpen = 'false';
}

// Fonction pour masquer le panneau gauche
function hideLeftPanel() {
    const infoPanelLeft = document.getElementById('infoPanelLeft');
    const legend = document.getElementById('legend');
    const zoomControl = document.querySelector('.leaflet-control-zoom');

    if (!infoPanelLeft) return;

    // Utilisation de transitions CSS pour rendre le mouvement plus fluide
    infoPanelLeft.style.transition = 'left 0.3s ease-in-out';
    infoPanelLeft.style.left = '-300px';

    if (legend) {
        legend.style.transition = 'left 0.3s ease-in-out';
        legend.style.left = '40px';
    }

    if (zoomControl) {
        zoomControl.style.transition = 'left 0.3s ease-in-out';
        zoomControl.style.left = '40px';
    }
    
    // Signal que le panneau est fermé
    infoPanelLeft.dataset.isOpen = 'false';
}

// Fonction pour fermer tous les panneaux et popups
function closeAllPanelsAndPopups() {
    console.log("closeAllPanelsAndPopups appelé");
    
    // Fermer les popups
    if (map) {
        map.closePopup();
    }
    
    if (currentPopup) {
        currentPopup = null;
    }
    
    // Masquer les panneaux
    hideLeftPanel();
    hideRightPanel();
    
    // Réinitialiser l'opacité de la région actuelle si elle existe
    if (currentRegion) {
        currentRegion.setStyle({
            fillOpacity: 0.4  // Remettre l'opacité initiale
        });
        currentRegion = null;
    }
}

// Événements pour fermer les panneaux
if (closePanelRight) {
    closePanelRight.addEventListener('click', function(e) {
        e.stopPropagation();
        hideRightPanel();
    });
}

if (closePanelLeft) {
    closePanelLeft.addEventListener('click', function(e) {
        e.stopPropagation();
        hideLeftPanel();
    });
}

// Remplacer complètement la gestion des clics sur la carte par ce qui suit :

// Fonction pour vérifier si un élément est interactif
function isInteractiveElement(element) {
    if (!element) return false;
    
    // Vérifier si l'élément ou un de ses parents est interactif
    if (element.closest('.leaflet-interactive') || 
        element.closest('.leaflet-popup') || 
        element.closest('.leaflet-popup-content-wrapper')) {
        return true;
    }
    
    return false;
}

// Gestionnaire de clics sur la carte
if (map) {
    // Supprimer tous les gestionnaires d'événements existants
    map.off('click');
    
    // Ajouter un gestionnaire d'événements directement sur l'élément DOM de la carte
    const mapContainer = map.getContainer();
    
    // Supprimer d'abord tout gestionnaire d'événement existant pour éviter les doublons
    mapContainer.removeEventListener('click', mapClickHandler);
    
    function mapClickHandler(e) {
        // Ne pas traiter les clics sur les éléments interactifs
        if (e.target.classList && (
            e.target.classList.contains('leaflet-interactive') ||
            e.target.closest('.leaflet-interactive') ||
            e.target.closest('.leaflet-popup-content-wrapper') ||
            e.target.closest('.leaflet-popup')
        )) {
            console.log("Clic sur élément interactif, ignoré");
            return;
        }
        
        // Si le clic est sur le fond de carte, fermer les panneaux
        console.log("Clic sur le fond de carte détecté, fermeture des panneaux");
        closeAllPanelsAndPopups();
    }
    
    mapContainer.addEventListener('click', mapClickHandler);
    
    // Garder aussi le gestionnaire standard pour être sûr
    map.on('click', function(e) {
        // Vérifier si le clic n'est pas sur un élément interactif
        if (!e.originalEvent.target.closest('.leaflet-interactive') &&
            !e.originalEvent.target.closest('.leaflet-popup')) {
            console.log("Leaflet map click detected, closing panels");
            closeAllPanelsAndPopups();
        }
    });
}

// Assurer que closeAllPanelsAndPopups() fonctionne correctement
function closeAllPanelsAndPopups() {
    console.log("closeAllPanelsAndPopups appelé");
    
    // Fermer les popups
    if (map) {
        map.closePopup();
    }
    
    if (currentPopup) {
        currentPopup = null;
    }
    
    // Masquer les panneaux
    hideLeftPanel();
    hideRightPanel();
    
    // Réinitialiser l'opacité de la région actuelle si elle existe
    if (currentRegion) {
        currentRegion.setStyle({
            fillOpacity: 0.4  // Remettre l'opacité initiale
        });
        currentRegion = null;
    }
}

// Remplacer ou modifier le gestionnaire d'événements pour les clics sur le document

// Conserver l'écouteur sur le body pour les clics en dehors des éléments spécifiques
document.body.addEventListener('click', function(e) {
    // Si le clic est sur la carte (e.target.closest('#map') est vrai) mais pas sur un élément interactif,
    // alors fermer les panneaux
    if (e.target.closest('#map') && !isInteractiveElement(e.target)) {
        console.log("Clic sur la carte détecté (dans le gestionnaire body), fermeture des panneaux");
        closeAllPanelsAndPopups();
    }
    
    // Si le clic est en dehors de la carte et des panneaux, fermer les panneaux également
    if (!e.target.closest('#map') && 
        !e.target.closest('#infoPanelLeft') && 
        !e.target.closest('#infoPanelRight') &&
        !e.target.closest('.modal') &&
        !e.target.closest('#loginBtn')) {
        console.log("Clic en dehors de la carte et des panneaux détecté, fermeture des panneaux");
        closeAllPanelsAndPopups();
    }
});

// Fonction pour mettre à jour les fonctionnalités de la carte en fonction de l'état d'authentification
function updateMapFeatures(isAuthenticated) {
    console.log("updateMapFeatures appelé avec isAuthenticated =", isAuthenticated);
    
    // Masquer/afficher les points sur la carte
    if (window.markersLayer) {
        if (isAuthenticated) {
            window.map.addLayer(window.markersLayer);
        } else {
            window.map.removeLayer(window.markersLayer);
        }
    }
    
    // Mettre à jour l'affichage des éléments réservés aux utilisateurs authentifiés
    document.querySelectorAll('.auth-required').forEach(el => {
        el.style.display = isAuthenticated ? 'block' : 'none';
    });
    
    // Masquer le panneau droit si l'utilisateur se déconnecte
    if (!isAuthenticated && infoPanelRight) {
        hideRightPanel();
    }
}

// Fonction pour mettre à jour la visibilité des couches de carte basée sur l'authentification
window.updateMapLayersVisibility = function(isAuthenticated) {
    console.log("updateMapLayersVisibility appelé avec isAuthenticated =", isAuthenticated);
    updateMapFeatures(isAuthenticated);
};

// Écouter les changements d'état d'authentification
document.addEventListener('authStateChanged', function(event) {
    const isAuthenticated = event.detail.isAuthenticated;
    updateMapFeatures(isAuthenticated);
});

// Fonction pour lire le CSV
async function loadCSV() {
    try {
        const results = await new Promise((resolve, reject) => {
            Papa.parse('couloirs.csv', {
                download: true,
                header: true,
                dynamicTyping: true,
                complete: resolve,
                error: reject
            });
        });
        
        return results;
    } catch (error) {
        console.error("Erreur lors de la lecture du fichier CSV:", error);
        throw error;
    }
}

// Fonction pour charger et afficher les points du CSV
async function fetchAndDisplayCSV() {
    try {
        const results = await loadCSV();
        const rows = results.data;
        
        // Créer une nouvelle couche pour les marqueurs
        if (!window.markersLayer) {
            window.markersLayer = L.layerGroup();
        }
        
        // Vider la couche existante
        window.markersLayer.clearLayers();
        
        // Ajouter les points à la couche
        rows.forEach(row => {
            if (!row.latitude || !row.longitude) return;

            const {
                name = '',
                pente = '',
                cotation_ski: cotationSki = '',
                exposition_ski: expositionSki = '',
                commentaire = '',
                lien = '',
            } = row;

            const lat = parseFloat(row.latitude);
            const lon = parseFloat(row.longitude);
            const altitudeMax = parseInt(row.altitude_max, 10) || '';
            const altitudeMin = parseInt(row.altitude_min, 10) || '';
            const pointExposition = row.exposition?.trim() || '';

            let dangerCalc = {
                danger: "NaN",
                commentaire: "Hors bulletin"
            };
            let dangerSub = '';
            let regionNumber = 'Hors bulletin';

            if (!isNaN(lat) && !isNaN(lon)) {
                let point = { lat, lon, pointExposition, altitudeMax, altitudeMin, pente };
                
                regionNumber = findRegionForPoint(point, regions);
                
                if (regionNumber !== 'Hors bulletin' && !isNaN(regionNumber)) {
                    dangerCalc = getDangerForPoint(point, regions, regionNumber - 1);
                    dangerSub = getSubDangerLevel(regions[regionNumber-1]?.dangerSub || '');
                }

                let pointColor = getDangerColor(dangerCalc.danger);

                // Ajout du marqueur sur la carte
                let marker = L.circleMarker([lat, lon], {
                    radius: 6,
                    fillColor: pointColor,
                    color: "black",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 1
                }).on('click', function(e) {
                    // Empêcher la propagation du clic pour éviter de déclencher le gestionnaire de clic sur la carte
                    L.DomEvent.stopPropagation(e);
                    
                    // Afficher le panneau droit avec les informations du point
                    showRightPanel(name, lat, lon, pointExposition, altitudeMax, altitudeMin, 
                                   pente, cotationSki, expositionSki, commentaire, lien,
                                   dangerCalc, dangerSub, pointColor);
                    
                    // Gérer l'affichage des informations de la région
                    if (regionNumber !== 'Hors bulletin' && !isNaN(regionNumber)) {
                        // Point dans une région: afficher le panneau gauche et le popup de la région
                        let regionData = regions[regionNumber - 1];
                        
                        // Réinitialiser l'opacité de la région précédente si elle existe
                        if (currentRegion && currentRegion !== regionData.region) {
                            currentRegion.setStyle({
                                fillOpacity: 0.4  // Remettre l'opacité initiale
                            });
                        }
                        
                        // Mise à jour du panneau gauche
                        updateLeftPanel({
                            title: 'Bulletin pour : ' + name,
                            fillColor: regionData.fillColor,
                            dangerLevel: regionData.dangerLevel,
                            dangerSub: regionData.dangerSub,
                            aspects: regionData.aspects,
                            altitude: regionData.altitude,
                            problemeTyp: regionData.problemeTyp,
                            situation: regionData.situation,
                            tendence: regionData.tendence,
                            meteo: regionData.meteo
                        });
                        
                        // Fermer tout popup existant
                        if (currentPopup) {
                            map.closePopup(currentPopup);
                        }
                        
                        // Créer et afficher un popup pour la région contenant ce point
                        const regionBounds = L.geoJSON(regionData.geometry).getBounds();
                        const regionCenter = regionBounds.getCenter();
                        
                        let popupContent = `
                            <div style="border: 3px solid ${regionData.fillColor}; padding: 10px; border-radius: 6px;">
                                <b>Niveau de danger :</b> ${getNumDangerLevel(regionData.dangerLevel)}${getSubDangerLevel(regionData.dangerSub)}<br>
                                <b>Aux expositions :</b> ${regionData.aspects}<br>
                                <b>Au dessus de :</b> ${regionData.upperLimit}<br>
                                <b>En dessous de :</b> ${regionData.lowerLimit}<br>
                                <b>Point :</b> ${name}
                            </div>
                        `;
                        
                        currentPopup = L.popup()
                            .setLatLng(regionCenter)
                            .setContent(popupContent)
                            .openOn(map);
                            
                        currentRegion = regionData.region;
                            
                        // Augmenter l'opacité de la région sélectionnée
                        currentRegion.setStyle({
                            fillOpacity: 0.75  // Opacité plus élevée pour la région sélectionnée
                        });
                    } else {
                        // Point hors région: fermer le panneau gauche
                        hideLeftPanel();
                        
                        // Fermer tout popup existant
                        if (currentPopup) {
                            map.closePopup(currentPopup);
                        }
                    }
                })
                .bindPopup(`
                    <div style="border: 2px solid ${pointColor}; border-radius: 8px;">
                        <div style="background-color: ${pointColor}; padding: 5px; border-radius: 5px 5px 0 0;">
                            <b style="font-size: 1.2em; color: #404040;">${name}</b>
                        </div>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr style="border-bottom: 1px solid lightgray;">
                                <td style="font-weight: bold; text-align: left; white-space: nowrap; padding: 5px;">Danger calculé :</td>
                                <td style="text-align: left; padding: 5px;">${dangerCalc.danger}${dangerSub}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid lightgray;">
                                <td style="font-weight: bold; text-align: left; white-space: nowrap; padding: 5px;">Commentaire :</td>
                                <td style="text-align: left; padding: 5px;">${dangerCalc.commentaire}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid lightgray;">
                                <td style="font-weight: bold; text-align: left; white-space: nowrap; padding: 5px;">Exposition :</td>
                                <td style="text-align: left; padding: 5px;">${pointExposition}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid lightgray;">
                                <td style="font-weight: bold; text-align: left; white-space: nowrap; padding: 5px;">Pente :</td>
                                <td style="text-align: left; padding: 5px;">${pente}</td>
                            </tr>
                            <tr>
                                <td style="font-weight: bold; text-align: left; white-space: nowrap; padding: 5px;">Altitude :</td>
                                <td style="text-align: left; padding: 5px;">${altitudeMax}m à ${altitudeMin}m</td>
                            </tr>
                        </table>
                    </div>
                `);
                
                // Ajouter le marqueur à la couche de marqueurs
                window.markersLayer.addLayer(marker);
            }
        });
        
        // Ajouter la couche à authLayers pour qu'elle soit gérée par l'authentification
        if (window.authLayers && !window.authLayers.includes(window.markersLayer)) {
            window.authLayers.push(window.markersLayer);
        }
        
        // Vérifier si l'utilisateur est authentifié pour afficher ou masquer les marqueurs
        if (window.authModule && typeof window.authModule.isAuthenticated === 'function') {
            const isAuthenticated = window.authModule.isAuthenticated();
            if (isAuthenticated) {
                window.map.addLayer(window.markersLayer);
            }
        }
        
        return rows;
    } catch (error) {
        console.error("Erreur lors du chargement et de l'affichage du CSV :", error);
        throw error;
    }
}

// Fonction pour fermer tous les éléments avec la touche ESC
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeAllPanelsAndPopups();
    }
});

/* ...existing code... */

// Gestionnaire pour le panneau droit
document.addEventListener('DOMContentLoaded', function() {
    const infoPanelRight = document.getElementById('infoPanelRight');
    const closePanelRight = document.getElementById('closePanelRight');
    const loginBtn = document.getElementById('loginBtn');
    
    // Fonction pour ouvrir le panneau droit
    function openRightPanel() {
        infoPanelRight.style.right = '0';
        
        // Repositionner le bouton login quand le panneau est ouvert
        if (loginBtn) {
            loginBtn.style.transition = 'right 0.3s ease-in-out';
            loginBtn.style.right = '310px';
        }
        
        // Signal que le panneau est ouvert
        infoPanelRight.dataset.isOpen = 'true';
    }
    
    // Fonction pour fermer le panneau droit
    function closeRightPanel() {
        infoPanelRight.style.right = '-300px';
        
        // Repositionner le bouton login quand le panneau est fermé
        if (loginBtn) {
            loginBtn.style.transition = 'right 0.3s ease-in-out';
            loginBtn.style.right = '10px';
        }
        
        // Signal que le panneau est fermé
        infoPanelRight.dataset.isOpen = 'false';
    }
    
    // Écouteur d'événement pour le bouton de fermeture du panneau
    closePanelRight.addEventListener('click', closeRightPanel);
    
    // Initialiser la position du bouton login
    if (loginBtn && infoPanelRight) {
        loginBtn.style.transition = 'right 0.3s ease-in-out';
        loginBtn.style.right = infoPanelRight.dataset.isOpen === 'true' ? '310px' : '10px';
    }
    
    // ...existing code...
});

/* ...existing code... */