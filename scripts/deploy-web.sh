#!/bin/bash

echo "🚀 Building Expo web app..."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Build the web app
echo "🔨 Building for production..."
npx expo export --platform web

echo "✅ Build complete! Files are in the 'dist' directory."
echo ""
echo "📌 Next steps to deploy:"
echo "1. Push your code to GitHub"
echo "2. Connect your repo to Vercel (vercel.com)"
echo "3. Add these environment variables in Vercel dashboard:"
echo "   - EXPO_PUBLIC_LIVEKIT_URL"
echo "   - EXPO_PUBLIC_LIVEKIT_API_KEY"
echo "   - EXPO_PUBLIC_LIVEKIT_API_SECRET"
echo "4. Deploy!"