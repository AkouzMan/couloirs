const express = require('express');
const path = require('path');
const couloirsRoutes = require('./routes/couloirs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour parser le JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Routes API
app.use('/api/couloirs', couloirsRoutes);

// Route principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});

// Gérer la fermeture propre
process.on('SIGINT', () => {
  const CouloirModel = require('./models/couloirModel');
  const model = new CouloirModel();
  model.close();
  console.log('Connexion à la base de données fermée');
  process.exit(0);
});
