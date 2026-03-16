#!/bin/bash
# Script pour nettoyer les secrets du Git history
# Utilise git-filter-repo si disponible

echo "🔍 Scanning pour les secrets dans le Git history..."

# Installation de git-filter-repo si nécessaire
if ! command -v git-filter-repo &> /dev/null; then
    echo "Installation de git-filter-repo..."
    pip3 install git-filter-repo
fi

# Créer un fichier temporaire avec les patterns à supprimer
cat > /tmp/secrets-patterns.txt << 'EOF'
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=whsec_
FIREBASE_SERVICE_ACCOUNT_JSON=
GOOGLE_OAUTH_CLIENT_SECRET=
VITE_FIREBASE_API_KEY=
privateKey=
EOF

echo "🔐 Suppression des secrets du history..."
git filter-repo --replace-text /tmp/secrets-patterns.txt

echo "✅ Secrets supprimés du history"
echo "⚠️  IMPORTANT: Exécute 'git push --force' pour mettre à jour le repo distant"
echo "⚠️  CONSEIL: Régénère tous les secrets compromis dans Stripe, Firebase, Google OAuth"

rm /tmp/secrets-patterns.txt
