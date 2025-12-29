#!/bin/bash

# Script pour mettre à jour le pricing premium à 9.9€/mois
# Usage: ./package-scripts/update-pricing.sh

echo "🚀 Mise à jour du pricing EcoMatin Premium à 9.9€/mois"
echo "=================================================="

# Vérifier que Node.js et npm sont installés
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé"
    exit 1
fi

# Vérifier que Prisma est installé
if ! command -v npx &> /dev/null; then
    echo "❌ npx n'est pas disponible"
    exit 1
fi

echo "📦 Installation des dépendances..."
npm install

echo "🔄 Génération du client Prisma..."
npx prisma generate

echo "💾 Exécution de la migration de pricing..."
node scripts/update-premium-pricing.js

echo ""
echo "✅ Mise à jour terminée !"
echo ""
echo "🎯 Actions suivantes recommandées:"
echo "1. Vérifier les plans sur http://localhost:3400/offers"
echo "2. Tester le processus d'abonnement"
echo "3. Vérifier l'essai gratuit 7 jours"
echo ""
echo "💡 Prix configuré: 9.9€/mois - 99€/an (économie de ~17%)"