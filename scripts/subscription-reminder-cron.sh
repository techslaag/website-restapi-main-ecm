#!/bin/bash

# Script pour déclencher le cron de rappel d'abonnement
# Ce script appelle directement l'API de votre application

echo "Demarrage du cron de rappel d'abonnement..."

# Configuration des URLs selon l'environnement
if [ "$CI_COMMIT_REF_NAME" = "main" ]; then
    API_URL="https://api.ecomatin.be"
    echo "Environnement: PRODUCTION"
elif [ "$CI_COMMIT_REF_NAME" = "testing" ]; then
    API_URL="https://testing-api.ecomatin.be"
    echo "Environnement: TESTING"
else
    echo "Environnement non reconnu: $CI_COMMIT_REF_NAME"
    exit 1
fi

# URL complète de l'endpoint
CRON_ENDPOINT="${API_URL}/api/cron/subscription-reminder"
echo "URL cible: $CRON_ENDPOINT"

# Appel de l'API avec timeout et retry
echo "Appel de l'API..."
RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" --max-time 30 "$CRON_ENDPOINT")

# Extraction du code de statut HTTP
HTTP_STATUS=$(echo $RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
RESPONSE_BODY=$(echo $RESPONSE | sed -e 's/HTTPSTATUS:.*//g')

echo "Code de reponse: $HTTP_STATUS"
echo "Reponse: $RESPONSE_BODY"

# Vérification du résultat
if [ "$HTTP_STATUS" -eq 200 ]; then
    echo "Cron execute avec succes!"
    
    # Essayer d'extraire le nombre de rappels envoyés
    REMINDERS_SENT=$(echo "$RESPONSE_BODY" | grep -o '"remindersSent":[0-9]*' | cut -d':' -f2)
    if [ ! -z "$REMINDERS_SENT" ]; then
        echo "Nombre de rappels envoyes: $REMINDERS_SENT"
    fi
    
    exit 0
else
    echo "Erreur lors de l'execution du cron (Code: $HTTP_STATUS)"
    echo "Verifiez que l'application est demarree et accessible"
    exit 1
fi