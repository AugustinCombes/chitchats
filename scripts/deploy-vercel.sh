#!/bin/bash

# Vercel Deployment Script for Speechmatics Migration
# This script handles environment setup and deployment to Vercel

set -e

echo "🚀 Starting Vercel deployment for Speechmatics migration..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel@latest
fi

# Ensure we're in the project root
cd "$(dirname "$0")/.."

# Build the web application
echo "🏗️ Building web application..."
npm run build:web

# Set up environment variables (if not already configured)
echo "🔧 Configuring environment variables..."

# Check if secrets are already configured
if ! vercel env ls --scope=production | grep -q "JWT_SECRET_KEY"; then
    echo "Setting up production environment variables..."
    
    # Generate a secure JWT secret if not provided
    if [ -z "$JWT_SECRET_KEY" ]; then
        JWT_SECRET_KEY=$(openssl rand -base64 32)
        echo "Generated JWT_SECRET_KEY"
    fi
    
    # Set environment variables
    echo "$JWT_SECRET_KEY" | vercel env add JWT_SECRET_KEY production
    
    if [ -n "$SPEECHMATICS_API_KEY" ]; then
        echo "$SPEECHMATICS_API_KEY" | vercel env add SPEECHMATICS_API_KEY production
    else
        echo "⚠️  SPEECHMATICS_API_KEY not set. Please configure it manually:"
        echo "   vercel env add SPEECHMATICS_API_KEY production"
    fi
    
    if [ -n "$ALLOWED_ORIGINS" ]; then
        echo "$ALLOWED_ORIGINS" | vercel env add ALLOWED_ORIGINS production
    else
        echo "*" | vercel env add ALLOWED_ORIGINS production
        echo "⚠️  Set ALLOWED_ORIGINS to restrict CORS to specific domains"
    fi
fi

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
vercel --prod

echo "✅ Deployment completed!"
echo ""
echo "🔗 Your endpoints will be available at:"
echo "   https://your-project.vercel.app/api/speechmatics-token"
echo "   https://your-project.vercel.app/api/health"
echo ""
echo "🔧 Next steps:"
echo "1. Test the health endpoint to verify configuration"
echo "2. Update your frontend to use the new token endpoint"
echo "3. Configure monitoring and alerting"
echo ""
echo "📚 For more information, see the deployment documentation."