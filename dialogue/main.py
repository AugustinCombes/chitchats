import asyncio
import logging
import os
from livekit import rtc
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli
from dotenv import load_dotenv
import json
import speechmatics
from speechmatics.models import ConnectionSettings, TranscriptionConfig, AudioSettings
import threading
import queue
import io

load_dotenv()

logger = logging.getLogger("dialogue")
logger.setLevel(logging.INFO)  # Less verbose logging

# Set speechmatics to INFO to avoid AudioAdded spam
logging.getLogger("speechmatics").setLevel(logging.INFO)

# Check for required environment variables
if not os.getenv("SPEECHMATICS_API_KEY"):
    logger.error("SPEECHMATICS_API_KEY environment variable is not set!")
    logger.error("Please create a .env file with your Speechmatics API key")
    logger.error("See .env.example for the required format")


async def entrypoint(ctx: JobContext):
    logger.info(f"Agent session started for room: {ctx.room.name}")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    
    # Store messages by speaker
    speaker_messages = {}
    
    # Get the current event loop to use from threads
    main_loop = asyncio.get_running_loop()
    
    # Create a queue for audio data
    audio_queue = queue.Queue()
    
    # We'll create the client later when we start streaming
    
    # Configure transcription with speaker diarization
    conf = TranscriptionConfig(
        language="en",
        diarization="speaker",
        enable_partials=True,
        max_delay=2,
        operating_point="enhanced",  # Better accuracy
    )
    
    # Audio settings for real-time streaming
    audio_settings = AudioSettings(
        encoding="pcm_s16le",
        sample_rate=16000,
        chunk_size=1024,
    )
    
    
    # Event handlers for Speechmatics
    def on_final_transcript(msg):
        try:
            logger.info(f"Raw transcript: {msg}")
            
            # Try to extract results from different possible structures
            results = None
            if isinstance(msg, dict):
                logger.debug(f"Message keys: {list(msg.keys())}")
                if 'results' in msg:
                    results = msg['results']
                    logger.debug(f"Found results in msg['results']: {results}")
                elif 'metadata' in msg and 'results' in msg['metadata']:
                    results = msg['metadata']['results']
                    logger.debug(f"Found results in msg['metadata']['results']: {results}")
                else:
                    # Maybe the message itself is a result
                    results = [msg]
                    logger.debug(f"Using msg as single result: {results}")
            
            if results:
                logger.debug(f"Processing {len(results)} results")
                for i, result in enumerate(results):
                    logger.debug(f"Result {i}: {result}")
                    alternatives = result.get('alternatives', [])
                    if alternatives:
                        text = alternatives[0].get('content', '')
                        speaker = alternatives[0].get('speaker', 'unknown')
                        start_time = result.get('start_time', 0.0)
                        
                        logger.debug(f"Extracted: text='{text}', speaker='{speaker}', time={start_time}")
                        
                        if text.strip():
                            if speaker not in speaker_messages:
                                speaker_messages[speaker] = []
                            
                            speaker_messages[speaker].append({
                                'text': text,
                                'timestamp': start_time
                            })
                            
                            logger.info(f"🎤 Speaker {speaker}: {text}")
                            
                            # Send to frontend - we need to schedule this in the event loop
                            message_data = {
                                'type': 'transcription',
                                'speaker': speaker,
                                'text': text,
                                'timestamp': start_time
                            }
                            
                            logger.info(f"Sending to frontend: {message_data}")
                            
                            # Schedule the coroutine in the main event loop
                            try:
                                future = asyncio.run_coroutine_threadsafe(
                                    ctx.room.local_participant.publish_data(
                                        json.dumps(message_data).encode('utf-8'),
                                        reliable=True
                                    ),
                                    main_loop
                                )
                                logger.debug(f"Scheduled message send, future: {future}")
                            except Exception as ex:
                                logger.error(f"Could not send message to frontend: {ex}")
                                import traceback
                                logger.error(traceback.format_exc())
            else:
                logger.warning(f"No results found in message: {msg}")
        except Exception as e:
            logger.error(f"Error processing transcript: {e}")
            logger.error(f"Message structure: {msg}")
            import traceback
            logger.error(traceback.format_exc())
    
    # Create a file-like audio stream
    class AudioStream:
        def __init__(self, audio_queue):
            self.audio_queue = audio_queue
            self.buffer = b''
            self._closed = False
            
        def readable(self):
            return True
            
        def read(self, size=-1):
            if self._closed:
                return b''
                
            # Try to accumulate data
            while len(self.buffer) < 4096:  # Buffer some data
                try:
                    data = self.audio_queue.get(timeout=0.1)
                    if data is None:  # Sentinel to close
                        self._closed = True
                        break
                    self.buffer += data
                    # logger.debug(f"AudioStream: received {len(data)} bytes, buffer now {len(self.buffer)} bytes")
                except queue.Empty:
                    if len(self.buffer) > 0:
                        break  # Return what we have
                    continue
                    
            if size == -1 or size >= len(self.buffer):
                result = self.buffer
                self.buffer = b''
            else:
                result = self.buffer[:size]
                self.buffer = self.buffer[size:]
                
            # logger.debug(f"AudioStream: returning {len(result)} bytes")
            return result
            
        @property
        def closed(self):
            return self._closed
    
    audio_stream = AudioStream(audio_queue)
    sm_client = None  # Store client reference for cleanup
    
    # Start Speechmatics in a thread
    def run_speechmatics():
        nonlocal sm_client
        try:
            logger.info("Starting Speechmatics client...")
            
            # Create client
            sm_client = speechmatics.client.WebsocketClient(
                ConnectionSettings(
                    url="wss://eu2.rt.speechmatics.com/v2",
                    auth_token=os.getenv("SPEECHMATICS_API_KEY"),
                )
            )
            
            # Register event handlers
            sm_client.add_event_handler(
                event_name=speechmatics.models.ServerMessageType.AddTranscript,
                event_handler=on_final_transcript,
            )
            
            # sm_client.add_event_handler(
            #     event_name=speechmatics.models.ServerMessageType.AddPartialTranscript,
            #     event_handler=lambda msg: logger.debug(f"Partial transcript: {msg}"),
            # )
            
            # Add recognition started handler
            def on_recognition_started(msg):
                logger.info(f"Recognition started: {msg}")
                
            sm_client.add_event_handler(
                event_name=speechmatics.models.ServerMessageType.RecognitionStarted,
                event_handler=on_recognition_started,
            )
            
            logger.info("Running Speechmatics client with audio stream...")
            # Run synchronously with the audio stream
            sm_client.run_synchronously(audio_stream, conf, audio_settings)
            
        except Exception as e:
            logger.error(f"Speechmatics error: {e}")
            import traceback
            logger.error(traceback.format_exc())
        finally:
            # Ensure the client is closed
            if sm_client:
                try:
                    logger.info("Closing Speechmatics client...")
                    # The client should auto-close, but let's be explicit
                except Exception as e:
                    logger.error(f"Error closing Speechmatics client: {e}")
    
    # Subscribe to all audio tracks
    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track: rtc.Track, publication: rtc.TrackPublication, participant: rtc.RemoteParticipant):
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            logger.info(f"Audio track subscribed from {participant.identity}")
            asyncio.create_task(process_audio_track(track, audio_queue))
    
    # Process existing tracks
    for participant in ctx.room.remote_participants.values():
        for publication in participant.track_publications.values():
            if publication.track and publication.track.kind == rtc.TrackKind.KIND_AUDIO:
                logger.info(f"Processing existing audio track from {participant.identity}")
                asyncio.create_task(process_audio_track(publication.track, audio_queue))
    
    # Start the Speechmatics thread
    speechmatics_thread = threading.Thread(target=run_speechmatics)
    speechmatics_thread.start()
    
    # Keep the agent running
    try:
        await asyncio.Future()  # Run forever
    except asyncio.CancelledError:
        logger.info("Agent cancelled")
    finally:
        # Cleanup
        audio_queue.put(None)  # Signal to close the stream
        speechmatics_thread.join(timeout=5)
        logger.info("Agent session ended")


async def process_audio_track(track: rtc.Track, audio_queue: queue.Queue):
    """Process audio track and send to Speechmatics"""
    try:
        logger.info(f"Starting to process audio track: {track}")
        
        # Create audio stream with specific sample rate and channels
        audio_stream = rtc.AudioStream(
            track,
            sample_rate=16000,  # Speechmatics expects 16kHz
            num_channels=1      # Mono audio
        )
        
        frame_count = 0
        async for frame_event in audio_stream:
            # Convert frame to bytes and put in queue
            audio_data = frame_event.frame.data.tobytes()
            audio_queue.put(audio_data)
            frame_count += 1
            
            # if frame_count % 100 == 0:  # Log every 100 frames
            #     logger.debug(f"Processed {frame_count} audio frames, latest frame: {len(audio_data)} bytes")
                
    except Exception as e:
        logger.error(f"Error processing audio track: {e}")
        import traceback
        logger.error(traceback.format_exc())


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))