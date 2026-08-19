import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { collection, query, where, onSnapshot, addDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { useApp } from '../../contexts/AppContext';
import Colors from '../../constants/Colors';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'passenger' | 'driver';
  text: string;
  timestamp: number;
}

interface ChatScreenParams {
  rideId: string;
  otherUserName: string;
  otherUserRole: 'passenger' | 'driver';
}

type ChatScreenNavigationProp = StackNavigationProp<any, 'Chat'>;

interface Props {
  navigation: ChatScreenNavigationProp;
  route: { params: ChatScreenParams };
}

export default function ChatScreen({ navigation, route }: Props): React.JSX.Element {
  const { rideId, otherUserName, otherUserRole } = route.params;
  const { state } = useApp();
  const user = state.user;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const messagesRef = collection(db, 'rides', rideId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const messagesList: Message[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          messagesList.push({
            id: doc.id,
            senderId: data.senderId,
            senderName: data.senderName,
            senderRole: data.senderRole,
            text: data.text,
            timestamp: data.timestamp || Date.now(),
          } as Message);
        });
        setMessages(messagesList);
        setIsLoading(false);
        
        // Auto-scroll to bottom when new messages arrive
        if (messagesList.length > 0) {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      },
      (error) => {
        console.error('Chat subscription error:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [rideId]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !user) return;

    try {
      setIsSending(true);
      const messagesRef = collection(db, 'rides', rideId, 'messages');
      
      await addDoc(messagesRef, {
        senderId: user.uid,
        senderName: user.name,
        senderRole: user.role,
        text: inputText.trim(),
        timestamp: Date.now(),
      });

      setInputText('');
    } catch (error) {
      console.error('Send message error:', error);
      Alert.alert('Send Failed', 'Could not send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const isMyMessage = (message: Message) => message.senderId === user?.uid;

  const renderMessage = ({ item }: { item: Message }) => {
    const myMessage = isMyMessage(item);
    
    return (
      <View
        style={[
          styles.messageBubble,
          myMessage ? styles.myMessage : styles.otherMessage,
        ]}
      >
        <Text
          style={[
            styles.senderName,
            myMessage ? styles.mySenderName : styles.otherSenderName,
          ]}
        >
          {item.senderName} ({item.senderRole === 'driver' ? 'Driver' : 'Passenger'})
        </Text>
        <Text style={[styles.messageText, myMessage ? styles.myMessageText : styles.otherMessageText]}>
          {item.text}
        </Text>
        <Text style={styles.timestamp}>
          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Chat with {otherUserName}</Text>
          <Text style={styles.headerSubtitle}>{otherUserRole === 'driver' ? 'Verified Female Driver' : 'Passenger'}</Text>
        </View>
      </View>

      {/* Safety Notice Banner */}
      <View style={styles.safetyNotice}>
        <Text style={styles.safetyNoticeIcon}>🛡️</Text>
        <Text style={styles.safetyNoticeText}>For your security, in-ride chats are protected and recorded.</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Start the conversation with {otherUserName}!</Text>
          </View>
        }
      />

      {/* Quick Reply Chips from Template */}
      <View style={styles.quickChipsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickChipsScroll}>
          {['I am at the pickup', 'Running 2 min late', 'I am near the entrance', 'Wearing pink dupatta'].map((chip, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.quickChip}
              onPress={() => setInputText(chip)}
              activeOpacity={0.7}
            >
              <Text style={styles.quickChipText}>{chip}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor={Colors.light.textTertiary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!inputText.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: Colors.light.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: Colors.light.primary,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.light.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  safetyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF2F4',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F8D7DA',
  },
  safetyNoticeIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  safetyNoticeText: {
    fontSize: 11,
    color: '#842029',
    fontWeight: '600',
  },
  quickChipsContainer: {
    paddingVertical: 6,
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  quickChipsScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  quickChip: {
    backgroundColor: '#FCEFEF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F8BBD0',
  },
  quickChipText: {
    fontSize: 12,
    color: '#6A1B9A',
    fontWeight: '600',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    marginTop: 4,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.light.primary,
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.light.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  mySenderName: {
    color: 'rgba(255,255,255,0.8)',
  },
  otherSenderName: {
    color: Colors.light.primary,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: Colors.light.text,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.light.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 15,
    color: Colors.light.text,
  },
  sendButton: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
