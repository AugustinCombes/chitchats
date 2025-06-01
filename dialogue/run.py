#!/usr/bin/env python
"""
Convenience script to run the LiveKit dialogue agent
Usage:
    uv run run.py dev     # Run in development mode
    uv run run.py prod    # Run in production mode
    uv run run.py         # Default to dev mode
"""

import sys
import subprocess
import os

def main():
    # Default to dev mode if no argument provided
    mode = sys.argv[1] if len(sys.argv) > 1 else "dev"
    
    if mode not in ["dev", "prod", "start"]:
        print("Usage: uv run run.py [dev|prod]")
        print("  dev  - Run in development mode (default)")
        print("  prod - Run in production mode")
        sys.exit(1)
    
    # Map 'prod' to 'start' for the CLI command
    if mode == "prod":
        mode = "start"
    
    # Build the command
    cmd = [sys.executable, "main.py", mode]
    
    # Add any additional arguments passed to the script
    if len(sys.argv) > 2:
        cmd.extend(sys.argv[2:])
    
    print(f"Starting LiveKit dialogue agent in {mode} mode...")
    
    # Run the command
    try:
        subprocess.run(cmd, check=True)
    except KeyboardInterrupt:
        print("\nShutting down...")
    except subprocess.CalledProcessError as e:
        print(f"Error: Command failed with exit code {e.returncode}")
        sys.exit(e.returncode)

if __name__ == "__main__":
    main()