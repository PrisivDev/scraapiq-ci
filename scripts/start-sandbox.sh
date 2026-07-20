#!/bin/bash
# Démarre le serveur Next.js en mode production (standalone) pour le sandbox.
# Ce script est conçu pour être appelé par cron ou manuellement.

cd /home/z/my-project

# Tuer toute instance existante
pkill -9 -f "server.js" 2>/dev/null
sleep 2

# Copier static + public dans standalone (si pas déjà fait)
if [ ! -d ".next/standalone/.next/static" ]; then
  cp -r .next/static .next/standalone/.next/ 2>/dev/null
  cp -r public .next/standalone/ 2>/dev/null
fi

# Démarrer le serveur standalone
cd .next/standalone
NODE_OPTIONS="--max-old-space-size=3072" node server.js >> /home/z/my-project/dev.log 2>&1
