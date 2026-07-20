#!/bin/bash
# Maintient le serveur Next.js en vie en le redémarrant s'il meurt.
# Le sandbox tue les process après ~20s d'inactivité ; ce script les relance.

cd /home/z/my-project

while true; do
  # Vérifier si le serveur répond
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null | grep -q "200"; then
    # Serveur OK — attendre 5s avant de revérifier
    sleep 5
  else
    # Serveur mort — redémarrer
    echo "[$(date)] Serveur mort — redémarrage..." >> /home/z/my-project/scripts/keep-alive.log
    pkill -9 -f "next start" 2>/dev/null
    sleep 2
    NODE_OPTIONS="--max-old-space-size=3072" npx next start -p 3000 >> /home/z/my-project/dev.log 2>&1 &
    sleep 8  # attendre que le serveur démarre
  fi
done
