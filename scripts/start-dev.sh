#!/bin/bin/env bash
# Démarre le serveur Next.js avec précompilation des routes critiques
# pour éviter l'OOM (Out of Memory) dans l'environnement sandbox (4GB RAM).
set -e

echo "=== Démarrage Next.js ==="
NODE_OPTIONS="--max-old-space-size=3584" npx next dev -p 3000 > /home/z/my-project/dev.log 2>&1 &
NEXT_PID=$!
echo "PID: $NEXT_PID"

# Attendre que le serveur soit prêt
echo "=== Attente démarrage... ==="
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null | grep -q "200"; then
    echo "Serveur prêt après ${i}s"
    break
  fi
  sleep 1
done

# Précompiler les routes critiques une par une avec pauses
echo "=== Précompilation /api/health ==="
curl -s -o /dev/null http://localhost:3000/api/health 2>/dev/null || true
sleep 3

echo "=== Précompilation /api/auth/login ==="
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@prisiv.biz","password":"AdminProd2026!"}' \
  -c /tmp/cookies.txt -o /dev/null 2>/dev/null || true
sleep 8

echo "=== Précompilation /api/me ==="
curl -s -b /tmp/cookies.txt http://localhost:3000/api/me -o /dev/null 2>/dev/null || true
sleep 3

echo "=== Précompilation / (page principale) ==="
curl -s -b /tmp/cookies.txt http://localhost:3000/ -o /dev/null 2>/dev/null || true
sleep 5

echo "=== Précompilation terminée ==="
echo "Serveur prêt sur http://localhost:3000"

# Garder le process en vie
wait $NEXT_PID
