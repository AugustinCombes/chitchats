# ChitChats - Rapid Deployment Guide

## 🚀 Quick Start (Under 1 Hour)

### Step 1: Supabase Setup (5 minutes)
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note down your:
   - **Project URL**: `https://[your-project-id].supabase.co`
   - **Anon/Public Key**: Found in Settings → API
   - **Service Role Key**: Found in Settings → API (for edge functions)

### Step 2: Configure Supabase Edge Function (5 minutes)
1. Link your local project to Supabase:
   ```bash
   supabase link --project-ref [your-project-id]
   ```

2. Set the Speechmatics API key secret:
   ```bash
   supabase secrets set SPEECHMATICS_API_KEY=[your-speechmatics-api-key]
   ```

3. Deploy the edge function:
   ```bash
   supabase functions deploy speechmatics-token
   ```

### Step 3: Deploy to Vercel (10 minutes)

#### Option A: Via Vercel Dashboard
1. Go to [vercel.com](https://vercel.com) and click "Import Project"
2. Import `github.com/AugustinCombes/chitchats`
3. Configure environment variables:
   - `SPEECHMATICS_API_KEY`: Your Speechmatics API key
   - `EXPO_PUBLIC_SUPABASE_URL`: Your Supabase project URL
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key

#### Option B: Via CLI
```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add SPEECHMATICS_API_KEY
vercel env add EXPO_PUBLIC_SUPABASE_URL
vercel env add EXPO_PUBLIC_SUPABASE_ANON_KEY
```

### Step 4: Test Your Deployment
1. Visit your Vercel URL: `https://chitchats.vercel.app`
2. Grant microphone permissions
3. Start recording and verify transcription works

## 🔧 Environment Variables

### For Vercel (Fallback - if not using Supabase)
- `SPEECHMATICS_API_KEY`: Your Speechmatics API key

### For Supabase Edge Functions (Recommended)
- `EXPO_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key

## 📊 Architecture

### Current Setup
```
Browser → Vercel (Static Hosting) → Supabase Edge Function → Speechmatics API
```

### Benefits
- **Static hosting on Vercel**: Fast, global CDN
- **Supabase Edge Functions**: Serverless, scalable JWT generation
- **Direct WebSocket to Speechmatics**: Low latency transcription

## 🧪 Local Development

```bash
# Start Expo dev server
npm start

# Run on web
npm run web

# Build for production
npm run build:web
```

## 🔍 Troubleshooting

### CORS Issues
Supabase Edge Functions have CORS configured. If you encounter issues:
1. Check the CORS headers in `/supabase/functions/speechmatics-token/index.ts`
2. Ensure your domain is allowed

### Speechmatics Connection Failed
1. Verify your API key is correct
2. Check browser console for detailed errors
3. Ensure microphone permissions are granted

### Deployment Failed
1. Check Vercel build logs
2. Verify all environment variables are set
3. Ensure `dist/` folder is not in `.gitignore`

## 🎯 Next Steps

### Adding Supabase Database
1. Create tables for conversation history
2. Store transcriptions with metadata
3. Add user authentication

### Adding Supabase MCP
Install the Supabase MCP for more autonomous database management:
```bash
npx @modelcontextprotocol/install-mcp supabase
```

## 📞 Support

- **GitHub Issues**: [github.com/AugustinCombes/chitchats/issues](https://github.com/AugustinCombes/chitchats/issues)
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)

---

**Ready to deploy in under 1 hour!** 🚀