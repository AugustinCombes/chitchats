#!/bin/bash

echo "🧪 Testing GitHub Pages build locally..."

# Set the base path (replace with your actual GitHub repo name)
export EXPO_PUBLIC_BASE_PATH="/blablabla/"

# Build the app
echo "🔨 Building with base path: $EXPO_PUBLIC_BASE_PATH"
npx expo export --platform web

# Fix the paths
echo "🔧 Fixing asset paths..."
node scripts/fix-base-path.js

# Install serve if not present
if ! command -v serve &> /dev/null; then
    echo "📦 Installing serve..."
    npm install -g serve
fi

# Serve the dist directory
echo "🚀 Starting local server..."
echo "📌 Open http://localhost:3000/blablabla/ in your browser"
echo "   (Note the /blablabla/ at the end - this simulates GitHub Pages)"
serve dist -p 3000