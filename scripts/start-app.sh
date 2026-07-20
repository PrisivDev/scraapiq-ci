#!/bin/bash
# Démarre l'application ScrapIQ CI en mode production (standalone, précompilé).
# Ce script doit être appelé après chaque redémarrage du sandbox.

cd /home/z/my-project

# Tuer toute instance existante
pkill -9 -f "server.js" 2>/dev/null
sleep 2

# Vérifier que le build existe
if [ ! -f ".next/standalone/server.js" ]; then
  echo "Build manquant. Lancement du build..."
  NODE_OPTIONS="--max-old-space-size=3584" npx next build
  cp -r .next/static .next/standalone/.next/
  cp -r public .next/standalone/
fi

# Copier static + public si manquants
if [ ! -d ".next/standalone/.next/static" ]; then
  cp -r .next/static .next/standalone/.next/ 2>/dev/null
  cp -r public .next/standalone/ 2>/dev/null
fi

# Démarrer le serveur standalone
echo "Démarrage du serveur sur http://localhost:3000"
cd .next/standalone
NODE_OPTIONS="--max-old-space-size=2048" node server.js
