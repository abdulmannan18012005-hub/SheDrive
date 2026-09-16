import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Linking } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Audio } from 'expo-av';
import Colors from '../../constants/Colors';

export default function CallingScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { name, phone, role } = route.params as any;
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    async function playRingtone() {
      try {
        // In a real app we'd load the audio file. We'll simulate ringing for the demo.
        const { sound } = await Audio.Sound.createAsync(
          // use a generic public ringing URL since we don't have a local asset
          { uri: 'https://actions.google.com/sounds/v1/alarms/phone_ringing.ogg' }
        );
        setSound(sound);
        await sound.setIsLoopingAsync(true);
        await sound.playAsync();
      } catch (e) {
        console.warn('Ringtone could not be played', e);
      }
    }
    playRingtone();

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const handleEndCall = () => {
    if (sound) sound.unloadAsync();
    navigation.goBack();
  };

  const handleCallNative = () => {
    if (sound) sound.unloadAsync();
    Linking.openURL(`tel:${phone}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.callingText}>Calling {role}...</Text>
        <Text style={styles.name}>{name || 'User'}</Text>
        <Text style={styles.phone}>{phone || 'Unknown Number'}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.button, styles.endButton]} onPress={handleEndCall}>
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.callButton]} onPress={handleCallNative}>
          <Text style={styles.buttonText}>Dial via Phone</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', justifyContent: 'space-between', padding: 24 },
  header: { alignItems: 'center', marginTop: 100 },
  callingText: { color: '#9CA3AF', fontSize: 18, marginBottom: 8 },
  name: { color: '#FFFFFF', fontSize: 32, fontWeight: '700', marginBottom: 8 },
  phone: { color: '#6B7280', fontSize: 20 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 50 },
  button: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 30, width: '45%', alignItems: 'center' },
  endButton: { backgroundColor: '#EF4444' },
  callButton: { backgroundColor: '#10B981' },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
