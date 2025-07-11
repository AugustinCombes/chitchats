# Deploying LiveKit Agent to Modal

## Prerequisites
1. Install Modal CLI: `pip install modal`
2. Authenticate: `modal setup`

## Set up Modal Secrets

Create two secrets in Modal dashboard or CLI:

### 1. livekit-secrets
```bash
modal secret create livekit-secrets \
  LIVEKIT_URL="wss://blablabla-2uvt2khr.livekit.cloud" \
  LIVEKIT_API_KEY="API5h5RgjK5ChQH" \
  LIVEKIT_API_SECRET="f0bzdG4AXy9OWF3VtfDyHpUzlZSIy7UGMwd4RuftSzJA"
```

### 2. speechmatics-secrets
```bash
modal secret create speechmatics-secrets \
  SPEECHMATICS_API_KEY="your-speechmatics-api-key"
```

Note: The SPEECHMATICS_API_KEY is required - it's used directly in your code (main.py:24)

## Deploy the Agent

```bash
cd dialogue/
modal deploy modal_agent.py
```

## Run the Agent

After deployment, Modal will give you a URL for your function. The agent will:
- Stay running and listening for LiveKit room events
- Auto-scale based on load
- Keep one warm instance ready

## Monitor

View logs:
```bash
modal logs -f livekit-dialogue-agent
```

## Future GPU Support

When you're ready to use GPU models, update the function decorator:
```python
@app.function(
    gpu="T4",  # or "A10G", "A100", etc.
    # ... rest of config
)
```