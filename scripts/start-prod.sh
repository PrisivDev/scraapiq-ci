#!/bin/bash
# Démarre le serveur Next.js en mode production (standalone)
# Ce script est conçu pour être lancé en arrière-plan avec nohup/setsid
# et rester vivant même après la fermeture du terminal.

cd /home/z/my-project

# Tuer toute instance existante
pkill -9 -f "server.js" 2>/dev/null
sleep 2

# Démarrer le serveur standalone (pré-compilé, faible mémoire)
# Production mode = pas de Turbopack, pas de compilation à la volée
exec node .next/standalone/server.js
