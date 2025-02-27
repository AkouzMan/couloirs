// Variables globales
var map;
var regions = []; // Variable globale pour stocker les régions (polygones de danger)
var markersLayer; // Couche pour stocker tous les marqueurs
var currentPopup = null; // Pour suivre le popup actuellement ouvert
var currentRegion = null; // Pour suivre la région actuellement sélectionnée
var mapInitialized = false; // Flag pour suivre si la carte est initialisée
var currentCouloirId = null; // Pour stocker l'ID du couloir actuellement affiché

// Écouter le chargement du DOM, mais avec une vérification d'initialisation
document.addEventListener('DOMContentLoaded', function() {
    // Vérifier si la carte est déjà initialisée
    if (!window.mapInitialized) {
        window.mapInitialized = true;
        initializeApplication();
    }
});

function initializeApplication() {
    console.log("Initialisation de l'application...");
    
    // Initialisation de la carte
    initMap();
    
    // Chargement des données après l'initialisation de la carte
    loadAvailableData();
}

// Initialisation de la carte séparée
function initMap() {
    // Vérification pour éviter la double initialisation
    if (window.map) {
        console.log("La carte est déjà initialisée, aucune action nécessaire");
        return;
    }
    
    console.log("Initialisation de la carte Leaflet");
    try {
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
        
        // Configuration des gestionnaires d'événements
        setupMapEventHandlers();
        
        console.log("Carte initialisée avec succès");
    } catch (error) {
        console.error("Erreur lors de l'initialisation de la carte:", error);
    }
}

// Fonction pour charger les données disponibles
async function loadAvailableData() {
    try {
        // Charger les données du bulletin d'avalanche
        await fetchAvalancheData();
        console.log("Données avalanche chargées");
        
        // Signaler que la carte est initialisée
        window.appState = window.appState || {};
        window.appState.mapInitialized = true;
        document.dispatchEvent(new Event('mapInitialized'));
        
        // Initialiser la base de données et charger les points
        try {
            await initDatabase();
            
            // S'assurer que les écouteurs de synchronisation sont configurés
            if (typeof setupDatabaseSyncListeners === 'function') {
                setupDatabaseSyncListeners();
            }
            
            await fetchAndDisplayPoints();
            console.log("Données de la base de données chargées et affichées");
        } catch (dbError) {
            console.error("Erreur avec la base de données:", dbError);
        }
        
        // Vérifier l'authentification pour l'affichage en utilisant la fonction correcte
        if (window.authModule && typeof window.authModule.isAuthenticated === 'function') {
            updateMapFeatures(window.authModule.isAuthenticated());
        }
    } catch (error) {
        console.error("Erreur lors du chargement des données:", error);
    }
}

// Exposer ces fonctions globalement
window.initMap = initMap;
window.loadData = loadAvailableData;

// Configuration des gestionnaires d'événements de la carte
function setupMapEventHandlers() {
    if (!map) {
        console.warn("Impossible de configurer les gestionnaires d'événements: carte non initialisée");
        return;
    }
    
    console.log("Configuration des gestionnaires d'événements de la carte");
    
    // Supprimer les gestionnaires existants pour éviter les doublons
    map.off('click');
    
    // Ajouter un gestionnaire d'événements directement sur l'élément DOM de la carte
    const mapContainer = map.getContainer();
    
    // Définir la fonction de gestionnaire de clic
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
    
    // Supprimer d'abord tout gestionnaire d'événement existant pour éviter les doublons
    if (mapContainer._clickHandler) {
        mapContainer.removeEventListener('click', mapContainer._clickHandler);
    }
    
    // Stocker la référence au gestionnaire pour pouvoir la supprimer plus tard
    mapContainer._clickHandler = mapClickHandler;
    mapContainer.addEventListener('click', mapClickHandler);
    
    // Ajouter également le gestionnaire standard Leaflet
    map.on('click', function(e) {
        // Vérifier si le clic n'est pas sur un élément interactif
        if (!e.originalEvent.target.closest('.leaflet-interactive') &&
            !e.originalEvent.target.closest('.leaflet-popup')) {
            console.log("Leaflet map click detected, closing panels");
            closeAllPanelsAndPopups();
        }
    });
    
    console.log("Gestionnaires d'événements de la carte configurés");
}

