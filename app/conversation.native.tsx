import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, Text, SafeAreaView, TouchableOpacity, StyleSheet, Alert, PermissionsAndroid, Platform, Animated } from 'react-native';
import { LIVEKIT_URL, generateToken } from '@/utils';
import Constants from 'expo-constants';

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

// Check if we're in Expo Go
const isExpoGo = Constants.executionEnvironment === 'storeClient';

export default function ConversationScreen() {
  const [messages, setMessages] = useState<TranscriptionMessage[]>([]);
  const [speakerColors, setSpeakerColors] = useState<Map<string, string>>(new Map());
  const [isRecording, setIsRecording] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('en');
  const scrollViewRef = useRef<ScrollView>(null);
  const colorIndexRef = useRef(0);
  const speakerColorsRef = useRef<Map<string, string>>(new Map());
  const roomRef = useRef<any>(null);
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

  const requestAudioPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Audio Recording Permission',
            message: 'This app needs access to your microphone to transcribe conversations.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const startRecording = async () => {
    setShowWelcome(false);
    
    // Check if we're in Expo Go
    if (isExpoGo) {
      Alert.alert(
        'Development Build Required',
        'Audio recording requires a development build. Run "npx expo run:ios" or "npx expo run:android" to create one.',
        [{ text: 'OK' }]
      );
      
      // Show demo data for Expo Go
      setIsRecording(true);
      const mockMessages = [
        { type: 'transcription', speaker: '1', text: 'Hello, this is a demo of the conversation transcription.', timestamp: Date.now() },
        { type: 'transcription', speaker: '2', text: 'To use real audio recording, you need a development build.', timestamp: Date.now() + 1000 },
        { type: 'transcription', speaker: '1', text: 'The full version uses LiveKit for real-time transcription.', timestamp: Date.now() + 2000 },
      ];
      
      mockMessages.forEach((msg, index) => {
        setTimeout(() => {
          const color = assignColor(msg.speaker);
          
          setMessages(prev => {
            // Check if we should merge with the last message
            if (prev.length > 0) {
              const lastMessage = prev[prev.length - 1];
              
              // If same speaker, merge the text
              if (lastMessage.speaker === msg.speaker) {
                const updatedMessages = [...prev];
                updatedMessages[updatedMessages.length - 1] = {
                  ...lastMessage,
                  text: lastMessage.text + ' ' + msg.text,
                  timestamp: msg.timestamp // Update to latest timestamp
                };
                return updatedMessages;
              }
            }
            
            // Different speaker or first message - add as new
            return [...prev, {
              speaker: msg.speaker,
              text: msg.text,
              timestamp: msg.timestamp,
              color
            }];
          });
          
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }, index * 2000);
      });
      return;
    }
    
    try {
      // Request audio permission first
      const hasPermission = await requestAudioPermission();
      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Audio permission is required to record conversations');
        return;
      }

      // Dynamically import LiveKit modules
      const { Room, RoomEvent } = await import('livekit-client');
      const { AudioSession, AndroidAudioTypePresets } = await import('@livekit/react-native');
      
      // Configure audio session for iOS and Android
      await AudioSession.configureAudio({
        android: {
          preferredOutputList: ['speaker', 'earpiece', 'headset', 'bluetooth'],
          audioTypeOptions: AndroidAudioTypePresets.communication,
        },
        ios: {
          defaultOutput: 'speaker',
        },
      });
      
      // Start audio session
      await AudioSession.startAudioSession();

      // Create room name with language
      const roomName = `conversation-${Date.now()}-${selectedLanguage}`;
      const participantIdentity = `mobile-${Date.now()}`;
      
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
      
      // Publish local audio track
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
      
      // Stop audio session
      if (!isExpoGo) {
        const { AudioSession } = await import('@livekit/react-native');
        await AudioSession.stopAudioSession();
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
    } finally {
      setIsRecording(false);
      // Reset to welcome state
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
    <SafeAreaView style={styles.container}>
      {showWelcome ? (
        <View style={styles.welcomeContainer}>
          {/* Language Selector in top right */}
          <View style={styles.languageSelectorContainer}>
            <TouchableOpacity
              style={[styles.languageToggle, selectedLanguage === 'en' && styles.languageToggleActive]}
              onPress={() => setSelectedLanguage('en')}
              activeOpacity={0.7}
            >
              <Text style={[styles.languageToggleText, selectedLanguage === 'en' && styles.languageToggleTextActive]}>
                EN
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.languageToggle, selectedLanguage === 'fr' && styles.languageToggleActive]}
              onPress={() => setSelectedLanguage('fr')}
              activeOpacity={0.7}
            >
              <Text style={[styles.languageToggleText, selectedLanguage === 'fr' && styles.languageToggleTextActive]}>
                FR
              </Text>
            </TouchableOpacity>
          </View>

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
                <Text style={styles.messageText}>{msg.text}</Text>
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
  languageSelectorContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  languageToggle: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 50,
    alignItems: 'center',
  },
  languageToggleActive: {
    backgroundColor: '#007AFF',
  },
  languageToggleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  languageToggleTextActive: {
    color: '#FFFFFF',
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