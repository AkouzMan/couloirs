// Initialisation de la carte
var map = L.map('map').setView([46.8182, 8.2275], 8);

L.tileLayer('https://wmts20.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg', {
    maxZoom: 19,
    attribution: '© <a href="https://www.swisstopo.admin.ch/">swisstopo</a>'
}).addTo(map);

var regions = []; // Variable globale pour stocker les régions (polygones de danger)

// Fonction pour récupérer les données d'avalanche
async function fetchAvalancheData() {
    const url = `https://aws.slf.ch/api/bulletin/caaml/fr/geojson`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Erreur lors de la récupération des données');

        const data = await response.json();

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
                problemeTyp, tendence, meteo, dangerSub
            });

            // Region click event to display detailed data
            region.on('click', function (event) {

                if (infoPanelRight.style.right === '0px') {
                    hideRightPanel();
                }

                let popupContent = `
                    <div style="border: 3px solid ${fillColor}; padding: 10px; border-radius: 6px;">
                        <b>Niveau de danger :</b> ${getNumDangerLevel(dangerLevel)}${getSubDangerLevel(dangerSub)}<br>
                        <b>Aux expositions :</b> ${aspects}<br>
                        <b>Au dessus de :</b> ${upperLimit}<br>
                        <b>En dessous de :</b> ${lowerLimit}<br>
                    </div>
                `;

                event.target.bindPopup(popupContent).openPopup();

                // Update left panel content
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
            });

            // Add region to the map
            region.addTo(map);
        });
    } catch (error) {
        console.error('Erreur:', error);
    }
}

// Fonction pour mettre à jour le panneau gauche
function updateLeftPanel({ title, fillColor, dangerLevel, dangerSub, aspects, altitude,
    problemeTyp, situation, tendence, meteo }) {
    document.getElementById('panelLeftTitre').textContent = title;
    document.getElementById('panelLeftTitre').style.backgroundColor = fillColor;
    document.getElementById('panelDanger').textContent = getNumDangerLevel(dangerLevel) + getSubDangerLevel(dangerSub);
    document.getElementById('panelExpositions').textContent = aspects;
    document.getElementById('panelAltitude').innerHTML = altitude;
    document.getElementById('panelproblemTyp').innerHTML = problemeTyp;
    document.getElementById('panelSituation').innerHTML = situation;
    document.getElementById('panelComment').innerHTML = tendence;
    document.getElementById('panelMeteo').innerHTML = meteo;

    // Show the left panel and adjust the layout
    document.getElementById('infoPanelLeft').style.left = '0';
    document.getElementById('infoPanelLeft').style.borderColor = fillColor;
    document.getElementById('legend').style.left = '340px'; // Décaler avec le panneau
    document.querySelector('.leaflet-control-zoom').style.left = '340px'; // Décalage avec le panneau
}

var infoPanelRight = document.getElementById('infoPanelRight');
var closePanelRight = document.getElementById('closePanelRight');
var closePanelLeft = document.getElementById('closePanelLeft')

// Fonction d'affichage du panneau droit
function showRightPanel(name, lat, lon, pointExposition, altitudeMax, altitudeMin, pente, cotationSki, expositionSki, commentaire, lien, dangerCalc, dangerSub, pointColor) {
    // Gestion de l'altitude
    let altitude = altitudeMin === ''
        ? `À ${altitudeMax}m`
        : `De ${altitudeMax}m à ${altitudeMin}m`;

    //let dangerTot = `${dangerCalc.danger}${dangerSub}`;

    // Mise à jour du contenu du panneau droit
    document.getElementById('panelRightTitre').textContent = name;
    document.getElementById('panelRightDanger').textContent = `${dangerCalc.danger}${dangerSub}` ;
    document.getElementById('panelRightPente').textContent = pente;
    document.getElementById('panelRightExposition').textContent = pointExposition;
    document.getElementById('panelRightCotationSki').textContent = cotationSki;
    document.getElementById('panelRightExpositionSki').textContent = expositionSki;
    document.getElementById('panelRightAltitude').textContent = altitude;
    document.getElementById('panelRightComment').textContent = commentaire;
    document.getElementById('panelRightLien').href = lien;

    // Affichage du panneau
    infoPanelRight.style.right = '0';
    infoPanelRight.style.borderColor = pointColor;
    document.getElementById('panelRightTitre').style.backgroundColor = pointColor; // Change le fond du titre
}

// Masquer le panneau droit
function hideRightPanel() {
    infoPanelRight.style.right = '-300px';
}

