// Fonction pour obtenir le niveau de danger sous forme numérique
function getNumDangerLevel(dangerLevel) {
    const dangerLevels = {
        'low': '1',
        'moderate': '2',
        'considerable': '3',
        'high': '4',
        'very_high': '5'
    };
    return dangerLevels[dangerLevel] || 'indéfini';
}

// Fonction pour obtenir le sous-niveau de danger
function getSubDangerLevel(dangerLevel) {
    const subLevels = {
        'minus': '-',
        'neutral': '=',
        'plus': '+'
    };
    return subLevels[dangerLevel] || '';
}

// Fonction pour corriger un polygone mal formé
function fixPolygon(geometry) {
    if (geometry.type === "Polygon") {
        geometry.coordinates.forEach((ring, index) => {
            // Vérification du nombre de points dans chaque anneau
            if (ring.length < 4) {
                console.warn(`Le polygone au niveau de l'anneau ${index} a moins de 4 points, il sera ignoré.`);
                return;  // Ignore les polygones mal formés
            }

            // Si l'anneau a moins de 4 points, on ajoute des points pour garantir qu'il y en a 4
            if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
                ring.push(ring[0]);  // Ajouter le premier point pour fermer le polygone
            }
        });
    }
    return geometry;
}

// Fonction pour calculer le danger pour un point
function getDangerForPoint(point, regions, regionIndex) {
    if (isNaN(regionIndex) || regionIndex < 0 || regionIndex >= regions.length) {
        return {
            danger: "NaN",
            commentaire: "Données manquantes ou point hors région, par défaut danger égal à la région"
        };
    }

    let region = regions[regionIndex];
    let dangerInitial = getNumDangerLevel(region.dangerLevel); // Niveau de danger de la région
    let dangerCalc = dangerInitial;
    let commentaire = "Danger inchangé";

    let pointExposition = point.pointExposition;
    let altitudeMax = point.altitudeMax;
    let altitudeMin = point.altitudeMin;
    let pente = point.pente;

    // Vérification de l'exposition et de l'altitude
    if (dangerInitial > 0 && region.aspects !== "Non spécifié") {
        let regionExpositions = region.aspects.split(',').map(e => e.trim());

        // Réduction du danger en fonction de l'exposition
        if (!regionExpositions.includes(pointExposition)) {
            dangerCalc = Math.max(0, dangerInitial - 1);
            commentaire = "Réduction du danger car l'exposition est favorable";
            console.log(`REDUCTION retourné : ${dangerCalc} comm: ${commentaire}`);
        }
        // Réduction du danger en fonction de l'altitude
        else if (altitudeMax < region.upperLimit) {
            dangerCalc = Math.max(0, dangerInitial - 1);
            commentaire = "Réduction du danger car l'altitude max du point est favorable";
        }
    } else { //checker ici, le code là dessous ne s'execuet jamais...
        console.log(`YOooooyooyoyo ${dangerInitial}`);
        return {
            danger: dangerInitial,
            commentaire: "Danger inchangé"
        };
    }

    return { danger: dangerCalc, commentaire: commentaire };
}

// Fonction pour trouver la région à laquelle appartient un point
function findRegionForPoint(point, regions) {
    //console.log("Region in function :", regions);
    //console.log("Point in function :", point);

    let lat = point.lat, lon = point.lon;

    for (let r = 0; r < regions.length; r++) {
        let region = regions[r];

        // Vérifie si la géométrie est bien un polygone
        if (region.geometry.type === "Polygon") {
            let vs = region.geometry.coordinates[0]; // Premier anneau (extérieur)
            if (isInPolygon(lat, lon, vs)) {
                return r + 1; // Numéro de région (1-based index)
            }
        }
        else if (region.geometry.type === "MultiPolygon") {
            for (let poly of region.geometry.coordinates) {
                if (isInPolygon(lat, lon, poly[0])) { // Premier anneau seulement
                    return r + 1;
                }
            }
        }
    }
    return NaN; // Aucun polygone trouvé
}

// Check si un point est dans un polygone (région).
function isInPolygon(lon, lat, vs) {
    let inside = false;

    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i][1], yi = vs[i][0]; // Latitude / Longitude inversées
        let xj = vs[j][1], yj = vs[j][0];

        let intersect = ((yi > lat) !== (yj > lat)) &&
            (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    // console.log(`Le point est ${inside ? 'DANS' : 'HORS'} du polygone`);
    return inside;
}

// Fonction pour récupérer la couleur
function getDangerColor(dangerLevel) {
    const dangerColors = {
        "NaN": "gray",
        0: "#009933", // Très faible
        1: "#CCFF66", // Faible
        2: "#FFFF00", // Modéré
        3: "#FF9900", // Important
        4: "#FF0000", // Très important
        5: "#800000"  // Extrême
    };

    return dangerColors[dangerLevel] || "gray"; // Gris par défaut si dangerLevel est invalide
}

// Fonction pour vérifier la validité des polygones
function isValidPolygon(geometry) {
    if (geometry.type === "Polygon") {
        return geometry.coordinates.every(ring => ring.length >= 4);
    }
    return false;
}

function hashPassword(password) {
    const bcrypt = require("bcrypt");
    const saltRounds = 13; // Niveau de sécurité

    bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
        console.error("Erreur de hash :", err);
    return NaN;
    }
    console.log("Mot de passe hashé :", hash);
    return hash;
});
}

// Système de journalisation amélioré pour le débogage
const Logger = {
    levels: {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3
    },
    
    currentLevel: 0, // DEBUG par défaut
    
    setLevel: function(level) {
        if (typeof level === 'string') {
            level = this.levels[level.toUpperCase()] || 0;
        }
        this.currentLevel = level;
    },
    
    debug: function(message, ...args) {
        if (this.currentLevel <= this.levels.DEBUG) {
            console.debug(`[DEBUG] ${message}`, ...args);
        }
    },
    
    info: function(message, ...args) {
        if (this.currentLevel <= this.levels.INFO) {
            console.info(`[INFO] ${message}`, ...args);
        }
    },
    
    warn: function(message, ...args) {
        if (this.currentLevel <= this.levels.WARN) {
            console.warn(`[WARN] ${message}`, ...args);
        }
    },
    
    error: function(message, ...args) {
        if (this.currentLevel <= this.levels.ERROR) {
            console.error(`[ERROR] ${message}`, ...args);
        }
    },
    
    // Journalisation des erreurs de DOM
    logElementCheck: function(id, element) {
        if (!element) {
            this.error(`Élément avec l'ID '${id}' non trouvé dans le DOM`);
            return false;
        }
        this.debug(`Élément avec l'ID '${id}' trouvé dans le DOM`);
        return true;
    }
};

// Exposer le logger globalement
window.Logger = Logger;

// Fonction pour vérifier si un champ du DOM existe et le valoriser
function safeSetValue(id, value) {
    const element = document.getElementById(id);
    if (Logger.logElementCheck(id, element)) {
        element.value = value || '';
        return true;
    }
    return false;
}

// Exposer la fonction
window.safeSetValue = safeSetValue;

// Fonction pour réinitialiser la base de données (utilisable depuis la console)
console.info("Pour réinitialiser la base de données, utilisez window.resetAndReloadDatabase()");
