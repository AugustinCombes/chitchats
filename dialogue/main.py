import asyncio
import logging
from livekit import rtc
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli, llm
from livekit.agents.transcription import STTSegmentsForwarder
from livekit.plugins import speechmatics
from dotenv import load_dotenv
import json

load_dotenv()

logger = logging.getLogger("dialogue")
logger.setLevel(logging.INFO)


async def entrypoint(ctx: JobContext):
    logger.info(f"Agent session started for room: {ctx.room.name}")
    
    # Configure Speechmatics STT with diarization
    stt = speechmatics.STT(
        transcription_config=speechmatics.types.TranscriptionConfig(
            operating_point="enhanced",
            enable_partials=True,
            language="en",
            output_locale="en-US",
            diarization="speaker",
            enable_entities=True,
            additional_vocab=[
                {
                    "content": "financial crisis"
                },
                {
                    "content": "gnocchi",
                    "sounds_like": [
                        "nyohki",
                        "nokey",
                        "nochi"
                    ]
                },
                {
                    "content": "CEO",
                    "sounds_like": [
                        "C.E.O."
                    ]
                }
            ],
            max_delay=0.7,
            max_delay_mode="flexible"
        ),
        audio_settings=speechmatics.types.AudioSettings(
            encoding="pcm_s16le",
            sample_rate=16000,
        ),
    )
    
    # Forward transcription segments to the room
    stt_forwarder = STTSegmentsForwarder(
        room=ctx.room,
        participant=await ctx.room.local_participant,
        track=rtc.LocalAudioTrack.create_audio_track("dialogue-stt")
    )
    
    # Start STT forwarder
    stt_stream = stt.stream()
    stt_forwarder.forward(stt_stream)
    
    # Track speaker messages
    speaker_messages = {}
    
    async def process_speech():
        async for event in stt_stream:
            if event.is_final:
                # Extract speaker info from metadata if available
                speaker_id = "unknown"
                if hasattr(event, 'alternatives') and event.alternatives:
                    # Speechmatics may include speaker info in metadata
                    speaker_id = getattr(event.alternatives[0], 'speaker', 'unknown')
                
                text = event.alternatives[0].text if event.alternatives else ""
                
                if speaker_id not in speaker_messages:
                    speaker_messages[speaker_id] = []
                
                speaker_messages[speaker_id].append({
                    'text': text,
                    'timestamp': event.start_time
                })
                
                logger.info(f"Speaker {speaker_id}: {text}")
                
                # Send to frontend via data channel
                message_data = {
                    'type': 'transcription',
                    'speaker': speaker_id,
                    'text': text,
                    'timestamp': event.start_time
                }
                
                await ctx.room.local_participant.publish_data(
                    json.dumps(message_data).encode('utf-8'),
                    reliable=True
                )
    
    # Start processing speech in background
    asyncio.create_task(process_speech())
    
    # Subscribe to all audio tracks
    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track: rtc.Track, publication: rtc.TrackPublication, participant: rtc.RemoteParticipant):
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            logger.info(f"Audio track subscribed from {participant.identity}")
            asyncio.create_task(process_audio_track(track, stt_stream))
    
    # Process existing tracks
    for participant in ctx.room.remote_participants.values():
        for publication in participant.track_publications.values():
            if publication.track and publication.track.kind == rtc.TrackKind.KIND_AUDIO:
                asyncio.create_task(process_audio_track(publication.track, stt_stream))


async def process_audio_track(track: rtc.Track, stt_stream):
    """Process audio track and send to STT"""
    audio_stream = rtc.AudioStream(track)
    async for frame in audio_stream:
        await stt_stream.push_frame(frame)


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            auto_subscribe=AutoSubscribe.AUDIO_ONLY,
        )
    )