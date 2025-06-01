# Dialogue Service

Python service for real-time conversation transcription using LiveKit and Speechmatics.

## Setup

1. **Install dependencies:**
   ```bash
   cd dialogue
   pip install uv
   uv pip install -r pyproject.toml
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your credentials:
   - `LIVEKIT_URL`: Your LiveKit server URL
   - `LIVEKIT_API_KEY`: Your LiveKit API key
   - `LIVEKIT_API_SECRET`: Your LiveKit API secret
   - `SPEECHMATICS_API_KEY`: Your Speechmatics API key

3. **Run the services:**

   Start both services in separate terminals:

   ```bash
   # Terminal 1: Start API server
   uv run python run_api.py

   # Terminal 2: Start LiveKit agent (defaults to dev mode)
   uv run python run.py         # Development mode
   uv run python run.py dev     # Development mode (explicit)
   uv run python run.py prod    # Production mode
   ```

   **Alternative: Direct Speechmatics Integration (with speaker diarization)**
   
   For proper speaker diarization support, use the direct Speechmatics implementation:
   ```bash
   # Terminal 2: LiveKit agent with direct Speechmatics
   uv run python run_direct.py         # Development mode
   uv run python run_direct.py dev     # Development mode (explicit)
   uv run python run_direct.py prod    # Production mode
   ```

   Or run directly without the convenience scripts:
   ```bash
   # Terminal 1: API server
   uv run python api_server.py

   # Terminal 2: LiveKit agent
   uv run python main.py dev    # Development mode (plugin version)
   uv run python main_direct.py dev    # Development mode (direct version with speaker diarization)
   uv run python main.py start  # Production mode
   ```

   The `run.py` and `run_direct.py` scripts are convenience wrappers that:
   - Default to development mode if no argument is provided
   - Map 'prod' to the 'start' command for production mode
   - Handle keyboard interrupts gracefully

## Architecture

- **api_server.py**: FastAPI server providing REST endpoints and WebSocket connections for the mobile app
- **main.py**: LiveKit agent using the LiveKit Speechmatics plugin (limited speaker diarization support)
- **main_direct.py**: LiveKit agent using direct Speechmatics WebSocket API (full speaker diarization support)
- **speechmatics_direct.py**: Direct WebSocket client for Speechmatics API with complete feature support

## API Endpoints

- `POST /api/create-room`: Creates a new LiveKit room for conversation recording
- `WS /ws/{room_name}`: WebSocket endpoint for real-time transcription updates
- `GET /api/conversation/{room_name}/transcript`: Get the full transcript (placeholder for now)

## How it works

1. Mobile app requests a new room via the API
2. API creates a LiveKit room and returns connection credentials
3. Mobile app connects to LiveKit and starts publishing audio
4. LiveKit agent receives audio streams and sends them to Speechmatics
5. Speechmatics returns transcriptions with speaker diarization
6. Agent sends transcriptions back to mobile app via LiveKit data channels

### Speaker Diarization

When using the direct implementation (`main_direct.py`), Speechmatics will automatically detect different speakers in the conversation and label them as "S1", "S2", "S3", etc. The speaker labels are consistent throughout the conversation, so "S1" will always refer to the same person.