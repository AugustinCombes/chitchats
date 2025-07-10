# Deploying to GitHub Pages

## Setup Steps

1. **Enable GitHub Pages in your repo:**
   - Go to Settings → Pages
   - Source: Deploy from a branch
   - Branch: gh-pages (will be created automatically)

2. **Add GitHub Secrets:**
   - Go to Settings → Secrets and variables → Actions
   - Add these secrets:
     - `EXPO_PUBLIC_LIVEKIT_URL`: Your LiveKit Cloud URL
     - `EXPO_PUBLIC_LIVEKIT_API_KEY`: Your LiveKit API Key
     - `EXPO_PUBLIC_LIVEKIT_API_SECRET`: Your LiveKit API Secret

3. **Deploy:**
   - Push to main branch, or
   - Go to Actions tab → Deploy to GitHub Pages → Run workflow

Your app will be available at: `https://[username].github.io/[repo-name]/`

## Manual Deployment

```bash
# Install gh-pages if not already installed
npm install

# Build and deploy
npm run deploy:gh-pages
```

## Important Notes

- The app uses client-side token generation (not secure for production)
- For production, create a backend API to generate LiveKit tokens
- GitHub Pages is public - your app will be accessible to anyone
- Make sure LiveKit credentials are set as GitHub Secrets (not Variables)
- Test deployment with updated secrets
- Secrets must be created as 3 separate repository secrets