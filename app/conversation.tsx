import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, Text, SafeAreaView, TouchableOpacity, StyleSheet, Alert, Animated } from 'react-native';
import { Room, RoomEvent } from 'livekit-client';
import { LIVEKIT_URL, generateToken } from '@/utils';

interface TranscriptionMessage {
  speaker: string;
  text: string;
  timestamp: number;
  color: string;
}

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
  const scrollViewRef = useRef<ScrollView>(null);
  const colorIndexRef = useRef(0);
  const speakerColorsRef = useRef<Map<string, string>>(new Map());
  const roomRef = useRef<Room | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim1 = useRef(new Animated.Value(0)).current;
  const fadeAnim2 = useRef(new Animated.Value(0)).current;
  const fadeAnim3 = useRef(new Animated.Value(0)).current;

  const assignColor = (speakerId: string): string => {
    // Use a ref to store colors to avoid async state issues
    if (!speakerColorsRef.current.has(speakerId)) {
      const newColor = SPEAKER_COLORS[colorIndexRef.current % SPEAKER_COLORS.length];
      colorIndexRef.current++;
      speakerColorsRef.current.set(speakerId, newColor);
      setSpeakerColors(new Map(speakerColorsRef.current));
      return newColor;
    }
    return speakerColorsRef.current.get(speakerId)!;
  };

  useEffect(() => {
    // Welcome screen animations
    Animated.sequence([
      Animated.timing(fadeAnim1, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim2, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim3, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for record button
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const startRecording = async () => {
    try {
      setShowWelcome(false);
      
      // Create room name
      const roomName = `conversation-${Date.now()}`;
      const participantIdentity = `web-${Date.now()}`;
      
      // Generate token directly (for POC - in production, do this on a secure backend)
      const token = await generateToken(roomName, participantIdentity);

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
                  timestamp: message.timestamp // Update to latest timestamp
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
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      });

      // Connect to the room
      await roomRef.current.connect(LIVEKIT_URL, token);
      
      // Enable microphone for web
      await roomRef.current.localParticipant.setMicrophoneEnabled(true);
      
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please check your LiveKit configuration.');
    }
  };

  const stopRecording = async () => {
    try {
      if (roomRef.current) {
        // Disable microphone first
        await roomRef.current.localParticipant.setMicrophoneEnabled(false);
        
        // Disconnect from the room
        await roomRef.current.disconnect();
        roomRef.current = null;
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
    } finally {
      setIsRecording(false);
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
    <SafeAreaView style={styles.container}>
      {showWelcome ? (
        <View style={styles.welcomeContainer}>
          <Animated.Text style={[styles.blaText, styles.bla1, { opacity: fadeAnim1 }]}>
            bla
          </Animated.Text>
          <Animated.Text style={[styles.blaText, styles.bla2, { opacity: fadeAnim2 }]}>
            bla
          </Animated.Text>
          <Animated.Text style={[styles.blaText, styles.bla3, { opacity: fadeAnim3 }]}>
            bla...
          </Animated.Text>
          
          <Animated.View style={[styles.recordButtonContainer, { transform: [{ scale: pulseAnim }] }]}>
            <TouchableOpacity
              style={styles.recordButton}
              onPress={startRecording}
              activeOpacity={0.8}
            >
              <View style={styles.recordButtonInner} />
            </TouchableOpacity>
          </Animated.View>
        </View>
      ) : (
        <>
          <ScrollView 
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
          >
            {messages.map((msg, index) => (
              <View key={index} style={[styles.messageContainer, { backgroundColor: msg.color }]}>
                <Text style={styles.messageText}>{`[${msg.speaker}] ${msg.text}`}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.floatingButtonContainer}>
            <TouchableOpacity
              style={[styles.floatingButton, isRecording && styles.floatingButtonActive]}
              onPress={isRecording ? stopRecording : startRecording}
              activeOpacity={0.8}
            >
              <View style={[styles.floatingButtonInner, isRecording && styles.floatingButtonInnerActive]} />
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  blaText: {
    fontSize: 48,
    fontWeight: '300',
    color: '#FFFFFF',
    position: 'absolute',
  },
  bla1: {
    top: '20%',
    left: '15%',
    fontSize: 36,
    opacity: 0.8,
  },
  bla2: {
    top: '35%',
    right: '20%',
    fontSize: 56,
    fontWeight: '400',
  },
  bla3: {
    bottom: '30%',
    left: '25%',
    fontSize: 42,
    opacity: 0.6,
  },
  recordButtonContainer: {
    position: 'absolute',
    bottom: '15%',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  recordButtonInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  messagesContent: {
    paddingBottom: 100,
  },
  messageContainer: {
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    maxWidth: '75%',
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 30,
    right: 30,
  },
  floatingButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  floatingButtonActive: {
    backgroundColor: '#FF3B30',
  },
  floatingButtonInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  floatingButtonInnerActive: {
    width: 16,
    height: 16,
    borderRadius: 2,
  },
});