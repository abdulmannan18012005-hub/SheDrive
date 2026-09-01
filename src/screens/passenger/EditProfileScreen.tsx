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
  Modal,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PassengerStackParamList } from '../../types';
import Colors from '../../constants/Colors';
import { useApp } from '../../contexts/AppContext';
import { getApiBaseUrl } from '../../config/apiConfig';
import { isValidPhone } from '../../utils/helpers';

type EditProfileNavigationProp = StackNavigationProp<PassengerStackParamList, 'EditProfile'>;

interface Props {
  navigation: EditProfileNavigationProp;
}

export default function EditProfileScreen({ navigation }: Props): React.JSX.Element {
  const { state, dispatch } = useApp();
  const user = state.user;

  const [firstName, setFirstName] = useState(user?.name?.split(' ')[0] || '');
  const [lastName, setLastName] = useState(user?.name?.split(' ').slice(1).join(' ') || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [cnic, setCnic] = useState(user?.cnic || '');
  const [gender, setGender] = useState(user?.gender || 'female');
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

  const convertToBase64 = async (uri: string): Promise<string> => {
    try {
      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return `data:image/jpeg;base64,${base64Data}`;
    } catch {
      return uri;
    }
  };

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Validation Error', 'First name and last name cannot be empty.');
      return;
    }

    try {
      setIsLoading(true);
      const token = state.token || (await AsyncStorage.getItem('@shedrive_auth_token')) || (await AsyncStorage.getItem('shedrive_token'));
      const API_BASE_URL = getApiBaseUrl();

      let uploadedPhotoUrl = user?.photoURL;
      if (imageUri) {
        const base64Data = await convertToBase64(imageUri);
        // Upload avatar image to Cloudinary storage
        const uploadRes = await fetch(`${API_BASE_URL}/upload/document`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            base64Data,
            folder: 'shedrive/avatars',
          }),
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.url) {
          throw new Error(uploadData.error || 'Failed to upload profile picture to storage');
        }
        uploadedPhotoUrl = uploadData.url;
      }

      const fullName = `${firstName.trim()} ${lastName.trim()}`;

      const requestBody: any = {
        name: fullName,
      };

      if (uploadedPhotoUrl) {
        requestBody.photoURL = uploadedPhotoUrl;
      }

      const response = await fetch(`${API_BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      // Update local AppContext and AsyncStorage immediately
      if (user) {
        const updatedUser = {
          ...user,
          name: fullName,
          photoURL: uploadedPhotoUrl || user.photoURL,
        };
        dispatch({
          type: 'SET_USER',
          payload: updatedUser,
        });
        await AsyncStorage.setItem('@shedrive_user_profile', JSON.stringify(updatedUser));
      }

      const isNameChanged = fullName !== user?.name;
      const isAvatarChanged = Boolean(imageUri);

      let successMessage = 'Profile updated successfully';
      if (isNameChanged && isAvatarChanged) {
        successMessage = 'Profile updated successfully';
      } else if (isNameChanged) {
        successMessage = 'Name updated successfully';
      } else if (isAvatarChanged) {
        successMessage = 'Profile photo updated successfully';
      }

      Alert.alert('Success', successMessage, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      console.error('Update profile failed:', error);
      Alert.alert('Update Failed', error.message || 'Unable to save changes.');
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
          <TouchableOpacity onPress={handlePickImage} disabled={isLoading} activeOpacity={0.8} style={styles.avatarWrapper}>
            <View style={styles.avatarContainer}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.avatarImage} />
              ) : user?.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderText}>👩</Text>
                </View>
              )}
            </View>
            <View style={styles.cameraBadge}>
              <Text style={{ fontSize: 12 }}>📷</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePickImage} disabled={isLoading}>
            <Text style={styles.changePhotoText}>Change Profile Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Input Form */}
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>Editable Profile Information</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>First Name</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Enter your first name"
                placeholderTextColor={Colors.light.textTertiary}
                autoCapitalize="words"
                editable={!isLoading}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Last Name</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Enter your last name"
                placeholderTextColor={Colors.light.textTertiary}
                autoCapitalize="words"
                editable={!isLoading}
              />
            </View>
          </View>
        </View>

        {/* Verified Immutable Identity Section */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={styles.cardHeaderTitle}>Verified Identity</Text>
            <View style={styles.lockedBadge}>
              <Text style={styles.lockedBadgeText}>🔒 Immutable</Text>
            </View>
          </View>
          <Text style={styles.lockedNotice}>
            For passenger security and safety verification, email address, mobile number, and CNIC cannot be changed after registration.
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email Address</Text>
            <View style={[styles.inputWrapper, styles.readOnlyInputWrapper]}>
              <Text style={styles.inputIcon}>📧</Text>
              <Text style={styles.readOnlyText} numberOfLines={1} ellipsizeMode="tail">
                {user?.email || email || 'Not provided'}
              </Text>
              <Text style={styles.lockIconMini}>🔒</Text>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={[styles.inputWrapper, styles.readOnlyInputWrapper]}>
              <Text style={styles.inputIcon}>📱</Text>
              <Text style={styles.readOnlyText} numberOfLines={1}>
                {user?.phone || phone || 'Not provided'}
              </Text>
              <Text style={styles.lockIconMini}>🔒</Text>
            </View>
          </View>

          {/* CNIC Number Bar */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>National Identity Card (CNIC)</Text>
            <View style={[styles.inputWrapper, styles.readOnlyInputWrapper]}>
              <Text style={styles.inputIcon}>🪪</Text>
              <Text style={styles.readOnlyText} numberOfLines={1}>
                {user?.cnic || cnic || 'Verified On File'}
              </Text>
              <Text style={styles.lockIconMini}>🔒</Text>
            </View>
          </View>

          {/* Gender Display */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Gender</Text>
            <View style={[styles.inputWrapper, styles.readOnlyInputWrapper]}>
              <Text style={styles.inputIcon}>👩</Text>
              <Text style={styles.readOnlyText}>Female (Verified Exclusive)</Text>
              <Text style={styles.lockIconMini}>🔒</Text>
            </View>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSaveProfile}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.light.textOnPrimary} />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
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
  imgPreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  imgPreviewContainer: {
    backgroundColor: Colors.light.surface,
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  imgPreviewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  imgPreviewSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  imgPreviewBox: {
    width: '100%',
    height: 240,
    backgroundColor: '#000',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  imgPreviewImage: {
    width: '100%',
    height: '100%',
  },
  imgPreviewBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 12,
  },
  imgPreviewBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imgPreviewCropBtn: {
    backgroundColor: Colors.light.primaryGhost,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
  },
  imgPreviewCropBtnText: {
    color: Colors.light.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  imgPreviewDoneBtn: {
    backgroundColor: Colors.light.primary,
  },
  imgPreviewDoneBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 16,
  },
  imgPreviewCancelBtn: {
    paddingVertical: 8,
  },
  imgPreviewCancelText: {
    color: Colors.light.textSecondary,
    fontSize: 13,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 40,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.light.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: Colors.light.primary,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: Colors.light.surface,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
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
    fontSize: 44,
  },
  changePhotoText: {
    color: Colors.light.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  inputIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.light.text,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  saveButtonText: {
    color: Colors.light.textOnPrimary,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  genderSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  genderOption: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  genderOptionActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  genderOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  genderOptionTextActive: {
    color: '#fff',
  },
  helperText: {
    fontSize: 11,
    color: Colors.light.textTertiary,
    marginTop: 4,
    marginLeft: 4,
  },
  readOnlyInputWrapper: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  readOnlyText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  lockedBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  lockedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  lockedNotice: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 16,
    lineHeight: 16,
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.primary,
  },
  lockIconMini: {
    fontSize: 14,
    marginLeft: 8,
    opacity: 0.6,
  },
});