// Fonction pour récupérer les données d'avalanche
async function fetchAvalancheData() {
    const url = `https://aws.slf.ch/api/bulletin/caaml/fr/geojson`;

    try {
        // Vider d'abord les régions existantes pour éviter les doublons
        regions.forEach(region => {
            if (region.region && map.hasLayer(region.region)) {
                map.removeLayer(region.region);
            }
        });
        regions = []; // Réinitialiser le tableau des régions

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

            // Create the region (GeoJSON feature) with specific opacity
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
function showRightPanel(couloirId, name, lat, lon, pointExposition, altitudeMax, altitudeMin, pente, cotationSki, expositionSki, commentaire, lien, dangerCalc, dangerSub, pointColor, user) {
    if (!infoPanelRight) return;
    
    // Stocker l'ID du couloir actuel
    currentCouloirId = couloirId;
    
    const loginBtn = document.getElementById('loginBtn');
    
    // Gestion de l'altitude
    let altitude = altitudeMin === ''
        ? `À ${altitudeMax}m`
        : `De ${altitudeMax}m à ${altitudeMin}m`;

    try {
        // Mise à jour du contenu du panneau droit - avec vérification de l'existence des éléments
        const elementsToUpdate = [
            { id: 'panelRightTitre', value: name },
            { id: 'panelRightDanger', value: `${dangerCalc.danger}${dangerSub}` },
            { id: 'panelRightPente', value: pente },
            { id: 'panelRightExposition', value: pointExposition },
            { id: 'panelRightCotationSki', value: cotationSki },
            { id: 'panelRightExpositionSki', value: expositionSki },
            { id: 'panelRightAltitude', value: altitude },
            { id: 'panelRightComment', value: commentaire },
            { id: 'panelRightAuthor', value: user || 'Inconnu' }
        ];
        
        // Mise à jour sécurisée des éléments textuels
        elementsToUpdate.forEach(item => {
            const element = document.getElementById(item.id);
            if (element) {
                element.textContent = item.value;
            } else {
                console.warn(`Élément ${item.id} non trouvé dans le DOM`);
            }
        });
        
        // Mise à jour spécifique pour le commentaire de danger
        const dangerCommentElement = document.getElementById('panelRightDangerComment');
        if (dangerCommentElement) {
            dangerCommentElement.textContent = dangerCalc.commentaire || '';
        }
        
        // Mise à jour du lien (href au lieu de textContent)
        const lienElement = document.getElementById('panelRightLien');
        if (lienElement) {
            lienElement.href = lien;
        }
        
        // Mise à jour des styles
        if (document.getElementById('panelRightTitre')) {
            document.getElementById('panelRightTitre').style.backgroundColor = pointColor;
        }
        
        // Affichage du panneau avec animation
        infoPanelRight.style.transition = 'right 0.3s ease-in-out';
        infoPanelRight.style.right = '0';
        infoPanelRight.style.borderColor = pointColor;
        
        // Repositionner le bouton login quand le panneau est ouvert
        if (loginBtn) {
            loginBtn.style.transition = 'right 0.3s ease-in-out';
            loginBtn.style.right = '310px';
        }
        
        // Signal que le panneau est ouvert
        infoPanelRight.dataset.isOpen = 'true';
        
        // Stocker les données du couloir actuel pour l'édition
        window.currentCouloirData = {
            id: couloirId,
            nom: name,
            latitude: lat,
            longitude: lon,
            exposition: pointExposition,
            altitude_max: altitudeMax,
            altitude_min: altitudeMin,
            pente: pente,
            cotation_ski: cotationSki,
            exposition_ski: expositionSki,
            commentaire: commentaire,
            lien: lien,
            user: user
        };
    } catch (error) {
        console.error("Erreur lors de l'affichage du panneau droit:", error);
    }
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

// Fonction pour mettre à jour les caractéristiques de la carte en fonction de l'authentification
function updateMapFeatures(isAuthenticated) {
    console.log("Mise à jour des couches de la carte - Authentifié:", isAuthenticated);
    
    if (!window.map) {
        console.warn("La carte n'est pas initialisée, impossible de mettre à jour les caractéristiques");
        return;
    }
    
    // Gérer l'affichage des couches qui nécessitent une authentification
    if (window.authLayers && Array.isArray(window.authLayers)) {
        window.authLayers.forEach(layer => {
            if (isAuthenticated) {
                // Ajouter la couche si l'utilisateur est authentifié et si elle n'est pas déjà présente
                if (!window.map.hasLayer(layer)) {
                    window.map.addLayer(layer);
                    console.log("Couche ajoutée à la carte");
                }
            } else {
                // Retirer la couche si l'utilisateur n'est pas authentifié
                if (window.map.hasLayer(layer)) {
                    window.map.removeLayer(layer);
                    console.log("Couche retirée de la carte");
                }
            }
        });
    }
    
    // Mettre à jour l'interface utilisateur basée sur l'authentification
    document.querySelectorAll('.auth-required').forEach(el => {
        el.style.display = isAuthenticated ? 'block' : 'none';
    });
}

// Exposer la fonction pour qu'elle soit accessible depuis d'autres modules
window.updateMapLayersVisibility = updateMapFeatures;

// Remplacer la fonction fetchAndDisplayCSV par loadCouloirsFromDB
async function fetchAndDisplayPoints() {
    try {
        // Récupérer les couloirs depuis la base de données au lieu du CSV
        const couloirs = await getAllCouloirs();
        
        // Créer une nouvelle couche pour les marqueurs
        if (!window.markersLayer) {
            window.markersLayer = L.layerGroup();
        }
        
        // Vider la couche existante
        window.markersLayer.clearLayers();
        
        // Ajouter les points à la couche
        couloirs.forEach(couloir => {
            if (!couloir.latitude || !couloir.longitude) return;

            const {
                id: couloirId,  // Récupérer l'ID du couloir
                nom: name = '',
                pente = '',
                cotation_ski: cotationSki = '',
                exposition_ski: expositionSki = '',
                commentaire = '',
                lien = '',
                user = 'Inconnu'
            } = couloir;

            const lat = parseFloat(couloir.latitude);
            const lon = parseFloat(couloir.longitude);
            const altitudeMax = parseInt(couloir.altitude_max, 10) || '';
            const altitudeMin = parseInt(couloir.altitude_min, 10) || '';
            const pointExposition = couloir.exposition?.trim() || '';

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
                    showRightPanel(couloirId, name, lat, lon, pointExposition, altitudeMax, altitudeMin, 
                                   pente, cotationSki, expositionSki, commentaire, lien,
                                   dangerCalc, dangerSub, pointColor, user);
                    
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
        
        return couloirs;
    } catch (error) {
        console.error("Erreur lors du chargement et de l'affichage des points :", error);
        throw error;
    }
}

// Fonction pour fermer tous les éléments avec la touche ESC
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeAllPanelsAndPopups();
    }
});

// Gestionnaire pour la suppression d'un couloir
document.addEventListener('DOMContentLoaded', function() {
    const deleteModal = document.getElementById('deleteModal');
    const deleteCouloirBtn = document.getElementById('deleteCouloirBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const closeDeleteModalBtn = deleteModal?.querySelector('.close');
    const deleteForm = document.getElementById('deleteForm');
    const deleteError = document.getElementById('deleteError');
    
    // Gestionnaire pour l'édition d'un couloir
    const editCouloirBtn = document.getElementById('editCouloirBtn');
    const editCouloirModal = document.getElementById('editCouloirModal');
    const cancelEditCouloirBtn = document.getElementById('cancelEditCouloirBtn');
    const closeEditModalBtn = editCouloirModal?.querySelector('.close');
    const editCouloirForm = document.getElementById('editCouloirForm');
    const editCouloirError = document.getElementById('editCouloirError');
    
    // Fonction pour ouvrir la modale de suppression
    if (deleteCouloirBtn) {
        deleteCouloirBtn.addEventListener('click', function() {
            if (currentCouloirId === null) {
                console.error("Impossible de supprimer: aucun couloir sélectionné");
                return;
            }
            
            // Vérifier si l'utilisateur est authentifié
            if (!window.authModule || !window.authModule.isAuthenticated()) {
                alert("Vous devez être connecté pour supprimer un couloir.");
                return;
            }
            
            // Réinitialiser le formulaire et les erreurs
            if (deleteForm) deleteForm.reset();
            if (deleteError) deleteError.textContent = '';
            
            // Afficher la modale
            if (deleteModal) deleteModal.style.display = 'block';
        });
    }
    
    // Fonction pour ouvrir la modale d'édition
    if (editCouloirBtn) {
        editCouloirBtn.addEventListener('click', function() {
            if (!window.currentCouloirData) {
                console.error("Impossible de modifier: aucun couloir sélectionné ou données manquantes");
                return;
            }
            
            // Vérifier si l'utilisateur est authentifié
            if (!window.authModule || !window.authModule.isAuthenticated()) {
                alert("Vous devez être connecté pour modifier un couloir.");
                return;
            }
            
            // Vérifier que la modale et les champs existent avant de les utiliser
            const editModal = document.getElementById('editCouloirModal');
            if (!editModal) {
                console.error("La modale d'édition n'existe pas");
                return;
            }
            
            try {
                // Pré-remplir le formulaire avec les données du couloir
                const couloir = window.currentCouloirData;
                
                // Vérifier l'existence de chaque élément avant de lui assigner une valeur
                const nomField = document.getElementById('editNomCouloir');
                const latitudeField = document.getElementById('editLatitudeCouloir');
                const longitudeField = document.getElementById('editLongitudeCouloir');
                const expositionField = document.getElementById('editExpositionCouloir');
                const altitudeMaxField = document.getElementById('editAltitudeMaxCouloir');
                const altitudeMinField = document.getElementById('editAltitudeMinCouloir');
                const penteField = document.getElementById('editPenteCouloir');
                const cotationSkiField = document.getElementById('editCotationSkiCouloir');
                const expositionSkiField = document.getElementById('editExpositionSkiCouloir');
                const commentaireField = document.getElementById('editCommentaireCouloir');
                const lienField = document.getElementById('editLienCouloir');
                
                // Assigner les valeurs seulement si l'élément existe
                if (nomField) nomField.value = couloir.nom || '';
                if (latitudeField) latitudeField.value = couloir.latitude || '';
                if (longitudeField) longitudeField.value = couloir.longitude || '';
                if (expositionField) expositionField.value = couloir.exposition || '';
                if (altitudeMaxField) altitudeMaxField.value = couloir.altitude_max || '';
                if (altitudeMinField) altitudeMinField.value = couloir.altitude_min || '';
                if (penteField) penteField.value = couloir.pente || '';
                if (cotationSkiField) cotationSkiField.value = couloir.cotation_ski || '';
                if (expositionSkiField) expositionSkiField.value = couloir.exposition_ski || '';
                if (commentaireField) commentaireField.value = couloir.commentaire || '';
                if (lienField) lienField.value = couloir.lien || '';
                
                // Réinitialiser les erreurs
                const editCouloirError = document.getElementById('editCouloirError');
                if (editCouloirError) editCouloirError.textContent = '';
                
                // Afficher la modale
                editModal.style.display = 'block';
                
            } catch (error) {
                console.error("Erreur lors du pré-remplissage du formulaire d'édition:", error);
                alert("Une erreur s'est produite lors de la préparation du formulaire d'édition.");
            }
        });
    }
    
    // Gestion des événements pour la modal d'édition
    if (cancelEditCouloirBtn) {
        cancelEditCouloirBtn.addEventListener('click', function() {
            if (editCouloirModal) editCouloirModal.style.display = 'none';
        });
    }
    
    if (closeEditModalBtn) {
        closeEditModalBtn.addEventListener('click', function() {
            if (editCouloirModal) editCouloirModal.style.display = 'none';
        });
    }
    
    window.addEventListener('click', function(event) {
        if (event.target === editCouloirModal) {
            editCouloirModal.style.display = 'none';
        }
    });
    
    // Gérer la soumission du formulaire d'édition
    if (editCouloirForm) {
        editCouloirForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            try {
                // Vérifier si l'utilisateur est connecté
                const currentUser = window.authModule?.getCurrentUser?.();
                if (!currentUser) {
                    if (editCouloirError) editCouloirError.textContent = "Vous devez être connecté pour modifier un couloir.";
                    return;
                }
                
                // Vérifier si le couloir existe
                if (!window.currentCouloirData || !window.currentCouloirData.id) {
                    if (editCouloirError) editCouloirError.textContent = "Données du couloir invalides.";
                    return;
                }
                
                // Récupérer les valeurs du formulaire
                const nom = document.getElementById('editNomCouloir').value;
                const latitude = parseFloat(document.getElementById('editLatitudeCouloir').value);
                const longitude = parseFloat(document.getElementById('editLongitudeCouloir').value);
                const exposition = document.getElementById('editExpositionCouloir').value;
                const altitude_max = parseInt(document.getElementById('editAltitudeMaxCouloir').value) || null;
                const altitude_min = parseInt(document.getElementById('editAltitudeMinCouloir').value) || null;
                const pente = parseInt(document.getElementById('editPenteCouloir').value) || null;
                const cotation_ski = document.getElementById('editCotationSkiCouloir').value;
                const exposition_ski = document.getElementById('editExpositionSkiCouloir').value;
                const commentaire = document.getElementById('editCommentaireCouloir').value;
                const lien = document.getElementById('editLienCouloir').value;
                
                // Validation des champs obligatoires
                if (!nom || isNaN(latitude) || isNaN(longitude) || !exposition || !altitude_max) {
                    if (editCouloirError) editCouloirError.textContent = 
                        "Les champs Nom, Latitude, Longitude, Exposition et Altitude max sont obligatoires.";
                    return;
                }
                
                // Créer l'objet couloir mis à jour
                const updatedCouloir = {
                    id: window.currentCouloirData.id, // Conserver l'ID original
                    nom,
                    latitude,
                    longitude,
                    exposition,
                    altitude_max,
                    altitude_min,
                    pente,
                    cotation_ski,
                    exposition_ski,
                    commentaire,
                    lien,
                    user: window.currentCouloirData.user // Conserver l'utilisateur original
                };
                
                // Mettre à jour le couloir dans la base de données
                const success = await updateCouloir(updatedCouloir);
                
                if (success) {
                    console.log(`Couloir "${nom}" mis à jour avec succès`);
                    
                    // Fermer la modale
                    if (editCouloirModal) editCouloirModal.style.display = 'none';
                    
                    // Fermer le panneau d'information
                    hideRightPanel();
                    
                    // Recharger les points sur la carte
                    await fetchAndDisplayPoints();
                    
                    // Notification sans confirmation du navigateur
                    const notification = document.createElement('div');
                    notification.className = 'notification success';
                    notification.innerHTML = `<p>Le couloir "${nom}" a été mis à jour avec succès.</p>`;
                    document.body.appendChild(notification);
                    
                    // Disparaitre après 3 secondes
                    setTimeout(() => {
                        notification.classList.add('fadeOut');
                        setTimeout(() => {
                            document.body.removeChild(notification);
                        }, 500);
                    }, 3000);
                } else {
                    if (editCouloirError) editCouloirError.textContent = "Erreur lors de la mise à jour du couloir";
                }
            } catch (error) {
                console.error("Erreur lors de la mise à jour du couloir:", error);
                if (editCouloirError) editCouloirError.textContent = "Une erreur est survenue lors de la mise à jour du couloir";
            }
        });
    }
    
    // Fermer la modale lorsqu'on clique sur le bouton Annuler
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', function() {
            if (deleteModal) deleteModal.style.display = 'none';
        });
    }
    
    // Fermer la modale lorsqu'on clique sur le X
    if (closeDeleteModalBtn) {
        closeDeleteModalBtn.addEventListener('click', function() {
            if (deleteModal) deleteModal.style.display = 'none';
        });
    }
    
    // Fermer la modale lorsqu'on clique en dehors
    window.addEventListener('click', function(event) {
        if (event.target === deleteModal) {
            deleteModal.style.display = 'none';
        }
    });
    
    // Gérer la soumission du formulaire de suppression
    if (deleteForm) {
        deleteForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const password = document.getElementById('deletePassword').value;
            
            try {
                // Vérifier le mot de passe
                const passwordValid = await verifyPassword(password);
                if (!passwordValid) {
                    if (deleteError) deleteError.textContent = "Mot de passe incorrect";
                    return;
                }
                
                // Si le mot de passe est valide, procéder à la suppression
                const success = await deleteCouloir(currentCouloirId);
                if (success) {
                    console.log(`Couloir avec ID ${currentCouloirId} supprimé avec succès`);
                    
                    // Fermer la modale et le panneau droit
                    if (deleteModal) deleteModal.style.display = 'none';
                    hideRightPanel();
                    
                    // Recharger les points sur la carte
                    await fetchAndDisplayPoints();
                    
                    // Notification sans confirmation du navigateur
                    const notification = document.createElement('div');
                    notification.className = 'notification warning';
                    notification.innerHTML = `<p>Le couloir a été supprimé avec succès.</p>`;
                    document.body.appendChild(notification);
                    
                    // Disparaitre après 3 secondes
                    setTimeout(() => {
                        notification.classList.add('fadeOut');
                        setTimeout(() => {
                            document.body.removeChild(notification);
                        }, 500);
                    }, 3000);
                } else {
                    if (deleteError) deleteError.textContent = "Erreur lors de la suppression du couloir";
                }
            } catch (error) {
                console.error("Erreur lors de la suppression:", error);
                if (deleteError) deleteError.textContent = "Une erreur est survenue lors de la suppression";
            }
        });
    }
});

