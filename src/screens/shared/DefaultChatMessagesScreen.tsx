import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, TextInput, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '../../constants/Colors';

const DEFAULT_MESSAGES = [
  'I am here',
  'On my way',
  'Traffic is heavy',
  'Please wait a moment',
];

export default function DefaultChatMessagesScreen() {
  const navigation = useNavigation();
  const [messages, setMessages] = useState<string[]>(['', '', '', '']);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      const stored = await AsyncStorage.getItem('@shedrive_default_chat_msgs');
      if (stored) {
        const parsed = JSON.parse(stored);
        setMessages([...parsed, '', '', '', ''].slice(0, 4));
      } else {
        setMessages(DEFAULT_MESSAGES);
      }
    } catch (e) {
      setMessages(DEFAULT_MESSAGES);
    }
  };

  const handleSave = async () => {
    const valid = messages.map(m => m.trim());
    try {
      await AsyncStorage.setItem('@shedrive_default_chat_msgs', JSON.stringify(valid));
      Alert.alert('Saved', 'Your default chat messages have been saved.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Failed to save messages.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>{'< Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Default Chat Messages</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.infoText}>
          Customize up to 4 pre-written messages for quick replies during a ride.
        </Text>
        {messages.map((msg, index) => (
          <View key={index} style={styles.inputContainer}>
            <Text style={styles.label}>Message {index + 1}</Text>
            <TextInput
              style={styles.input}
              value={msg}
              onChangeText={(val) => {
                const newMsgs = [...messages];
                newMsgs[index] = val;
                setMessages(newMsgs);
              }}
              placeholder={'e.g. ' + DEFAULT_MESSAGES[index]}
              maxLength={50}
            />
          </View>
        ))}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Messages</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backButton: { padding: 8 },
  backText: { color: Colors.light.primary, fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.light.text },
  content: { padding: 20 },
  infoText: { fontSize: 15, color: '#64748B', marginBottom: 20 },
  inputContainer: { marginBottom: 15 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, fontSize: 16, color: '#0F172A' },
  saveButton: { backgroundColor: Colors.light.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
