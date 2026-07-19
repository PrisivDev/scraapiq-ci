#!/bin/bash
# Watchdog production — démarre et surveille le serveur Next.js.
# Redémarre automatiquement si le process meurt (OOM, crash).
# Utilise le binaire direct (pas npx) pour éviter que le process enfant soit tué.

cd /home/z/my-project

# Tuer toute instance existante
pkill -9 -f "next start" 2>/dev/null
pkill -9 -f "node.*next" 2>/dev/null
sleep 2

MAX_RESTARTS=50
RESTART_COUNT=0
RESTART_DELAY=2

while [ $RESTART_COUNT -lt $MAX_RESTARTS ]; do
  echo "[$(date)] Démarrage (tentative $((RESTART_COUNT+1))/$MAX_RESTARTS)..." >> /home/z/my-project/dev.log
  
  # Binaire direct — pas de npx qui tue le process enfant
  # Limite mémoire 1.5GB pour rester sous la limite cgroup (4GB)
  NODE_OPTIONS="--max-old-space-size=1536" node node_modules/.bin/next start -p 3000 >> /home/z/my-project/dev.log 2>&1
  EXIT_CODE=$?
  
  echo "[$(date)] Serveur arrêté (exit: $EXIT_CODE)" >> /home/z/my-project/dev.log
  
  RESTART_COUNT=$((RESTART_COUNT+1))
  
  if [ $RESTART_COUNT -lt $MAX_RESTARTS ]; then
    echo "[$(date)] Redémarrage dans ${RESTART_DELAY}s..." >> /home/z/my-project/dev.log
    sleep $RESTART_DELAY
    # Reset du compteur tous les 10 redémarrs pour tourner indéfiniment
    if [ $((RESTART_COUNT % 10)) -eq 0 ]; then
      RESTART_COUNT=0
      echo "[$(date)] Reset compteur (tour indéfini)" >> /home/z/my-project/dev.log
    fi
  fi
done

echo "[$(date)] Abandon après $MAX_RESTARTS tentatives." >> /home/z/my-project/dev.log
