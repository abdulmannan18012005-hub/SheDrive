import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Colors from '../../constants/Colors';
import { useApp } from '../../contexts/AppContext';
import { getApiBaseUrl } from '../../config/apiConfig';

export default function ReportProblemScreen(): React.JSX.Element {
  const { state } = useApp();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Technical Issue');
  const [description, setDescription] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = ['Technical Issue', 'App Crash / Bug', 'Ride / Bidding Issue', 'Payment Problem', 'Driver / Passenger Dispute', 'Safety Concern', 'Other'];

  const handlePickScreenshot = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Gallery permission is required to upload screenshots.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          setScreenshotUri(`data:image/jpeg;base64,${asset.base64}`);
        } else if (asset.uri) {
          setScreenshotUri(asset.uri);
        }
      }
    } catch (err) {
      console.error('Pick screenshot error:', err);
    }
  };

  const handleSubmitReport = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Required Fields', 'Please enter a Problem Subject and Detailed Description.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`${getApiBaseUrl()}/support/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.token}`,
        },
        body: JSON.stringify({
          category,
          subject: title.trim(),
          message: description.trim(),
          screenshotUrl: screenshotUri,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Error', data.error || 'Failed to submit problem report.');
        return;
      }

      Alert.alert(
        'Report Submitted! 🚀',
        'Thank you for bringing this to our attention. Our support team will review your report and get back to you shortly.'
      );
      setTitle('');
      setDescription('');
      setScreenshotUri(null);
    } catch (err) {
      console.error('Submit report error:', err);
      Alert.alert('Network Error', 'Failed to connect to support server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header Banner */}
      <View style={styles.header}>
        <View style={styles.headerBadge}>
          <Text style={styles.headerIcon}>🛠️</Text>
        </View>
        <Text style={styles.headerTitle}>Report a Problem</Text>
        <Text style={styles.headerSubtitle}>
          Experiencing a bug, payment dispute, or safety issue? Let us know so our support team can resolve it immediately.
        </Text>
      </View>

      {/* Form Content */}
      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Problem Category *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryPill, category === cat && styles.categoryPillActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.categoryPillText, category === cat && styles.categoryPillTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Problem Title / Subject *</Text>
            <TextInput
              style={styles.input}
              placeholder="Brief summary of the issue..."
              placeholderTextColor={Colors.light.textTertiary}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Detailed Description *</Text>
            <TextInput
              style={[styles.input, { height: 110, textAlignVertical: 'top' }]}
              placeholder="Explain what happened, steps to reproduce, or any relevant details..."
              placeholderTextColor={Colors.light.textTertiary}
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Attach Screenshot (Optional)</Text>
            {screenshotUri ? (
              <View style={styles.screenshotBox}>
                <Image source={{ uri: screenshotUri }} style={styles.screenshotImage} />
                <TouchableOpacity style={styles.repickBtn} onPress={handlePickScreenshot}>
                  <Text style={styles.repickText}>📷 Replace Screenshot</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadBox} onPress={handlePickScreenshot}>
                <Text style={styles.uploadIcon}>🖼️</Text>
                <Text style={styles.uploadText}>Upload Problem Screenshot</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmitReport}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Report</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  headerBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.light.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
  },
  headerIcon: { fontSize: 32 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.light.text, marginBottom: 4 },
  headerSubtitle: { fontSize: 13, color: Colors.light.textSecondary, textAlign: 'center', lineHeight: 18 },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  inputGroup: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.light.text, marginBottom: 8 },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  categoryPillActive: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  categoryPillText: { fontSize: 13, fontWeight: '700', color: Colors.light.textSecondary },
  categoryPillTextActive: { color: '#FFFFFF' },
  input: {
    backgroundColor: Colors.light.background,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.light.text,
  },
  uploadBox: {
    backgroundColor: Colors.light.primaryGhost,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: 'center',
  },
  uploadIcon: { fontSize: 26, marginBottom: 4 },
  uploadText: { fontSize: 13, fontWeight: '700', color: Colors.light.primary },
  screenshotBox: { alignItems: 'center' },
  screenshotImage: { width: 120, height: 120, borderRadius: 12, marginBottom: 6 },
  repickBtn: { paddingVertical: 4 },
  repickText: { fontSize: 12, fontWeight: '700', color: Colors.light.primary },
  submitButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
