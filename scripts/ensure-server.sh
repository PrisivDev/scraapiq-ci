#!/bin/bash
# Vérifie si le serveur Next.js tourne, sinon le démarre.
# Conçu pour être appelé par cron toutes les 2 minutes.

cd /home/z/my-project

# Vérifier si le serveur répond
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null | grep -q "200"; then
  echo "[$(date)] Serveur OK" >> /home/z/my-project/scripts/server-monitor.log
  exit 0
fi

# Serveur mort — redémarrer
echo "[$(date)] Serveur mort — redémarrage..." >> /home/z/my-project/scripts/server-monitor.log
pkill -9 -f "next start" 2>/dev/null
sleep 2

# Démarrer en production (binaire direct, pas npx, mémoire 3GB)
NODE_OPTIONS="--max-old-space-size=3072" nohup setsid node node_modules/.bin/next start -p 3000 >> /home/z/my-project/dev.log 2>&1 < /dev/null &
echo "[$(date)] Serveur redémarré (PID: $!)" >> /home/z/my-project/scripts/server-monitor.log
