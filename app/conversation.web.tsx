import React, { useState, useEffect, useRef } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { LIVEKIT_URL, generateToken } from '@/utils';

interface TranscriptionMessage {
  speaker: string;
  text: string;
  timestamp: number;
  color: string;
}

type Language = 'en' | 'fr';

const SPEAKER_COLORS = [
  '#007AFF', // Classic iMessage blue
  '#34C759', // iMessage green
  '#FF9500', // Orange
  '#AF52DE', // Purple
  '#FF2D55', // Pink
  '#5856D6', // Indigo
  '#00C7BE', // Teal
  '#FF3B30', // Red
  '#FFCC00', // Yellow
  '#8E8E93'  // Gray
];

export default function ConversationScreen() {
  const [messages, setMessages] = useState<TranscriptionMessage[]>([]);
  const [speakerColors, setSpeakerColors] = useState<Map<string, string>>(new Map());
  const [isRecording, setIsRecording] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('en');
  const [permissionError, setPermissionError] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const scrollViewRef = useRef<HTMLDivElement>(null);
  const colorIndexRef = useRef(0);
  const speakerColorsRef = useRef<Map<string, string>>(new Map());
  const roomRef = useRef<Room | null>(null);

  const assignColor = (speakerId: string): string => {
    if (!speakerColorsRef.current.has(speakerId)) {
      const newColor = SPEAKER_COLORS[colorIndexRef.current % SPEAKER_COLORS.length];
      colorIndexRef.current++;
      speakerColorsRef.current.set(speakerId, newColor);
      setSpeakerColors(new Map(speakerColorsRef.current));
      return newColor;
    }
    return speakerColorsRef.current.get(speakerId)!;
  };

  const requestMicrophonePermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionError(false);
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      setPermissionError(true);
      return false;
    }
  };

  const startRecording = async () => {
    try {
      setIsConnecting(true);
      
      // Ensure Modal agent is running first
      try {
        const modalEndpoint = 'https://augustincombes--livekit-dialogue-agent-ensure-agent-running.modal.run';
        console.log('Waking up Modal agent...');
        
        // Poll until agent is ready
        let agentReady = false;
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds max
        
        while (!agentReady && attempts < maxAttempts) {
          const response = await fetch(modalEndpoint);
          const data = await response.json();
          console.log('Modal agent status:', data);
          
          if (data.agent_info && data.agent_info.ready) {
            agentReady = true;
            console.log('Modal agent is ready!');
          } else if (data.status === 'error') {
            throw new Error(data.message || 'Agent failed to start');
          } else {
            // Wait 1 second before next check
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
          }
        }
        
        if (!agentReady) {
          throw new Error('Modal agent failed to start within 30 seconds');
        }
      } catch (err) {
        console.error('Modal agent error:', err);
        alert('Failed to start the speech recognition service. Please try again.');
        setIsConnecting(false);
        return;
      }
      
      // Debug environment variables
      console.log('Debug - Environment variables:');
      console.log('LIVEKIT_URL:', LIVEKIT_URL);
      console.log('process.env.EXPO_PUBLIC_LIVEKIT_URL:', process.env.EXPO_PUBLIC_LIVEKIT_URL);
      console.log('process.env.EXPO_PUBLIC_LIVEKIT_API_KEY:', process.env.EXPO_PUBLIC_LIVEKIT_API_KEY);
      console.log('process.env.EXPO_PUBLIC_LIVEKIT_API_SECRET:', process.env.EXPO_PUBLIC_LIVEKIT_API_SECRET ? '[REDACTED]' : 'undefined');
      
      // Request microphone permission
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        alert('Please allow microphone access to use this feature.');
        return;
      }

      setShowWelcome(false);
      
      // Create room name with language
      const roomName = `conversation-${Date.now()}-${selectedLanguage}`;
      const participantIdentity = `web-${Date.now()}`;
      
      // Generate token with language parameter
      const token = await generateToken(roomName, participantIdentity, selectedLanguage);

      // Connect to LiveKit room
      roomRef.current = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      // Handle data messages from the agent
      roomRef.current.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: any) => {
        const decoder = new TextDecoder();
        const message = JSON.parse(decoder.decode(payload));
        
        if (message.type === 'transcription') {
          const color = assignColor(message.speaker);
          
          setMessages(prev => {
            // Check if we should merge with the last message
            if (prev.length > 0) {
              const lastMessage = prev[prev.length - 1];
              
              // If same speaker, merge the text
              if (lastMessage.speaker === message.speaker) {
                const updatedMessages = [...prev];
                updatedMessages[updatedMessages.length - 1] = {
                  ...lastMessage,
                  text: lastMessage.text + ' ' + message.text,
                  timestamp: message.timestamp
                };
                return updatedMessages;
              }
            }
            
            // Different speaker or first message - add as new
            return [...prev, {
              speaker: message.speaker,
              text: message.text,
              timestamp: message.timestamp,
              color
            }];
          });
          
          // Auto-scroll to bottom
          setTimeout(() => {
            scrollViewRef.current?.scrollTo({ 
              top: scrollViewRef.current.scrollHeight, 
              behavior: 'smooth' 
            });
          }, 100);
        }
      });

      // Connect to the room
      await roomRef.current.connect(LIVEKIT_URL, token);
      
      // Enable microphone
      await roomRef.current.localParticipant.setMicrophoneEnabled(true);
      
      setIsRecording(true);
      setIsConnecting(false);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording. Please check your LiveKit configuration.');
      setIsConnecting(false);
    }
  };

  const stopRecording = async () => {
    try {
      if (roomRef.current) {
        await roomRef.current.localParticipant.setMicrophoneEnabled(false);
        await roomRef.current.disconnect();
        roomRef.current = null;
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
    } finally {
      setIsRecording(false);
      setShowWelcome(true);
      setMessages([]);
      setSpeakerColors(new Map());
      speakerColorsRef.current = new Map();
      colorIndexRef.current = 0;
    }
  };

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div style={styles.container}>
      {showWelcome ? (
        <div style={styles.welcomeContainer}>
          {/* Language Selector */}
          <div style={styles.languageSelectorContainer}>
            <button
              style={{
                ...styles.languageToggle,
                ...(selectedLanguage === 'en' ? styles.languageToggleActive : {})
              }}
              onClick={() => setSelectedLanguage('en')}
            >
              EN
            </button>
            <button
              style={{
                ...styles.languageToggle,
                ...(selectedLanguage === 'fr' ? styles.languageToggleActive : {})
              }}
              onClick={() => setSelectedLanguage('fr')}
            >
              FR
            </button>
          </div>

          <div style={styles.blaText1}>bla</div>
          <div style={styles.blaText2}>bla</div>
          <div style={styles.blaText3}>bla...</div>
          
          <div style={styles.recordButtonContainer}>
            <button
              style={styles.recordButton}
              onClick={startRecording}
              disabled={isConnecting}
              onMouseEnter={(e) => {
                if (!isConnecting) e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                if (!isConnecting) e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {isConnecting ? (
                <div style={styles.connectingText}>Connecting...</div>
              ) : (
                <div style={styles.recordButtonInner} />
              )}
            </button>
          </div>

          {permissionError && (
            <div style={styles.permissionError}>
              Microphone access is required. Please enable it in your browser settings.
            </div>
          )}
        </div>
      ) : (
        <>
          <div 
            ref={scrollViewRef}
            style={styles.messagesContainer}
          >
            {messages.map((msg, index) => (
              <div 
                key={index} 
                style={{
                  ...styles.messageContainer,
                  backgroundColor: msg.color
                }}
              >
                {msg.text}
              </div>
            ))}
          </div>

          <div style={styles.floatingButtonContainer}>
            <button
              style={{
                ...styles.floatingButton,
                ...(isRecording ? styles.floatingButtonActive : {})
              }}
              onClick={isRecording ? stopRecording : startRecording}
            >
              <div style={{
                ...styles.floatingButtonInner,
                ...(isRecording ? styles.floatingButtonInnerActive : {})
              }} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#000000',
    margin: 0,
    padding: 0,
    overflow: 'hidden',
  },
  welcomeContainer: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  languageSelectorContainer: {
    position: 'absolute',
    top: 40,
    right: 40,
    display: 'flex',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    padding: 4,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
  },
  languageToggle: {
    padding: '10px 20px',
    borderRadius: 20,
    minWidth: 50,
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: 16,
    fontWeight: 700,
    color: '#000000',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  languageToggleActive: {
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
  },
  blaText1: {
    position: 'absolute',
    top: '20%',
    left: '15%',
    fontSize: 36,
    fontWeight: 300,
    color: '#FFFFFF',
    opacity: 0.8,
    animation: 'fadeIn 0.6s ease-in-out',
  },
  blaText2: {
    position: 'absolute',
    top: '35%',
    right: '20%',
    fontSize: 56,
    fontWeight: 400,
    color: '#FFFFFF',
    animation: 'fadeIn 0.6s ease-in-out 0.6s both',
  },
  blaText3: {
    position: 'absolute',
    bottom: '30%',
    left: '25%',
    fontSize: 42,
    fontWeight: 300,
    color: '#FFFFFF',
    opacity: 0.6,
    animation: 'fadeIn 0.6s ease-in-out 1.2s both',
  },
  recordButtonContainer: {
    position: 'absolute',
    bottom: '15%',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    backgroundColor: '#FF3B30',
    border: 'none',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'transform 0.2s ease',
    boxShadow: '0 0 20px rgba(255, 59, 48, 0.5)',
    animation: 'pulse 2s infinite',
  },
  recordButtonInner: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    backgroundColor: '#FFFFFF',
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
    overflowY: 'auto',
    maxWidth: 800,
    margin: '0 auto',
    width: '100%',
  },
  messageContainer: {
    marginBottom: 12,
    padding: '10px 16px',
    borderRadius: 18,
    maxWidth: '75%',
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 1.4,
  },
  floatingButtonContainer: {
    position: 'fixed',
    bottom: 30,
    right: 30,
  },
  floatingButton: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    backgroundColor: '#007AFF',
    border: 'none',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
    transition: 'background-color 0.2s ease',
  },
  floatingButtonActive: {
    backgroundColor: '#FF3B30',
  },
  floatingButtonInner: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    backgroundColor: '#FFFFFF',
  },
  floatingButtonInnerActive: {
    width: 16,
    height: 16,
    borderRadius: 2,
  },
  permissionError: {
    position: 'absolute',
    bottom: 60,
    padding: '12px 24px',
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    color: '#FFFFFF',
    borderRadius: 8,
    fontSize: 14,
  },
};

// Add CSS animations when component mounts
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  const addStyles = () => {
    if (!document.getElementById('conversation-web-styles')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'conversation-web-styles';
      styleSheet.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
      `;
      document.head.appendChild(styleSheet);
    }
  };
  
  // Ensure styles are added after hydration
  if (typeof window.__EXPO_ROUTER_HYDRATE__ !== 'undefined') {
    setTimeout(addStyles, 0);
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addStyles);
  } else {
    addStyles();
  }
}