// Fonction pour vérifier le mot de passe (à coordonner avec le module d'authentification)
async function verifyPassword(password) {
    // Utilisez la même méthode de hachage que dans auth.js
    const hashedPassword = window.authModule?.hashPassword ? 
        window.authModule.hashPassword(password) : hashPassword(password);
    
    // Accéder aux informations de l'utilisateur connecté
    const currentUser = window.authModule?.getCurrentUser?.();
    if (!currentUser) {
        console.error("Aucun utilisateur connecté");
        return false;
    }
    
    // Comparer avec le mot de passe de l'utilisateur actuel
    return currentUser.passwordHash === hashedPassword;
}

// Fonction de secours pour hacher le mot de passe si nécessaire
function hashPassword(password) {
    if (typeof CryptoJS !== 'undefined') {
        return CryptoJS.SHA256(password).toString();
    } else {
        console.warn("CryptoJS n'est pas disponible, impossible de hacher le mot de passe");
    }
    return password; // Fallback non sécurisé
}

// Exposer la fonction pour qu'elle soit accessible depuis d'autres modules
window.fetchAndDisplayPoints = fetchAndDisplayPoints;

// Gestionnaire pour l'ajout d'un couloir
document.addEventListener('DOMContentLoaded', function() {
    // Récupérer les éléments du DOM
    const addCouloirBtn = document.getElementById('addCouloirBtn');
    const addCouloirModal = document.getElementById('addCouloirModal');
    const cancelAddCouloirBtn = document.getElementById('cancelAddCouloirBtn');
    const closeAddModalBtn = addCouloirModal?.querySelector('.close');
    const addCouloirForm = document.getElementById('addCouloirForm');
    const addCouloirError = document.getElementById('addCouloirError');
    
    // Fonction pour ouvrir la modale d'ajout de couloir
    if (addCouloirBtn) {
        addCouloirBtn.addEventListener('click', function() {
            // Vérifier si l'utilisateur est authentifié
            if (!window.authModule || !window.authModule.isAuthenticated()) {
                alert("Vous devez être connecté pour ajouter un couloir.");
                return;
            }
            
            // Pré-remplir les coordonnées actuelles de la carte si disponible
            if (map) {
                const center = map.getCenter();
                document.getElementById('latitudeCouloir').value = center.lat.toFixed(6);
                document.getElementById('longitudeCouloir').value = center.lng.toFixed(6);
            }
            
            // Réinitialiser le formulaire et les erreurs
            if (addCouloirForm) addCouloirForm.reset();
            if (addCouloirError) addCouloirError.textContent = '';
            
            // Afficher la modale
            if (addCouloirModal) addCouloirModal.style.display = 'block';
        });
    }
    
    // Fermer la modale lorsqu'on clique sur le bouton Annuler
    if (cancelAddCouloirBtn) {
        cancelAddCouloirBtn.addEventListener('click', function() {
            if (addCouloirModal) addCouloirModal.style.display = 'none';
        });
    }
    
    // Fermer la modale lorsqu'on clique sur le X
    if (closeAddModalBtn) {
        closeAddModalBtn.addEventListener('click', function() {
            if (addCouloirModal) addCouloirModal.style.display = 'none';
        });
    }
    
    // Fermer la modale lorsqu'on clique en dehors
    window.addEventListener('click', function(event) {
        if (event.target === addCouloirModal) {
            addCouloirModal.style.display = 'none';
        }
    });
    
    // Gérer la soumission du formulaire d'ajout de couloir
    if (addCouloirForm) {
        addCouloirForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            try {
                // Vérifier si l'utilisateur est connecté
                const currentUser = window.authModule?.getCurrentUser?.();
                if (!currentUser) {
                    if (addCouloirError) addCouloirError.textContent = "Vous devez être connecté pour ajouter un couloir.";
                    return;
                }
                
                // Récupérer les valeurs du formulaire
                const nom = document.getElementById('nomCouloir').value;
                const latitude = parseFloat(document.getElementById('latitudeCouloir').value);
                const longitude = parseFloat(document.getElementById('longitudeCouloir').value);
                const exposition = document.getElementById('expositionCouloir').value;
                const altitude_max = parseInt(document.getElementById('altitudeMaxCouloir').value) || null;
                const altitude_min = parseInt(document.getElementById('altitudeMinCouloir').value) || null;
                const pente = parseInt(document.getElementById('penteCouloir').value) || null;
                const cotation_ski = document.getElementById('cotationSkiCouloir').value;
                const exposition_ski = document.getElementById('expositionSkiCouloir').value;
                const commentaire = document.getElementById('commentaireCouloir').value;
                const lien = document.getElementById('lienCouloir').value;
                
                // Validation des champs obligatoires
                if (!nom || isNaN(latitude) || isNaN(longitude) || !exposition || !altitude_max) {
                    if (addCouloirError) addCouloirError.textContent = 
                        "Les champs Nom, Latitude, Longitude, Exposition et Altitude max sont obligatoires.";
                    return;
                }
                
                // Créer l'objet couloir
                const newCouloir = {
                    nom,
                    latitude,
                    longitude,
                    exposition,
                    altitude_max,
                    altitude_min,
                    pente,
                    cotation_ski,
                    exposition_ski,
                    commentaire,
                    lien,
                    user: currentUser.username // Utiliser le nom d'utilisateur connecté
                };
                
                // Ajouter le couloir à la base de données
                const couloirId = await addCouloir(newCouloir);
                if (couloirId) {
                    console.log(`Couloir "${nom}" ajouté avec succès, ID:`, couloirId);
                    
                    // Fermer la modale
                    if (addCouloirModal) addCouloirModal.style.display = 'none';
                    
                    // Recharger les points sur la carte
                    await fetchAndDisplayPoints();
                    
                    // Notification sans confirmation du navigateur
                    const notification = document.createElement('div');
                    notification.className = 'notification success';
                    notification.innerHTML = `<p>Le couloir "${nom}" a été ajouté avec succès.</p>`;
                    document.body.appendChild(notification);
                    
                    // Disparaitre après 3 secondes
                    setTimeout(() => {
                        notification.classList.add('fadeOut');
                        setTimeout(() => {
                            document.body.removeChild(notification);
                        }, 500);
                    }, 3000);
                } else {
                    if (addCouloirError) addCouloirError.textContent = "Erreur lors de l'ajout du couloir";
                }
            } catch (error) {
                console.error("Erreur lors de l'ajout du couloir:", error);
                if (addCouloirError) addCouloirError.textContent = "Une erreur est survenue lors de l'ajout du couloir";
            }
        });
    }
});

