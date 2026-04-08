#!/bin/bash

echo "🚀 Bank Reconciliation App - Vercel Deployment"
echo "=================================================="
echo ""

# Step 1: Check if Vercel CLI is installed
echo "Step 1: Checking Vercel CLI..."
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
    echo "✓ Vercel CLI installed"
else
    echo "✓ Vercel CLI already installed"
    vercel --version
fi

echo ""

# Step 2: Login to Vercel
echo "Step 2: Logging in to Vercel..."
vercel login

echo ""

# Step 3: Deploy to Vercel
echo "Step 3: Deploying to Vercel..."
cd "$(dirname "$0")"
vercel --prod

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Your app is now live on Vercel! 🎉"
echo ""
