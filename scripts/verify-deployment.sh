#!/bin/bash

# Script de vérification post-déploiement
# Vérifie que les routes critiques fonctionnent après déploiement

BASE_URL="http://localhost"
PORT_TESTING="3010"
PORT_MAIN="3011"

# Détermine le port en fonction de l'environnement
if [ "$CI_COMMIT_REF_NAME" = "main" ]; then
    PORT=$PORT_MAIN
else
    PORT=$PORT_TESTING
fi

FULL_URL="${BASE_URL}:${PORT}"

echo "🔍 Vérification du déploiement sur ${FULL_URL}"

# Attendre que le serveur soit prêt
echo "⏳ Attente du démarrage du serveur..."
sleep 10

# Vérifier la route de base
echo "🧪 Test de la route API de base..."
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "${FULL_URL}/api/test/format")
if [ "$HEALTH_CHECK" = "200" ]; then
    echo "✅ Route API de base : OK"
else
    echo "❌ Route API de base : ERREUR (Code: $HEALTH_CHECK)"
fi

# Vérifier la route subscription-reminder
echo "🧪 Test de la route subscription-reminder..."
CRON_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "${FULL_URL}/api/cron/subscription-reminder")
if [ "$CRON_CHECK" = "200" ]; then
    echo "✅ Route subscription-reminder : OK"
else
    echo "❌ Route subscription-reminder : ERREUR (Code: $CRON_CHECK)"
    echo "🔍 Vérification de l'existence du fichier route..."
    if [ -f ".next/server/app/api/cron/subscription-reminder/route.js" ]; then
        echo "✅ Fichier route.js trouvé dans .next/server/"
    else
        echo "❌ Fichier route.js MANQUANT dans .next/server/"
        echo "📂 Contenu du dossier .next/server/app/api/cron/:"
        ls -la .next/server/app/api/cron/ || echo "Dossier cron inexistant"
    fi
fi

# Vérifier d'autres routes critiques
echo "🧪 Test d'autres routes critiques..."
ROUTES_TO_CHECK=(
    "/api/auth/current-user"
    "/api/posts"
    "/api/categories"
)

for route in "${ROUTES_TO_CHECK[@]}"; do
    CHECK=$(curl -s -o /dev/null -w "%{http_code}" "${FULL_URL}${route}")
    if [ "$CHECK" = "200" ] || [ "$CHECK" = "401" ] || [ "$CHECK" = "403" ]; then
        echo "✅ Route ${route} : OK (Code: $CHECK)"
    else
        echo "❌ Route ${route} : ERREUR (Code: $CHECK)"
    fi
done

echo "🏁 Vérification terminée"