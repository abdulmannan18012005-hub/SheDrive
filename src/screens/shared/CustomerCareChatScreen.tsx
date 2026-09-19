import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { PassengerStackParamList } from '../../types';
import { getApiBaseUrl } from '../../config/apiConfig';

type ChatRouteProp = RouteProp<PassengerStackParamList, 'CustomerCareChat'>;
type NavigationProp = StackNavigationProp<PassengerStackParamList>;

interface ChatMessage {
  id: string;
  text: string;
  is_from_admin: boolean;
  created_at: string;
}

export const CustomerCareChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ChatRouteProp>();
  const { ticketId, subject } = route.params;
  const { state } = useApp();
  const flatListRef = useRef<FlatList>(null);

  const fetchMessages = async () => {
    try {
      const token = state.token;
      const response = await fetch(`${getApiBaseUrl()}/support/tickets/${ticketId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;

    try {
      setSending(true);
      const token = state.token;
      const response = await fetch(`${getApiBaseUrl()}/support/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ text: inputText.trim() }),
      });

      if (response.ok) {
        setInputText('');
        fetchMessages();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMine = !item.is_from_admin;
    return (
      <View style={[styles.messageBubble, isMine ? styles.myMessage : styles.adminMessage]}>
        <Text style={[styles.messageText, isMine ? styles.myMessageText : styles.adminMessageText]}>
          {item.text}
        </Text>
        <Text style={[styles.timeText, isMine ? styles.myTimeText : styles.adminTimeText]}>
          {new Date(Number(item.created_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{subject}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#e91e63" style={styles.loader} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={sending || !inputText.trim()}>
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', flex: 1, textAlign: 'center', marginHorizontal: 10 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContainer: { padding: 15, paddingBottom: 20 },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 15,
    marginBottom: 10,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#e91e63',
    borderBottomRightRadius: 5,
  },
  adminMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 5,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  messageText: { fontSize: 15 },
  myMessageText: { color: '#fff' },
  adminMessageText: { color: '#333' },
  timeText: { fontSize: 10, marginTop: 5, alignSelf: 'flex-end' },
  myTimeText: { color: '#ffd0de' },
  adminTimeText: { color: '#999' },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    alignItems: 'flex-end',
    elevation: 5,
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 100,
    minHeight: 40,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#e91e63',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
