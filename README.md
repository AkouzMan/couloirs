# Carte des Couloirs - Application de Visualisation des Risques d'Avalanche

## Description
Cette application web permet de visualiser les couloirs alpins et les risques d'avalanches sur une carte interactive. Elle affiche des informations en temps réel sur la validité des bulletins météorologiques et permet d'explorer les différentes zones à risque.

## Fonctionnalités
- Affichage d'une carte interactive avec Leaflet
- Visualisation des couloirs alpins avec code couleur selon le niveau de danger
- Panneau d'information détaillé pour chaque zone
- Bulletin de validité et prochaine émission de mise à jour
- Système de connexion pour accéder aux informations détaillées et aux points sur la carte

## Installation
1. Clonez ce dépôt
2. Ouvrez `index.html` dans un navigateur web

## Utilisation
- Naviguez sur la carte pour explorer les différentes zones
- Cliquez sur un couloir pour voir les détails dans le panneau d'information de gauche
- Cliquez sur un point d'intérêt pour voir les détails spécifiques dans le panneau de droite
- Utilisez la légende pour interpréter les niveaux de risque
- Connectez-vous pour accéder aux fonctionnalités avancées

## Structure du projet
```
/
├── index.html           # Page principale
├── css/
│   └── style.css        # Feuille de style
├── js/
│   ├── script.js        # Script principal
│   ├── node.js          # Gestion des points d'intérêt
│   ├── utils.js         # Fonctions utilitaires
│   └── auth.js          # Système d'authentification
└── data/                # Données géographiques et météorologiques
```

## Technologies utilisées
- HTML5, CSS3, JavaScript
- Leaflet.js pour la cartographie
- Turf.js pour les calculs géospatiaux
- PapaParse pour l'analyse CSV

## Licence
Ce projet est sous licence [insérez votre licence ici]
