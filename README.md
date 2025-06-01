# Blablabla - Conversation Transcription App

A real-time conversation transcription app that uses speech-to-text with speaker diarization. Place your phone on the table during a conversation and see live transcriptions with different colors for each speaker.

## Architecture

- **Frontend**: Expo React Native app with LiveKit integration (direct connection to LiveKit Cloud)
- **Backend**: Python LiveKit agent using Speechmatics for speech recognition (runs independently)

## Setup

### Prerequisites

- Node.js and pnpm
- Python 3.8+
- LiveKit server instance
- Speechmatics API key

### Frontend Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Configure environment variables with your LiveKit Cloud credentials:
   ```bash
   export EXPO_PUBLIC_LIVEKIT_URL=wss://your-app.livekit.cloud
   export EXPO_PUBLIC_LIVEKIT_API_KEY=your-api-key
   export EXPO_PUBLIC_LIVEKIT_API_SECRET=your-api-secret
   ```
   
   You can get these from your LiveKit Cloud dashboard.

3. **Important: LiveKit requires a development build**
   
   The app uses LiveKit React Native SDK which contains native code. You cannot run this in Expo Go. You need to create a development build:

   **Option A - EAS Build (Recommended):**
   ```bash
   # Install EAS CLI globally
   npm install -g eas-cli
   
   # Login to Expo account
   eas login
   
   # Configure your project for EAS Build
   eas build:configure
   
   # Create a development build for iOS simulator/device
   eas build --profile development --platform ios
   
   # Or for Android
   eas build --profile development --platform android
   ```

   **Option B - Local Development Build:**
   ```bash
   # Generate native projects
   npx expo prebuild
   
   # For iOS (requires macOS with Xcode)
   npx expo run:ios
   
   # For Android (requires Android Studio)
   npx expo run:android
   ```

4. Start the development server:
   ```bash
   npx expo start --dev-client
   ```

### Backend Setup (LiveKit Agent)

1. Navigate to the dialogue directory:
   ```bash
   cd dialogue
   ```

2. Install Python dependencies:
   ```bash
   pip install uv
   uv pip install -r pyproject.toml
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your credentials:
   - `LIVEKIT_URL`: Your LiveKit Cloud URL (e.g., wss://your-app.livekit.cloud)
   - `LIVEKIT_API_KEY`: Your LiveKit API key
   - `LIVEKIT_API_SECRET`: Your LiveKit API secret
   - `SPEECHMATICS_API_KEY`: Your Speechmatics API key

4. Run the LiveKit agent:

   ```bash
   # Development mode (default)
   uv run python run.py
   
   # Or production mode:
   uv run python run.py prod
   ```

## Usage

1. Open the app on your device
2. Navigate to the "Conversation" tab
3. Tap "Start Recording" to begin transcription
4. Place the phone on the table during your conversation
5. Watch as the conversation is transcribed in real-time with different colors for each speaker
6. Tap "Stop Recording" when done

## Features

- Real-time speech-to-text transcription
- Speaker diarization (different colors for different speakers)
- WebSocket connection for live updates
- Audio recording with proper permissions handling
- Clean, intuitive UI

## Tech Stack

- **Frontend**: React Native, Expo, LiveKit SDK, TypeScript
- **Backend**: Python, FastAPI, LiveKit, Speechmatics
- **Real-time**: WebSockets, LiveKit data channels

## Development

The app consists of three main screens accessible via tabs:
- Home (existing chat interface)
- Explore (default Expo screen)
- Conversation (new transcription feature)

The conversation screen:
1. Generates JWT tokens locally (for POC - move to secure backend for production)
2. Creates LiveKit rooms dynamically
3. Publishes audio to the room

The Python agent:
1. Automatically joins any room created by the app
2. Processes audio through Speechmatics for transcription
3. Sends real-time transcriptions back via LiveKit data channels

### Web Development Mode

For quick testing in the browser without creating a development build:
- The app includes a `conversation.web.tsx` file that provides a demo mode
- This version shows the UI and WebSocket connectivity but doesn't capture actual audio
- It will display mock transcriptions to demonstrate the functionality
- Full audio capture and LiveKit integration requires a native development build

## iOS Configuration

For iOS development builds, you may need to:
1. Run `npx expo prebuild` to generate native iOS project
2. Open the iOS project in Xcode
3. Add the following to your Info.plist if not already present:
   - Camera usage description (if using video in the future)
   - Microphone usage description (already configured in app.json)

## Android Configuration

Android permissions are already configured in app.json. The app will request microphone permission at runtime.