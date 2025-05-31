import os
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from livekit import api
from dotenv import load_dotenv
import logging

load_dotenv()

app = FastAPI()
logger = logging.getLogger("dialogue-api")

# Configure CORS for Expo app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your Expo app URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# LiveKit API client
livekit_api = api.LiveKitAPI(
    os.getenv('LIVEKIT_URL'),
    os.getenv('LIVEKIT_API_KEY'),
    os.getenv('LIVEKIT_API_SECRET')
)


@app.post("/api/create-room")
async def create_room():
    """Create a new LiveKit room for conversation"""
    room_name = f"conversation-{os.urandom(4).hex()}"
    
    # Create room
    room = await livekit_api.room.create_room(
        api.CreateRoomRequest(name=room_name)
    )
    
    # Generate access token for the mobile client
    token = api.AccessToken(
        os.getenv('LIVEKIT_API_KEY'),
        os.getenv('LIVEKIT_API_SECRET')
    ).with_identity(
        f"mobile-{os.urandom(4).hex()}"
    ).with_name(
        "Mobile User"
    ).with_grants(
        api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True
        )
    ).to_jwt()
    
    return {
        "room_name": room_name,
        "token": token,
        "url": os.getenv('LIVEKIT_URL')
    }


@app.websocket("/ws/{room_name}")
async def websocket_endpoint(websocket: WebSocket, room_name: str):
    """WebSocket endpoint for real-time transcription updates"""
    await websocket.accept()
    
    # Store connected clients per room
    if not hasattr(app.state, 'room_clients'):
        app.state.room_clients = {}
    
    if room_name not in app.state.room_clients:
        app.state.room_clients[room_name] = []
    
    app.state.room_clients[room_name].append(websocket)
    
    try:
        while True:
            # Keep connection alive and relay messages
            data = await websocket.receive_text()
            
            # Broadcast to all clients in the same room
            for client in app.state.room_clients[room_name]:
                if client != websocket:
                    await client.send_text(data)
                    
    except WebSocketDisconnect:
        app.state.room_clients[room_name].remove(websocket)
        if not app.state.room_clients[room_name]:
            del app.state.room_clients[room_name]


@app.get("/api/conversation/{room_name}/transcript")
async def get_transcript(room_name: str):
    """Get the full transcript for a conversation"""
    # This would typically fetch from a database
    # For now, return a placeholder
    return {
        "room_name": room_name,
        "transcript": [],
        "message": "Transcript storage not yet implemented"
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)