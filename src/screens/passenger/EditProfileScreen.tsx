import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import { PassengerStackParamList } from '../../types';
import Colors from '../../constants/Colors';
import { useApp } from '../../contexts/AppContext';
import { updateUserProfile, imageToBase64 } from '../../firebase/db';
import { isValidPhone } from '../../utils/helpers';

type EditProfileNavigationProp = StackNavigationProp<PassengerStackParamList, 'EditProfile'>;

interface Props {
  navigation: EditProfileNavigationProp;
}

export default function EditProfileScreen({ navigation }: Props): React.JSX.Element {
  const { state, dispatch } = useApp();
  const user = state.user;

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Permission to access gallery is required to select a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Image Picker Error', 'Could not open image library.');
    }
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Name cannot be empty.');
      return;
    }

    if (!isValidPhone(phone)) {
      Alert.alert('Validation Error', 'Please enter a valid Pakistani phone number (e.g. 03001234567).');
      return;
    }

    try {
      setIsLoading(true);
      let photoURL = user?.photoURL;

      // 1. Convert new profile picture to base64 data URI if selected
      if (imageUri && user) {
        photoURL = await imageToBase64(imageUri);
      }

      // 2. Update user profile document in Firestore
      if (user) {
        const updatedFields = {
          name: name.trim(),
          phone: phone.trim(),
          photoURL,
        };

        await updateUserProfile(user.uid, updatedFields);

        // 3. Update local AppContext
        dispatch({
          type: 'SET_USER',
          payload: {
            ...user,
            ...updatedFields,
          },
        });

        Alert.alert('Profile Updated', 'Your profile details have been saved successfully.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      console.error('Update profile failed:', error);
      Alert.alert('Update Failed', 'Unable to save profile details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Photo Selection */}
        <View style={styles.photoSection}>
          <TouchableOpacity onPress={handlePickImage} disabled={isLoading} activeOpacity={0.8}>
            <View style={styles.avatarContainer}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.avatarImage} />
              ) : user?.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderText}>📸</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePickImage} disabled={isLoading}>
            <Text style={styles.changePhotoText}>Change Profile Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Input Form */}
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={Colors.light.textTertiary}
              autoCapitalize="words"
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. 03001234567"
              placeholderTextColor={Colors.light.textTertiary}
              keyboardType="phone-pad"
              editable={!isLoading}
            />
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSaveProfile}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.light.textOnPrimary} />
          ) : (
            <Text style={styles.saveButtonText}>Save Profile</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 40,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  avatarContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.light.divider,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 32,
  },
  changePhotoText: {
    color: Colors.light.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  form: {
    flex: 1,
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.light.text,
  },
  saveButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: Colors.light.textOnPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
});
