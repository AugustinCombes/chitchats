import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, Text, SafeAreaView, TouchableOpacity, StyleSheet, Alert, PermissionsAndroid, Platform } from 'react-native';
import { LIVEKIT_URL, generateToken } from '@/utils';
import Constants from 'expo-constants';

interface TranscriptionMessage {
  speaker: string;
  text: string;
  timestamp: number;
  color: string;
}

const SPEAKER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#FFD93D', '#6BCB77', '#9B59B6', '#F39C12', '#1ABC9C'
];

// Check if we're in Expo Go
const isExpoGo = Constants.executionEnvironment === 'storeClient';

export default function ConversationScreen() {
  const [messages, setMessages] = useState<TranscriptionMessage[]>([]);
  const [speakerColors, setSpeakerColors] = useState<Map<string, string>>(new Map());
  const [isRecording, setIsRecording] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const colorIndexRef = useRef(0);
  const roomRef = useRef<Room | null>(null);

  const assignColor = (speakerId: string): string => {
    if (!speakerColors.has(speakerId)) {
      const newColor = SPEAKER_COLORS[colorIndexRef.current % SPEAKER_COLORS.length];
      colorIndexRef.current++;
      setSpeakerColors(prev => new Map(prev).set(speakerId, newColor));
      return newColor;
    }
    return speakerColors.get(speakerId)!;
  };

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
          setMessages(prev => [...prev, {
            speaker: msg.speaker,
            text: msg.text,
            timestamp: msg.timestamp,
            color
          }]);
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
      const { ConfigureAudioSession } = await import('@livekit/react-native');
      
      // Configure audio session for iOS
      await ConfigureAudioSession({
        android: {
          preferredOutputList: ['speaker'],
          preferredInputList: ['builtin'],
        },
        ios: {
          defaultOutput: 'speaker',
          defaultInput: 'builtin',
        },
      });

      // Create room name
      const roomName = `conversation-${Date.now()}`;
      const participantIdentity = `mobile-${Date.now()}`;
      
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
          setMessages(prev => [...prev, {
            speaker: message.speaker,
            text: message.text,
            timestamp: message.timestamp,
            color
          }]);
          
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
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    
    setIsRecording(false);
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
      <View style={styles.header}>
        <Text style={styles.title}>Conversation Transcription</Text>
        <TouchableOpacity
          style={[styles.recordButton, isRecording && styles.recordButtonActive]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Text style={styles.recordButtonText}>
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.map((msg, index) => (
          <View key={index} style={styles.messageContainer}>
            <View style={[styles.speakerBubble, { backgroundColor: msg.color }]}>
              <Text style={styles.speakerText}>Speaker {msg.speaker}</Text>
            </View>
            <Text style={styles.messageText}>{msg.text}</Text>
          </View>
        ))}
      </ScrollView>

      {isRecording && (
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>
            {isExpoGo ? 'Demo mode - showing mock data' : 'Recording conversation...'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  recordButton: {
    backgroundColor: '#4ECDC4',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  recordButtonActive: {
    backgroundColor: '#FF6B6B',
  },
  recordButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  messagesContainer: {
    flex: 1,
    padding: 20,
  },
  messagesContent: {
    paddingBottom: 20,
  },
  messageContainer: {
    marginBottom: 15,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  speakerBubble: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  speakerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#333',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6B6B',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 14,
    color: '#666',
  },
});