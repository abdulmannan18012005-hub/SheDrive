import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import { AuthStackParamList, UserRole, VehicleCategoryId } from '../../types';
import Colors from '../../constants/Colors';
import { signUpWithEmail } from '../../firebase/auth';
import { imageToBase64, updateUserProfile } from '../../firebase/db';
import { useApp } from '../../contexts/AppContext';
import { isValidEmail, isValidPhone } from '../../utils/helpers';

type RegisterScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Register'>;

interface Props {
  navigation: RegisterScreenNavigationProp;
}

export default function RegisterScreen({ navigation }: Props): React.JSX.Element {
  const { dispatch } = useApp();
  const [role, setRole] = useState<UserRole>('passenger');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // Driver vehicle details
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategoryId>('mini');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [licenseImageUri, setLicenseImageUri] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  const handlePickLicense = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Permission to access gallery is required to upload your license.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLicenseImageUri(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Image Picker Error', 'Could not open image library.');
    }
  };

  const handleRegister = async () => {
    // 1. Basic Validations
    if (!name || !email || !phone || !password) {
      Alert.alert('Validation Error', 'All fields are required.');
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }

    if (!isValidPhone(phone)) {
      Alert.alert('Validation Error', 'Please enter a valid Pakistani phone number (e.g., 03001234567 or +923001234567).');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters.');
      return;
    }

    // 2. Driver Validations
    if (role === 'driver') {
      if (!vehicleMake || !vehicleModel || !vehiclePlate || !vehicleColor) {
        Alert.alert('Validation Error', 'All vehicle information details are required for drivers.');
        return;
      }
      if (!licenseImageUri) {
        Alert.alert('Validation Error', 'Please select a photo of your driver license.');
        return;
      }
    }

    try {
      setIsLoading(true);

      const vehicleInfo = role === 'driver' ? {
        category: vehicleCategory,
        make: vehicleMake.trim(),
        model: vehicleModel.trim(),
        plate: vehiclePlate.trim().toUpperCase(),
        color: vehicleColor.trim(),
      } : undefined;

      // 1. Register Auth + Create user/driver documents
      const profile = await signUpWithEmail(
        email,
        password,
        name,
        phone,
        role,
        vehicleInfo
      );

      // 2. Convert license image to base64 data URI if driver
      if (role === 'driver' && licenseImageUri) {
        const base64Uri = await imageToBase64(licenseImageUri);
        // Save the image URL in the user profiles
        await updateUserProfile(profile.uid, { photoURL: base64Uri });
        profile.photoURL = base64Uri;
      }

      // 3. Dispatch user state to global AppContext
      dispatch({ type: 'SET_USER', payload: profile });
      dispatch({ type: 'SET_ROLE', payload: role });
      dispatch({ type: 'SET_AUTHENTICATED', payload: true });
    } catch (error: any) {
      console.error('Registration failed:', error);
      let errorMessage = 'An unexpected error occurred. Please try again.';

      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email address is already in use by another account.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please enter a stronger password.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Registration Failed', errorMessage);
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
        <View style={styles.header}>
          <Text style={styles.title}>Join SheDrive</Text>
          <Text style={styles.subtitle}>Create an account to get started in Lahore</Text>
        </View>

        {/* Role Selector Tabs */}
        <View style={styles.roleTabs}>
          <TouchableOpacity
            style={[styles.roleTab, role === 'passenger' && styles.roleTabActive]}
            onPress={() => setRole('passenger')}
            disabled={isLoading}
          >
            <Text style={[styles.roleTabText, role === 'passenger' && styles.roleTabActiveText]}>
              👩 Passenger
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleTab, role === 'driver' && styles.roleTabActive]}
            onPress={() => setRole('driver')}
            disabled={isLoading}
          >
            <Text style={[styles.roleTabText, role === 'driver' && styles.roleTabActiveText]}>
              🚗 Driver
            </Text>
          </TouchableOpacity>
        </View>

        {/* General Form Fields */}
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor={Colors.light.textTertiary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={Colors.light.textTertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 03001234567"
              placeholderTextColor={Colors.light.textTertiary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Create password (min 6 chars)"
              placeholderTextColor={Colors.light.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          {/* Additional Driver Vehicle Fields */}
          {role === 'driver' && (
            <View style={styles.driverSection}>
              <Text style={styles.sectionHeading}>Vehicle Details</Text>

              <View style={styles.row}>
                <View style={[styles.inputContainer, { flex: 1 }]}>
                  <Text style={styles.label}>Vehicle Make</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Suzuki"
                    placeholderTextColor={Colors.light.textTertiary}
                    value={vehicleMake}
                    onChangeText={setVehicleMake}
                    editable={!isLoading}
                  />
                </View>

                <View style={[styles.inputContainer, { flex: 1 }]}>
                  <Text style={styles.label}>Vehicle Model</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Alto"
                    placeholderTextColor={Colors.light.textTertiary}
                    value={vehicleModel}
                    onChangeText={setVehicleModel}
                    editable={!isLoading}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputContainer, { flex: 1 }]}>
                  <Text style={styles.label}>Plate Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. LER 1234"
                    placeholderTextColor={Colors.light.textTertiary}
                    value={vehiclePlate}
                    onChangeText={setVehiclePlate}
                    autoCapitalize="characters"
                    editable={!isLoading}
                  />
                </View>

                <View style={[styles.inputContainer, { flex: 1 }]}>
                  <Text style={styles.label}>Color</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. White"
                    placeholderTextColor={Colors.light.textTertiary}
                    value={vehicleColor}
                    onChangeText={setVehicleColor}
                    editable={!isLoading}
                  />
                </View>
              </View>

              <View style={styles.uploadSection}>
                <Text style={styles.label}>Driving License Photo</Text>
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={handlePickLicense}
                  disabled={isLoading}
                >
                  <Text style={styles.uploadButtonText}>
                    {licenseImageUri ? 'Change License Photo' : 'Select License Photo'}
                  </Text>
                </TouchableOpacity>

                {licenseImageUri && (
                  <Image source={{ uri: licenseImageUri }} style={styles.licensePreview} />
                )}
              </View>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={styles.registerButton}
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.light.textOnPrimary} />
            ) : (
              <Text style={styles.registerButtonText}>Register</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer Redirect */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={isLoading}>
            <Text style={styles.loginLinkText}>Sign In</Text>
          </TouchableOpacity>
        </View>
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
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  roleTabs: {
    flexDirection: 'row',
    backgroundColor: Colors.light.divider,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  roleTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  roleTabActive: {
    backgroundColor: Colors.light.surface,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  roleTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  roleTabActiveText: {
    color: Colors.light.primary,
    fontWeight: '700',
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 16,
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
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.light.text,
  },
  driverSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.divider,
    paddingTop: 20,
    marginTop: 10,
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  uploadSection: {
    marginBottom: 20,
  },
  uploadButton: {
    backgroundColor: Colors.light.primaryGhost,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.light.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadButtonText: {
    color: Colors.light.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  licensePreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  registerButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  registerButtonText: {
    color: Colors.light.textOnPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
  },
  footerText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  loginLinkText: {
    color: Colors.light.primary,
    fontSize: 15,
    fontWeight: '700',
  },
});
