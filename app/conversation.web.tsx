import React, { useState, useEffect, useRef } from 'react';
import { useSpeechmaticsTranscription } from '../hooks/useSpeechmaticsTranscription';

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
  const [showWelcome, setShowWelcome] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('en');
  const [permissionError, setPermissionError] = useState(false);
  const [displayMessages, setDisplayMessages] = useState<TranscriptionMessage[]>([]);
  const [speakerColors, setSpeakerColors] = useState<Map<string, string>>(new Map());
  const scrollViewRef = useRef<HTMLDivElement>(null);
  const colorIndexRef = useRef(0);
  
  const {
    messages,
    isConnected,
    isRecording,
    error,
    connect,
    startRecording,
    stopRecording
  } = useSpeechmaticsTranscription();

  const assignColor = (speakerId: string): string => {
    if (!speakerColors.has(speakerId)) {
      const newColor = SPEAKER_COLORS[colorIndexRef.current % SPEAKER_COLORS.length];
      colorIndexRef.current++;
      setSpeakerColors(prev => new Map(prev).set(speakerId, newColor));
      return newColor;
    }
    return speakerColors.get(speakerId)!;
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

  const handleStartRecording = async () => {
    try {
      // Request microphone permission
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        alert('Please allow microphone access to use this feature.');
        return;
      }

      setShowWelcome(false);
      
      // Connect to Speechmatics with selected language
      await connect({ 
        language: selectedLanguage,
        enablePartials: false,
        speakerDiarization: true 
      });
      
      // Start recording audio
      await startRecording();
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording. Please try again.');
      setShowWelcome(true);
    }
  };

  const handleStopRecording = async () => {
    try {
      await stopRecording();
    } catch (error) {
      console.error('Error stopping recording:', error);
    } finally {
      setShowWelcome(true);
      setDisplayMessages([]);
      setSpeakerColors(new Map());
      colorIndexRef.current = 0;
    }
  };

  // Update display messages when new transcription messages arrive
  useEffect(() => {
    const newDisplayMessages = messages.map(msg => ({
      ...msg,
      color: assignColor(msg.speaker)
    }));
    setDisplayMessages(newDisplayMessages);
    
    // Auto-scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ 
        top: scrollViewRef.current.scrollHeight, 
        behavior: 'smooth' 
      });
    }, 100);
  }, [messages]);

  // Show error if any
  useEffect(() => {
    if (error) {
      console.error('Speechmatics error:', error);
    }
  }, [error]);

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
              onClick={handleStartRecording}
              disabled={isConnected && !isRecording}
              onMouseEnter={(e) => {
                if (!isConnected) e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                if (!isConnected) e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {isConnected && !isRecording ? (
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

          {error && (
            <div style={styles.permissionError}>
              {error}
            </div>
          )}
        </div>
      ) : (
        <>
          <div 
            ref={scrollViewRef}
            style={styles.messagesContainer}
          >
            {displayMessages.map((msg, index) => (
              <div 
                key={index} 
                style={{
                  ...styles.messageContainer,
                  backgroundColor: msg.color
                }}
              >
                <div style={styles.speakerLabel}>
                  Speaker {msg.speaker}
                </div>
                <div style={styles.messageText}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          <div style={styles.floatingButtonContainer}>
            <button
              style={{
                ...styles.floatingButton,
                ...(isRecording ? styles.floatingButtonActive : {})
              }}
              onClick={isRecording ? handleStopRecording : handleStartRecording}
            >
              <div style={{
                ...styles.floatingButtonInner,
                ...(isRecording ? styles.floatingButtonInnerActive : {})
              }} />
            </button>
          </div>

          {/* Status bar */}
          <div style={styles.statusBar}>
            <div style={styles.statusItem}>
              {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </div>
            <div style={styles.statusItem}>
              {isRecording ? '🎙️ Recording' : '⏸️ Not Recording'}
            </div>
            <div style={styles.statusItem}>
              Language: {selectedLanguage.toUpperCase()}
            </div>
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
  connectingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 600,
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
  },
  speakerLabel: {
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 4,
    fontWeight: 600,
  },
  messageText: {
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
  statusBar: {
    position: 'fixed',
    bottom: 20,
    left: 20,
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
  },
  statusItem: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    color: '#FFFFFF',
    padding: '8px 12px',
    borderRadius: 16,
    fontSize: 12,
    backdropFilter: 'blur(10px)',
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