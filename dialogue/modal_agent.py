import modal
import os
from pathlib import Path

# Create Modal app
app = modal.App("livekit-dialogue-agent")

# Create secrets reference (using existing secrets with EXPO_PUBLIC_ prefix)
secrets = [
    modal.Secret.from_name("livekit-secrets"),  # Contains EXPO_PUBLIC_LIVEKIT_*
    modal.Secret.from_name("speechmatics-secrets"),  # Contains SPEECHMATICS_API_KEY
]

# Define the image with Poetry dependencies
image = (
    modal.Image.debian_slim(python_version="3.12")
    .poetry_install_from_file(
        poetry_pyproject_toml=Path(__file__).parent / "pyproject.toml",
        poetry_lockfile=Path(__file__).parent / "poetry.lock"
    )
    .add_local_file(
        local_path=Path(__file__).parent / "main.py",
        remote_path="/app/main.py"
    )
)

# Global variable to track agent status
agent_ready = False

@app.function(
    image=image,
    secrets=secrets,
    cpu=1,
    memory=1024,
    timeout=0,  # Run indefinitely
    container_idle_timeout=30,  # Keep container alive for 30 seconds after last request
    keep_warm=1,  # Keep one instance always running
)
def run_livekit_agent():
    """Run the LiveKit agent and return when ready"""
    global agent_ready
    import subprocess
    import threading
    import time
    
    print("Starting LiveKit agent...")
    os.chdir("/app")
    
    # Start the LiveKit agent in a background thread
    def run_agent():
        import sys
        global agent_ready
        print("Starting LiveKit agent in dev mode...")
        print(f"Environment variables:")
        print(f"  EXPO_PUBLIC_LIVEKIT_URL: {os.environ.get('EXPO_PUBLIC_LIVEKIT_URL', 'NOT SET')}")
        print(f"  EXPO_PUBLIC_LIVEKIT_API_KEY: {os.environ.get('EXPO_PUBLIC_LIVEKIT_API_KEY', 'NOT SET')}")
        print(f"  EXPO_PUBLIC_LIVEKIT_API_SECRET: {'SET' if os.environ.get('EXPO_PUBLIC_LIVEKIT_API_SECRET') else 'NOT SET'}")
        print(f"  SPEECHMATICS_API_KEY: {'SET' if os.environ.get('SPEECHMATICS_API_KEY') else 'NOT SET'}")
        
        # Map EXPO_PUBLIC_ variables to what LiveKit expects
        livekit_env = os.environ.copy()
        livekit_env['LIVEKIT_URL'] = os.environ.get('EXPO_PUBLIC_LIVEKIT_URL', '')
        livekit_env['LIVEKIT_API_KEY'] = os.environ.get('EXPO_PUBLIC_LIVEKIT_API_KEY', '')
        livekit_env['LIVEKIT_API_SECRET'] = os.environ.get('EXPO_PUBLIC_LIVEKIT_API_SECRET', '')
        
        print(f"Mapped to LiveKit format:")
        print(f"  LIVEKIT_URL: {livekit_env.get('LIVEKIT_URL', 'NOT SET')}")
        print(f"  LIVEKIT_API_KEY: {livekit_env.get('LIVEKIT_API_KEY', 'NOT SET')}")
        print(f"  LIVEKIT_API_SECRET: {'SET' if livekit_env.get('LIVEKIT_API_SECRET') else 'NOT SET'}")
        
        # Create a process so we can monitor its output
        process = subprocess.Popen(
            [sys.executable, "main.py", "dev"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1,
            env=livekit_env  # Pass the mapped environment variables
        )
        
        # Monitor output to detect when agent is ready
        for line in process.stdout:
            print(f"[Agent] {line.strip()}")
            # Look for signs that the agent is connected and working
            if ("registered worker" in line.lower() or 
                "agent connected with language" in line.lower() or
                "transcription config created" in line.lower()):
                agent_ready = True
                print("✅ Agent is ready and connected to LiveKit!")
        
        process.wait()
    
    agent_thread = threading.Thread(target=run_agent, daemon=True)
    agent_thread.start()
    
    # Wait for agent to be ready (max 15 seconds)
    start_time = time.time()
    while not agent_ready and time.time() - start_time < 15:
        time.sleep(0.1)
    
    if agent_ready:
        print("LiveKit agent is ready and waiting for rooms!")
        # Keep the function running to maintain the agent
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("Agent shutting down...")
    else:
        print("Warning: Agent may not be fully ready yet")
        raise Exception("Agent failed to start properly")

@app.function(
    image=image,
    secrets=secrets,
    timeout=20,
)
@modal.web_endpoint(method="GET")
def ensure_agent_running():
    """Endpoint to wake up the agent container if needed"""
    try:
        # Try to spawn the agent (will reuse existing if already running)
        agent_handle = run_livekit_agent.spawn()
        
        # Give it a moment to start up
        import time
        time.sleep(2)
        
        return {
            "status": "Agent container is running",
            "agent_info": {"ready": True, "handle": str(agent_handle)},
            "message": "LiveKit agent is ready to handle speech-to-text"
        }
    except Exception as e:
        return {
            "status": "error",
            "agent_info": {"ready": False, "error": str(e)},
            "message": f"Failed to start agent: {str(e)}"
        }

@app.local_entrypoint()
def main():
    """Deploy the app"""
    print("Deploying LiveKit agent to Modal...")
    print("\nAfter deployment, your frontend can call the endpoint to ensure the agent is running.")
    print("The agent will automatically stop after 30 seconds of no activity.")