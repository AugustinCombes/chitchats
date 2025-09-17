import { useState, useCallback, useRef } from 'react';

// Only import polyfill for React Native
if (typeof window === 'undefined') {
  require('event-target-polyfill');
}

interface TranscriptionMessage {
  speaker: string;
  text: string;
  timestamp: number;
  color?: string;
}

interface TranscriptionConfig {
  language: string;
  enablePartials?: boolean;
  speakerDiarization?: boolean;
}

export const useSpeechmaticsTranscription = () => {
  const [messages, setMessages] = useState<TranscriptionMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const jwtRef = useRef<string | null>(null);

  const handleTranscript = (message: any) => {
    try {
      const transcript = message.metadata || message;
      const results = transcript.transcript?.results || transcript.results || [];
      
      results.forEach((result: any) => {
        const alternatives = result.alternatives || [];
        if (alternatives.length > 0) {
          const { content, speaker = 'unknown' } = alternatives[0];
          const startTime = result.start_time || Date.now() / 1000;
          
          if (content && content.trim()) {
            setMessages(prev => {
              const newMessage: TranscriptionMessage = {
                speaker,
                text: content.trim(),
                timestamp: startTime
              };
              
              // Merge consecutive messages from same speaker within 2 seconds
              if (prev.length > 0) {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage.speaker === speaker && 
                    (startTime - lastMessage.timestamp) < 2) {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...lastMessage,
                    text: lastMessage.text + ' ' + content.trim(),
                    timestamp: startTime
                  };
                  return updated;
                }
              }
              
              return [...prev, newMessage];
            });
          }
        }
      });
    } catch (err) {
      console.error('Error processing transcript:', err);
    }
  };

  const connect = useCallback(async (config: TranscriptionConfig) => {
    try {
      setError(null);
      
      // Determine which endpoint to use based on environment
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      
      let tokenEndpoint = '/api/speechmatics-token'; // Default Vercel endpoint
      let headers: any = { 'Content-Type': 'application/json' };
      
      // If Supabase is configured, use Supabase Edge Function
      if (supabaseUrl && supabaseAnonKey) {
        tokenEndpoint = `${supabaseUrl}/functions/v1/speechmatics-token`;
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        };
      }
      
      // Get JWT from serverless function
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          type: 'rt',
          language: config.language,
          ttl: 3600 
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to get authentication token');
      }
      
      const { jwt } = await response.json();
      jwtRef.current = jwt;
      
      // Connect to Speechmatics WebSocket
      const wsUrl = 'wss://eu2.rt.speechmatics.com/v2';
      wsRef.current = new WebSocket(wsUrl, [], {
        headers: {
          'Authorization': `Bearer ${jwt}`
        }
      } as any);
      
      wsRef.current.onopen = () => {
        console.log('Connected to Speechmatics');
        
        // Send StartRecognition message
        const startMessage = {
          message: 'StartRecognition',
          audio_format: {
            type: 'raw',
            encoding: 'pcm_s16le',
            sample_rate: 16000
          },
          transcription_config: {
            language: config.language,
            operating_point: 'enhanced',
            enable_partials: config.enablePartials ?? true,
            max_delay: 2,
            ...(config.speakerDiarization && { 
              diarization: 'speaker' 
            })
          }
        };
        
        wsRef.current?.send(JSON.stringify(startMessage));
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.message === 'RecognitionStarted') {
            setIsConnected(true);
            setError(null);
          } else if (message.message === 'AddTranscript') {
            handleTranscript(message);
          } else if (message.message === 'Error') {
            setError(message.error || 'Transcription error');
            setIsConnected(false);
          } else if (message.message === 'EndOfStream') {
            setIsConnected(false);
            setIsRecording(false);
          }
        } catch (err) {
          console.error('Error parsing message:', err);
        }
      };
      
      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Connection error');
        setIsConnected(false);
      };
      
      wsRef.current.onclose = () => {
        console.log('WebSocket closed');
        setIsConnected(false);
        setIsRecording(false);
      };
      
    } catch (err: any) {
      console.error('Connection error:', err);
      setError(err.message || 'Failed to connect to Speechmatics');
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      if (!isConnected || !wsRef.current) {
        throw new Error('Not connected to Speechmatics');
      }

      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      mediaStreamRef.current = stream;
      
      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // Create script processor for audio data
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      processor.onaudioprocess = (event) => {
        if (isRecording && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const inputBuffer = event.inputBuffer;
          const audioData = inputBuffer.getChannelData(0);
          
          // Convert float32 to int16 PCM
          const pcmData = new Int16Array(audioData.length);
          for (let i = 0; i < audioData.length; i++) {
            pcmData[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
          }
          
          // Send audio data to Speechmatics
          wsRef.current.send(pcmData.buffer);
        }
      };
      
      source.connect(processor);
      processor.connect(audioContextRef.current.destination);
      
      setIsRecording(true);
      
    } catch (err: any) {
      console.error('Recording error:', err);
      setError(err.message || 'Failed to start recording');
    }
  }, [isConnected, isRecording]);

  const stopRecording = useCallback(async () => {
    try {
      setIsRecording(false);
      
      // Clean up audio resources
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      
      // Send EndOfStream message and close WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ message: 'EndOfStream' }));
        wsRef.current.close();
        wsRef.current = null;
      }
      
      // Reset state
      setMessages([]);
      setIsConnected(false);
      setError(null);
      
    } catch (err: any) {
      console.error('Stop recording error:', err);
      setError(err.message || 'Error stopping recording');
    }
  }, []);

  return {
    messages,
    isConnected,
    isRecording,
    error,
    connect,
    startRecording,
    stopRecording
  };
};