// Mise à jour de la fonction pour réinitialiser la base de données avec UI
window.resetAndReloadDatabase = async function() {
    try {
        // Demande de confirmation avec plus de détails
        if (!confirm("ATTENTION: Vous êtes sur le point de réinitialiser la base de données.\n\n" +
                   "- Tous les couloirs personnalisés seront supprimés\n" +
                   "- Les données seront remplacées par les données de test\n" +
                   "- Cette action est irréversible\n\n" +
                   "Êtes-vous sûr de vouloir continuer?")) {
            console.log("Réinitialisation annulée par l'utilisateur");
            return;
        }
        
        // Afficher une notification de chargement
        const loadingNotification = document.createElement('div');
        loadingNotification.className = 'notification warning';
        loadingNotification.innerHTML = '<p>Réinitialisation de la base de données en cours...</p>';
        document.body.appendChild(loadingNotification);
        
        console.log("Réinitialisation de la base de données en cours...");
        
        // Utiliser la nouvelle fonction de réinitialisation complète
        await window.resetDatabaseCompletely(true);
        
        // Supprimer la notification de chargement
        document.body.removeChild(loadingNotification);
        
        console.log("Base de données réinitialisée, rechargement des points...");
        await fetchAndDisplayPoints();
        console.log("Points rechargés avec succès");
        
        // Afficher une notification de succès
        const successNotification = document.createElement('div');
        successNotification.className = 'notification success';
        successNotification.innerHTML = '<p>Base de données réinitialisée avec succès !</p>';
        document.body.appendChild(successNotification);
        
        // Faire disparaître la notification après 3 secondes
        setTimeout(() => {
            successNotification.classList.add('fadeOut');
            setTimeout(() => {
                document.body.removeChild(successNotification);
            }, 500);
        }, 3000);
        
    } catch (error) {
        console.error("Erreur lors de la réinitialisation de la base de données:", error);
        
        // Afficher une notification d'erreur
        const errorNotification = document.createElement('div');
        errorNotification.className = 'notification error';
        errorNotification.innerHTML = '<p>Erreur lors de la réinitialisation de la base de données</p>';
        document.body.appendChild(errorNotification);
        
        // Faire disparaître la notification après 5 secondes
        setTimeout(() => {
            errorNotification.classList.add('fadeOut');
            setTimeout(() => {
                document.body.removeChild(errorNotification);
            }, 500);
        }, 5000);
    }
};

// Ajouter une fonction spéciale pour réinitialiser la base de données
window.resetAndReloadDatabase = async function() {
    try {
        // Confirmation de l'utilisateur
        if (confirm("Êtes-vous sûr de vouloir réinitialiser la base de données ? Tous les couloirs seront supprimés et remplacés par les données de test.")) {
            console.log("Réinitialisation de la base de données en cours...");
            await resetDatabase();
            console.log("Base de données réinitialisée, rechargement des points...");
            await fetchAndDisplayPoints();
            console.log("Points rechargés avec succès");
            alert("Base de données réinitialisée avec succès !");
        }
    } catch (error) {
        console.error("Erreur lors de la réinitialisation de la base de données:", error);
        alert("Erreur lors de la réinitialisation de la base de données");
    }
};

// Fonction améliorée pour recharger les points automatiquement
window.reloadPoints = async function() {
    try {
        console.log("Rechargement automatique des points suite à une modification de la base de données");
        await fetchAndDisplayPoints();
    } catch (error) {
        console.error("Erreur lors du rechargement des points:", error);
    }
};