// Masquer le panneau gauche
function hideLeftPanel() {
    const infoPanelLeft = document.getElementById('infoPanelLeft');
    const legend = document.getElementById('legend');
    const zoomControl = document.querySelector('.leaflet-control-zoom');

    // Utilisation de transitions CSS pour rendre le mouvement plus fluide
    infoPanelLeft.style.transition = 'left 0.3s ease-in-out';
    infoPanelLeft.style.left = '-300px';

    legend.style.transition = 'left 0.3s ease-in-out';
    legend.style.left = '40px';

    zoomControl.style.transition = 'left 0.3s ease-in-out';
    zoomControl.style.left = '40px'; // Décalage avec le panneau
};


// Événements pour fermer les panneaux 
closePanelRight.addEventListener('click', hideRightPanel);
closePanelLeft.addEventListener('click', hideLeftPanel);

// Masquer les panneau en cliquant en dehors de la carte
map.on('click', function (e) {
    if (!e.originalEvent.target.closest('.leaflet-interactive')) {
        hideRightPanel();
        hideLeftPanel();
    }
});





// Fonction pour lire le CSV
function loadCSV() {
    return new Promise((resolve, reject) => {
        Papa.parse('couloirs.csv', {
            download: true,
            header: true,
            dynamicTyping: true,
            complete: function (results) {
                if (!results || !results.data) {
                    reject("Erreur lors de la lecture du fichier CSV.");
                } else {
                    resolve(results); // Assurez-vous de bien renvoyer tout l'objet
                }
            },
            error: function (error) {
                reject(error);
            }
        });
    });
}

// Fonction pour charger et afficher les points du CSV
async function fetchAndDisplayCSV() {
    try {
        const rows = await loadCSV(); // Attente des données du CSV
        console.log("Données chargées :", rows); // Debug

        if (!rows || !rows.data || rows.data.length === 0) {
            console.error("Le fichier CSV est vide ou n'a pas été chargé correctement.");
            return;
        }

        rows.data.forEach(row => {
            if (!row.latitude || !row.longitude) {
                console.warn("Ligne invalide (pas de coordonnées) :", row);
                return;
            }

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
            const altitudeMax = parseInt(row.altitude_max, 10) || null; // Utilisation de null pour une valeur absente
            const altitudeMin = parseInt(row.altitude_min, 10) || null; // Utilisation de null pour une valeur absente
            const pointExposition = row.exposition?.trim() || '';

            let dangerCalc = {
                danger: "NaN",
                commentaire: "Hors bulletin"
            };
            let dangerSub = '';

            let regionNumber = 'Hors bulletin';
            //console.log("Region  :", regions);

            if (!isNaN(lat) && !isNaN(lon)) {
                let point = { lat, lon, pointExposition, altitudeMax, altitudeMin, pente };
                //console.log("Point :", point);

                regionNumber = findRegionForPoint(point, regions);
                //console.log("Region Number :", regionNumber);

                if (!isNaN(regionNumber)) {
                    dangerCalc = getDangerForPoint(point, regions, regionNumber - 1);
                    dangerSub = getSubDangerLevel(regions[regionNumber-1].dangerSub);
                }

                let pointColor = getDangerColor(dangerCalc.danger);

                // Ajout du marqueur sur la carte
                L.circleMarker([lat, lon], {
                    radius: 6,
                    fillColor: pointColor,
                    color: "black",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 1
                }).addTo(map)

                    .on('click', function (event) {
                        showRightPanel(name, lat, lon, pointExposition, altitudeMax, altitudeMin, pente, cotationSki, expositionSki, commentaire, lien, dangerCalc, dangerSub, pointColor);
                        if (!isNaN(regionNumber)) {
                            let regionData = regions[regionNumber - 1];  // Récupérer les données de la région
                            // Mettre à jour le panneau de gauche avec les infos de la région
                            updateLeftPanel({
                                title: 'Bulletin pour : '+name,
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
                        } else {
                            hideLeftPanel();
                        } 
                        ;
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
            }
        });
    } catch (error) {
        console.error("Erreur lors du chargement du fichier CSV :", error);
    }
}



// Récupérer les données et afficher les dangers et CSV
document.addEventListener("DOMContentLoaded", function () {
    // Ajouter un message de chargement pour l'utilisateur
    console.log("Chargement des données...");

    fetchAvalancheData().then(() => {
        console.log("Données avalanche chargées. Chargement du CSV...");

        // Afficher un message ou une animation de chargement si nécessaire
        fetchAndDisplayCSV().then(() => {
            console.log("Données CSV chargées et affichées !");
        }).catch((error) => {
            console.error("Erreur lors du chargement du CSV :", error);
            alert("Erreur lors du chargement des données CSV. Veuillez réessayer plus tard.");
        });
    }).catch((error) => {
        console.error("Erreur lors du chargement des données d'avalanche :", error);
        alert("Erreur lors du chargement des données d'avalanche. Veuillez réessayer plus tard.");
    });
});
