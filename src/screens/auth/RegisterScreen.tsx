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
  Modal,
  FlatList,
  Image,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthStackParamList, UserRole, VehicleCategoryId } from '../../types';
import Colors from '../../constants/Colors';
import { useApp } from '../../contexts/AppContext';
import { isValidPhone } from '../../utils/helpers';
import { getApiBaseUrl } from '../../config/apiConfig';
import PasswordStrengthIndicator from '../../components/PasswordStrengthIndicator';

type RegisterScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Register'>;

interface Props {
  navigation: RegisterScreenNavigationProp;
}

const CAR_MAKES = [
  'Suzuki', 'Toyota', 'Honda', 'Hyundai', 'Kia', 'Changan', 'MG', 'DFSK',
  'Prince', 'FAW', 'Isuzu', 'JAC', 'Proton', 'Audi', 'BMW', 'Mercedes',
  'Nissan', 'Mitsubishi', 'Others',
];

const CAR_MODELS_MAP: Record<string, string[]> = {
  Suzuki: ['Alto', 'Cultus', 'Wagon R', 'Swift', 'Bolan', 'Mehran', 'Every', 'Ciaz'],
  Toyota: ['Corolla', 'Yaris', 'Vitz', 'Passo', 'Fortuner', 'Hilux Revo', 'Prius', 'Aqua'],
  Honda: ['Civic', 'City', 'BR-V', 'HR-V', 'Vezel', 'N-One', 'N-Wgn'],
  Hyundai: ['Elantra', 'Tucson', 'Sonata', 'Grand Starex', 'Porter H-100'],
  Kia: ['Sportage', 'Picanto', 'Stonic', 'Sorento', 'Carnival'],
  Changan: ['Alsvin', 'Karvaan', 'Oshan X7', 'M9'],
  MG: ['HS', 'ZS', 'ZS EV', 'GT'],
  DFSK: ['Glory 580', 'K01'],
  Prince: ['Pearl', 'K07'],
  FAW: ['V2', 'X-PV', 'Carrier'],
  Isuzu: ['D-Max'],
  JAC: ['X200', 'T6'],
  Proton: ['Saga', 'X70'],
  Audi: ['A3', 'A4', 'A6', 'Q3', 'Q5'],
  BMW: ['3 Series', '5 Series', 'X1', 'X3'],
  Mercedes: ['C-Class', 'E-Class', 'GLA'],
  Nissan: ['Dayz', 'Clipper', 'Sunny', 'Note'],
  Mitsubishi: ['Ek Wagon', 'Mirage', 'Lancer', 'Pajero'],
  Others: ['Custom Car Model'],
};

const BIKE_MAKES = [
  'Honda', 'Yamaha', 'Suzuki', 'Super Power', 'Unique', 'United', 'Road Prince', 'Scooty / Electric', 'Others',
];

const BIKE_MODELS_MAP: Record<string, string[]> = {
  Honda: ['CD 70', 'CG 125', 'Pridor', 'CB 150F', 'CB 125F'],
  Yamaha: ['YBR 125', 'YB 125Z', 'YBR 125G', 'YB 125Z-DX'],
  Suzuki: ['GS 150', 'GD 110S', 'GR 150', 'GSX 125'],
  'Super Power': ['70cc', '100cc', '125cc', 'Scooty 110'],
  Unique: ['70cc', '100cc', '125cc', 'UD 100'],
  United: ['70cc', '100cc', '125cc', 'US 100'],
  'Road Prince': ['70cc', '110cc', '125cc', 'Wego 150'],
  'Scooty / Electric': ['E-Scooty', 'Automatic 110cc', 'Metro E-Bike', 'Crown Scooty', 'Super Star Scooty'],
  Others: ['Custom Bike / Scooty Model'],
};

const VEHICLE_YEARS = Array.from({ length: 2026 - 2005 + 1 }, (_, i) =>
  (2026 - i).toString()
);

const CITIES = [
  'Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 
  'Multan', 'Peshawar', 'Quetta', 'Sialkot', 'Gujranwala',
  'Hyderabad', 'Sukkur', 'Abbottabad', 'Murree', 'Swat',
];

export default function RegisterScreen({ navigation }: Props): React.JSX.Element {
  const { dispatch } = useApp();
  const [role, setRole] = useState<UserRole>('passenger');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [city, setCity] = useState('Lahore');
  const [cnicNumber, setCnicNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  // Document uploads
  const [cnicFrontUri, setCnicFrontUri] = useState<string | null>(null);
  const [cnicBackUri, setCnicBackUri] = useState<string | null>(null);
  const [licenseFrontUri, setLicenseFrontUri] = useState<string | null>(null);
  const [licenseBackUri, setLicenseBackUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [vehiclePhotoUri, setVehiclePhotoUri] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedFeeTerms, setAcceptedFeeTerms] = useState(false);

  // Driver vehicle details (No autofill - empty until selected)
  const [vehicleType, setVehicleType] = useState<'car' | 'bike'>('car');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategoryId>('mini');
  const [acOption, setAcOption] = useState<'ac' | 'non_ac' | 'both'>('both');

  const handleSwitchVehicleType = (type: 'car' | 'bike') => {
    setVehicleType(type);
    setVehicleMake('');
    setVehicleModel('');
    setVehicleYear('');
    setVehiclePlate('');
    setVehicleColor('');
    setVehicleCategory(type === 'bike' ? 'bike' : 'mini');
  };

  const [activePicker, setActivePicker] = useState<'make' | 'model' | 'year' | 'city' | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Image preview modal state (Done / Crop flow)
  const [imagePreview, setImagePreview] = useState<{
    uri: string;
    setter: (uri: string) => void;
    docName: string;
    originalUri: string; // Store original URI for re-cropping
  } | null>(null);

  const convertToBase64 = async (uri: string): Promise<string> => {
    try {
      if (!uri || typeof uri !== 'string') return '';
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        return uri;
      }
      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return `data:image/jpeg;base64,${base64Data}`;
    } catch {
      return uri;
    }
  };

  const handlePickDocument = async (
    setter: (uri: string) => void,
    docName: string
  ) => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', `Photo library access is needed to upload your ${docName}.`);
        return;
      }

      // Select image WITHOUT editing enabled first
      // This allows us to show the preview with both Crop and Done options
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        // Show preview modal with both Crop and Done buttons
        setImagePreview({
          uri: result.assets[0].uri,
          originalUri: result.assets[0].uri,
          setter,
          docName,
        });
      }
    } catch {
      Alert.alert('Upload Error', 'Could not open the photo gallery. Please try again.');
    }
  };

  const handlePreviewDone = async () => {
    if (!imagePreview) return;
    const finalUri = await convertToBase64(imagePreview.uri);
    imagePreview.setter(finalUri);
    setImagePreview(null);
  };

  const handlePreviewCrop = async () => {
    if (!imagePreview) return;
    try {
      // expo-image-picker doesn't support cropping an already-selected URI
      // The allowsEditing feature only works during initial selection
      // To crop, user needs to re-select the image with editing enabled
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio for profile pictures
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        // Update preview with the newly cropped image
        setImagePreview((prev) =>
          prev ? { ...prev, uri: result.assets[0].uri, originalUri: result.assets[0].uri } : null
        );
      }
      // If user cancels, keep the original image preview (don't close modal)
    } catch (error: any) {
      // If user cancelled, don't show error - just keep existing image
      if (error.message !== 'User cancelled' && !error.message?.includes('cancelled')) {
        Alert.alert('Crop Error', 'Could not open the cropping tool. Please try again.');
      }
    }
    // IMPORTANT: Never clear imagePreview here - keep the original image if crop is cancelled
  };


  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [cooldownTimer, setCooldownTimer] = useState(60);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  React.useEffect(() => {
    let interval: any;
    if (otpModalVisible && cooldownTimer > 0) {
      interval = setInterval(() => {
        setCooldownTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpModalVisible, cooldownTimer]);

  const handleInitiateRegistration = async () => {
    if (!name.trim() || !phone.trim() || !email.trim() || !password) {
      Alert.alert('Missing Information', 'Full name, phone number, email, and password are required.');
      return;
    }

    if (!isValidPhone(phone)) {
      Alert.alert(
        'Invalid Phone Number',
        'Please enter a valid Pakistani phone number (e.g., 03001234567).'
      );
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(password)) {
      Alert.alert(
        'Weak Password',
        'Password must be at least 8 characters with at least one uppercase letter, one lowercase letter, and one special character (e.g. @, #, $).'
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Password and Confirm Password do not match.');
      return;
    }

    // CNIC number validation (Mandatory for all users)
    if (!cnicNumber.trim()) {
      Alert.alert('CNIC Required', 'CNIC number is required for registration.');
      return;
    }

    const cnicRegex = /^\d{5}-\d{7}-\d{1}$|^\d{13}$/;
    if (!cnicRegex.test(cnicNumber.trim())) {
      Alert.alert(
        'Invalid CNIC',
        'Please enter a valid 13-digit Pakistani CNIC number (e.g., 12345-1234567-2).'
      );
      return;
    }

    // CNIC gender validation: Even last digit (0,2,4,6,8) = Female; Odd (1,3,5,7,9) = Male
    const cnicDigits = cnicNumber.trim().replace(/\D/g, '');
    const lastDigit = parseInt(cnicDigits.slice(-1), 10);
    if (lastDigit % 2 !== 0) {
      Alert.alert(
        'CNIC Gender Mismatch',
        'This CNIC indicates male gender. SheDrive is strictly dedicated to female passengers and drivers.'
      );
      return;
    }

    if (!acceptedTerms) {
      Alert.alert(
        'Terms & Conditions Required',
        'Please accept the Terms & Conditions and Privacy Policy to proceed with registration.'
      );
      return;
    }

    if (role === 'driver') {
      if (!acceptedFeeTerms) {
        Alert.alert(
          'Platform Fee Agreement Required',
          'Please accept the 7% monthly platform fee agreement to register as a SheDrive driver partner.'
        );
        return;
      }

      // Date of birth validation - must be at least 19 years old (exact dynamic date comparison)
      if (!dateOfBirth) {
        Alert.alert('Date of Birth Required', 'Please enter your date of birth.');
        return;
      }
      
      const dob = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      
      if (age < 19) {
        Alert.alert(
          'Age Requirement',
          'You must be at least 19 years old to register as a SheDrive driver.'
        );
        return;
      }

      if (!vehicleMake || !vehicleModel || !vehiclePlate.trim() || !vehicleColor.trim()) {
        Alert.alert('Vehicle Details Required', 'All vehicle details (Make, Model, Year, Plate, Color) are required for drivers.');
        return;
      }
      if (!cnicFrontUri || !cnicBackUri || !licenseFrontUri || !licenseBackUri || !selfieUri || !vehiclePhotoUri) {
        Alert.alert(
          'Documents Required',
          'CNIC (Front & Back), Driving License (Front & Back), Profile Photo, and Vehicle Photo are all required for driver registration.'
        );
        return;
      }
    }

    try {
      setIsLoading(true);
      const formattedEmail = email.trim().toLowerCase();

      // Step 1: Request Email OTP via Gmail SMTP
      const res = await fetch(`${getApiBaseUrl()}/auth/send-registration-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formattedEmail,
          phone: phone.trim(),
          role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          Alert.alert(
            'Account Already Exists',
            data.error || 'An account with this phone number or email is already registered. Please sign in instead.'
          );
        } else {
          Alert.alert('Verification Failed', data.error || 'Failed to send verification code. Please check your email address.');
        }
        return;
      }

      // Open OTP Verification Modal
      setOtpCode('');
      setCooldownTimer(60);
      setOtpModalVisible(true);
    } catch (error: any) {
      Alert.alert(
        'Unable to Connect',
        'Could not reach the server. Please check your internet connection and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldownTimer > 0) return;
    try {
      setIsLoading(true);
      const formattedEmail = email.trim().toLowerCase();
      const res = await fetch(`${getApiBaseUrl()}/auth/send-registration-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formattedEmail,
          phone: phone.trim(),
          role,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Resend Failed', data.error || 'Unable to resend code.');
        return;
      }

      setCooldownTimer(60);
      Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
    } catch (error) {
      Alert.alert('Unable to Connect', 'Could not reach server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndRegister = async () => {
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit verification code sent to your email.');
      return;
    }

    try {
      setIsVerifyingOtp(true);
      const formattedEmail = email.trim().toLowerCase();

      // Step 2: Verify OTP
      const verifyRes = await fetch(`${getApiBaseUrl()}/auth/verify-registration-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formattedEmail,
          otp: otpCode.trim(),
        }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        Alert.alert('Verification Error', verifyData.error || 'Invalid verification code.');
        setIsVerifyingOtp(false);
        return;
      }

      // Step 3: Complete Account Creation
      const vehicleInfo =
        role === 'driver'
          ? {
              category: vehicleCategory,
              make: vehicleMake,
              model: vehicleModel,
              year: vehicleYear,
              plate: vehiclePlate.trim().toUpperCase(),
              color: vehicleColor.trim(),
            }
          : undefined;

      const regRes = await fetch(`${getApiBaseUrl()}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: formattedEmail,
          password,
          role,
          cnic: cnicNumber.trim(),
          cnicFrontUrl: cnicFrontUri || undefined,
          cnicBackUrl: cnicBackUri || undefined,
          dateOfBirth: role === 'driver' ? dateOfBirth : undefined,
          vehicleInfo,
          licenseFrontUrl: role === 'driver' ? licenseFrontUri : undefined,
          licenseBackUrl: role === 'driver' ? licenseBackUri : undefined,
          selfieUrl: role === 'driver' ? selfieUri : undefined,
          vehiclePhotoUrl: role === 'driver' ? vehiclePhotoUri : undefined,
          acOption: role === 'driver' ? acOption : undefined,
          acceptedTerms: true,
          city,
        }),
      });

      const regData = await regRes.json();

      if (!regRes.ok) {
        Alert.alert('Registration Error', regData.error || 'Could not complete registration.');
        setIsVerifyingOtp(false);
        return;
      }

      const newUserProfile = {
        uid: regData.user.id,
        phone: regData.user.phone,
        email: regData.user.email,
        name: regData.user.name,
        role: regData.user.role,
        cnic: regData.user.cnic || cnicNumber.trim(),
        gender: 'female' as const,
        dateOfBirth: regData.user.dateOfBirth || (role === 'driver' ? dateOfBirth : undefined),
        isVerified: regData.user.isVerified ?? (role === 'passenger'),
        photoURL: regData.user.photo_url || regData.user.photoURL || undefined,
        createdAt: Date.now(),
      };

      if (regData.token) {
        dispatch({ type: 'SET_TOKEN', payload: regData.token });
        AsyncStorage.setItem('@shedrive_auth_token', regData.token).catch(() => {});
        AsyncStorage.setItem('@shedrive_user_profile', JSON.stringify(newUserProfile)).catch(() => {});
        AsyncStorage.setItem('@shedrive_remember_me', formattedEmail).catch(() => {});
        AsyncStorage.setItem('@shedrive_remember_me_flag', 'true').catch(() => {});
      }

      // Successfully registered & verified — log user in
      dispatch({ type: 'SET_USER', payload: newUserProfile });
      dispatch({ type: 'SET_ROLE', payload: regData.user.role });
      dispatch({ type: 'SET_AUTHENTICATED', payload: true });
    } catch (error) {
      Alert.alert('Connection Error', 'Could not complete registration. Please check your network.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const getAvailableMakes = () =>
    vehicleType === 'bike' ? BIKE_MAKES : CAR_MAKES;

  const getAvailableModels = () => {
    const modelsMap = vehicleType === 'bike' ? BIKE_MODELS_MAP : CAR_MODELS_MAP;
    return modelsMap[vehicleMake] || ['Standard Model'];
  };


  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Join SheDrive</Text>
          <Text style={styles.subtitle}>
            Create an account to get started in Lahore
          </Text>
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

        <View style={styles.form}>
          {/* Basic Information */}
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>Account Details</Text>
            
            {/* Full Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name *</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>👤</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Ayesha Khan"
                  placeholderTextColor={Colors.light.textTertiary}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  editable={!isLoading}
                />
              </View>
            </View>

            {/* Mobile Phone */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Mobile Phone * (11 Digits)</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>📱</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 03001234567"
                  placeholderTextColor={Colors.light.textTertiary}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={11}
                  editable={!isLoading}
                />
              </View>
            </View>

            {/* Email Address */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address *</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>📧</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., ayesha@example.com"
                  placeholderTextColor={Colors.light.textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
            </View>

            {/* City Selection */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>City *</Text>
              <TouchableOpacity
                style={styles.dropdownInput}
                onPress={() => setActivePicker('city')}
                disabled={isLoading}
              >
                <Text style={styles.dropdownText}>{city}</Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>
            </View>

            {/* Password */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password * (Min 8 chars, Upper, Lower, Special)</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. SheDrive#2026"
                  placeholderTextColor={Colors.light.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.eyeIconText}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
              <PasswordStrengthIndicator password={password} />
            </View>

            {/* Confirm Password */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password *</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter your password"
                  placeholderTextColor={Colors.light.textTertiary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeIcon}
                >
                  <Text style={styles.eyeIconText}>{showConfirmPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
              {password.length > 0 && confirmPassword.length > 0 && (
                <Text style={password === confirmPassword ? styles.passwordMatchSuccess : styles.passwordMatchError}>
                  {password === confirmPassword ? '✓ Passwords match' : '✕ Passwords do not match'}
                </Text>
              )}
            </View>

            {/* CNIC Number */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>CNIC Number *</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>🪪</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 12345-1234567-2"
                  placeholderTextColor={Colors.light.textTertiary}
                  value={cnicNumber}
                  onChangeText={setCnicNumber}
                  keyboardType="number-pad"
                  editable={!isLoading}
                />
              </View>
            </View>
          </View>

          {/* Driver-only fields */}
          {role === 'driver' && (
            <View style={styles.driverSection}>
              <View style={styles.card}>
                <Text style={styles.sectionHeading}>📅 Personal Information</Text>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Date of Birth *</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputIcon}>🎂</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={Colors.light.textTertiary}
                      value={dateOfBirth}
                      onChangeText={setDateOfBirth}
                      editable={!isLoading}
                    />
                  </View>
                  <Text style={styles.helperText}>
                    You must be at least 19 years old to register as a driver.
                  </Text>
                </View>
              </View>

              {/* Vehicle Type Selection Row */}
              <View style={[styles.card, { marginTop: 16 }]}>
                <Text style={styles.sectionHeading}>🛵 Vehicle Type Selection</Text>
                <View style={styles.vehicleTypeRow}>
                  <TouchableOpacity
                    style={[
                      styles.vehicleTypePill,
                      vehicleType === 'bike' && styles.vehicleTypePillActive,
                    ]}
                    onPress={() => handleSwitchVehicleType('bike')}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.vehicleTypePillText,
                        vehicleType === 'bike' && styles.vehicleTypePillTextActive,
                      ]}
                    >
                      🛵 Bike / Scooty
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.vehicleTypePill,
                      vehicleType === 'car' && styles.vehicleTypePillActive,
                    ]}
                    onPress={() => handleSwitchVehicleType('car')}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.vehicleTypePillText,
                        vehicleType === 'car' && styles.vehicleTypePillTextActive,
                      ]}
                    >
                      🚗 Car
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Dynamic Vehicle Details Form */}
              <View style={[styles.card, { marginTop: 16 }]}>
                <Text style={styles.sectionHeading}>
                  {vehicleType === 'bike' ? '🛵 Bike / Scooty Details' : '🚗 Car Details'}
                </Text>

                {/* Car Category selection (Shown ONLY when Car is selected) */}
                {vehicleType === 'car' && (
                  <>
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Car Category *</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                        {[
                          { id: 'mini', label: 'Mini' },
                          { id: 'sedan', label: 'Sedan' },
                          { id: 'premium', label: 'Premium' },
                          { id: 'family', label: 'Family XL' },
                        ].map((cat) => (
                          <TouchableOpacity
                            key={cat.id}
                            style={[
                              styles.catChip,
                              vehicleCategory === cat.id && styles.catChipActive,
                            ]}
                            onPress={() => setVehicleCategory(cat.id as VehicleCategoryId)}
                          >
                            <Text
                              style={[
                                styles.catChipText,
                                vehicleCategory === cat.id && styles.catChipTextActive,
                              ]}
                            >
                              {cat.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>

                    {/* AC Availability Option */}
                    <View style={[styles.inputContainer, { marginTop: 4 }]}>
                      <Text style={styles.label}>Air Conditioning (AC) Option</Text>
                      <Text style={{ fontSize: 12, color: Colors.light.textTertiary, marginBottom: 6, fontStyle: 'italic' }}>You can select both AC and Non-AC.</Text>
                      <View style={styles.vehicleTypeRow}>
                        <TouchableOpacity
                          style={[styles.vehicleTypePill, acOption === 'ac' && styles.vehicleTypePillActive]}
                          onPress={() => setAcOption('ac')}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.vehicleTypePillText, acOption === 'ac' && styles.vehicleTypePillTextActive]}>
                            ❄️ AC
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.vehicleTypePill, acOption === 'non_ac' && styles.vehicleTypePillActive]}
                          onPress={() => setAcOption('non_ac')}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.vehicleTypePillText, acOption === 'non_ac' && styles.vehicleTypePillTextActive]}>
                            🍃 Non-AC
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.vehicleTypePill, acOption === 'both' && styles.vehicleTypePillActive]}
                          onPress={() => setAcOption('both')}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.vehicleTypePillText, acOption === 'both' && styles.vehicleTypePillTextActive]}>
                            ❄️🍃 Both
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}

                <View style={styles.row}>
                  <View style={[styles.inputContainer, { flex: 1 }]}>
                    <Text style={styles.label}>Make *</Text>
                    <TouchableOpacity
                      style={styles.dropdownInput}
                      onPress={() => setActivePicker('make')}
                      disabled={isLoading}
                    >
                      <Text style={vehicleMake ? styles.dropdownText : styles.dropdownPlaceholder}>
                        {vehicleMake || 'Select Make'}
                      </Text>
                      <Text style={styles.dropdownArrow}>▼</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.inputContainer, { flex: 1 }]}>
                    <Text style={styles.label}>Model *</Text>
                    <TouchableOpacity
                      style={styles.dropdownInput}
                      onPress={() => {
                        if (!vehicleMake) {
                          Alert.alert('Select Make First', 'Please select a vehicle make before picking a model.');
                          return;
                        }
                        setActivePicker('model');
                      }}
                      disabled={isLoading}
                    >
                      <Text style={vehicleModel ? styles.dropdownText : styles.dropdownPlaceholder}>
                        {vehicleModel || 'Select Model'}
                      </Text>
                      <Text style={styles.dropdownArrow}>▼</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputContainer, { flex: 1 }]}>
                    <Text style={styles.label}>Year *</Text>
                    <TouchableOpacity
                      style={styles.dropdownInput}
                      onPress={() => setActivePicker('year')}
                      disabled={isLoading}
                    >
                      <Text style={vehicleYear ? styles.dropdownText : styles.dropdownPlaceholder}>
                        {vehicleYear || 'Select Year'}
                      </Text>
                      <Text style={styles.dropdownArrow}>▼</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.inputContainer, { flex: 1 }]}>
                    <Text style={styles.label}>Plate Number *</Text>
                    <View style={styles.inputWrapper}>
                      <Text style={styles.inputIcon}>{vehicleType === 'bike' ? '🛵' : '🚘'}</Text>
                      <TextInput
                        style={styles.input}
                        placeholder={vehicleType === 'bike' ? 'e.g. KHI-1234' : 'e.g. LER-1234'}
                        placeholderTextColor={Colors.light.textTertiary}
                        value={vehiclePlate}
                        onChangeText={setVehiclePlate}
                        autoCapitalize="characters"
                        editable={!isLoading}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Vehicle Color *</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputIcon}>🎨</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Red / Black / Silver"
                      placeholderTextColor={Colors.light.textTertiary}
                      value={vehicleColor}
                      onChangeText={setVehicleColor}
                      editable={!isLoading}
                    />
                  </View>
                </View>
              </View>

              {/* Document uploads: CNIC -> Driving License -> Photos */}
              <View style={styles.uploadSection}>
                <Text style={styles.label}>CNIC Card Front &amp; Back *</Text>
                <View style={styles.row}>
                  <TouchableOpacity
                    style={[styles.uploadButton, { flex: 1 }]}
                    onPress={() => handlePickDocument(setCnicFrontUri, 'CNIC Front')}
                    disabled={isLoading}
                  >
                    <Text style={styles.uploadButtonText}>
                      {cnicFrontUri ? '✓ CNIC Front' : 'CNIC Front'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.uploadButton, { flex: 1 }]}
                    onPress={() => handlePickDocument(setCnicBackUri, 'CNIC Back')}
                    disabled={isLoading}
                  >
                    <Text style={styles.uploadButtonText}>
                      {cnicBackUri ? '✓ CNIC Back' : 'CNIC Back'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.label, { marginTop: 12 }]}>Driving License Front &amp; Back *</Text>
                <View style={styles.row}>
                  <TouchableOpacity
                    style={[styles.uploadButton, { flex: 1 }]}
                    onPress={() => handlePickDocument(setLicenseFrontUri, 'License Front')}
                    disabled={isLoading}
                  >
                    <Text style={styles.uploadButtonText}>
                      {licenseFrontUri ? '✓ License Front' : 'License Front'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.uploadButton, { flex: 1 }]}
                    onPress={() => handlePickDocument(setLicenseBackUri, 'License Back')}
                    disabled={isLoading}
                  >
                    <Text style={styles.uploadButtonText}>
                      {licenseBackUri ? '✓ License Back' : 'License Back'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.label, { marginTop: 12 }]}>Profile Photo *</Text>
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={() => handlePickDocument(setSelfieUri, 'Profile Photo')}
                  disabled={isLoading}
                >
                  <Text style={styles.uploadButtonText}>
                    {selfieUri ? '✓ Profile Photo Attached' : 'Upload Profile Photo'}
                  </Text>
                </TouchableOpacity>

                <Text style={[styles.label, { marginTop: 12 }]}>Vehicle Photo *</Text>
                <Text style={styles.helperText}>
                  Upload a clear photo of your vehicle. The vehicle's number plate must be clearly visible.
                </Text>
                <TouchableOpacity
                  style={[styles.uploadButton, { marginTop: 8 }]}
                  onPress={() => handlePickDocument(setVehiclePhotoUri, 'Vehicle Photo')}
                  disabled={isLoading}
                >
                  <Text style={styles.uploadButtonText}>
                    {vehiclePhotoUri ? '✓ Vehicle Photo Attached' : 'Upload Vehicle Photo'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Mandatory Terms & Conditions Checkbox */}
          <TouchableOpacity
            style={styles.termsContainer}
            onPress={() => setAcceptedTerms(!acceptedTerms)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, acceptedTerms && styles.checkboxActive]}>
              {acceptedTerms && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.termsText}>
              I agree to the{' '}
              <Text
                style={styles.termsLink}
                onPress={() => (navigation as any).navigate('TermsAndConditions')}
              >
                Terms &amp; Conditions
              </Text>{' '}
              and{' '}
              <Text
                style={styles.termsLink}
                onPress={() => (navigation as any).navigate('PrivacyPolicy')}
              >
                Privacy Policy
              </Text>.
            </Text>
          </TouchableOpacity>

          {/* Mandatory 7% Platform Fee Agreement for Drivers */}
          {role === 'driver' && (
            <View style={[styles.termsContainer, { marginTop: 10 }]}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setAcceptedFeeTerms(!acceptedFeeTerms)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, acceptedFeeTerms && styles.checkboxActive]}>
                  {acceptedFeeTerms && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.feeTextContainer}
                onPress={() => (navigation as any).navigate('PlatformFeeInfo')}
                activeOpacity={0.7}
              >
                <Text style={styles.termsText}>
                  I agree to pay the <Text style={{ fontWeight: '800', color: Colors.light.primary }}>7% monthly platform fee</Text> on total completed ride earnings.
                </Text>
                <Text style={styles.linkText}>Tap to view details</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={styles.registerButton}
            onPress={handleInitiateRegistration}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.light.textOnPrimary} />
            ) : (
              <Text style={styles.registerButtonText}>Register Account</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={isLoading}>
            <Text style={styles.loginLinkText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* OTP Email Verification Modal */}
      <Modal
        visible={otpModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isVerifyingOtp) setOtpModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.otpModalOverlay}
        >
          <View style={styles.otpModalBox}>
            <Text style={styles.otpModalIcon}>📧</Text>
            <Text style={styles.otpModalTitle}>Email Verification</Text>
            <Text style={styles.otpModalSubtitle}>
              We sent a 6-digit verification code to:{'\n'}
              <Text style={{ fontWeight: '700', color: Colors.light.primary }}>{email}</Text>
            </Text>

            <View style={styles.otpInputContainer}>
              <TextInput
                style={styles.otpInput}
                placeholder="6-Digit OTP"
                placeholderTextColor={Colors.light.textTertiary}
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="number-pad"
                maxLength={6}
                editable={!isVerifyingOtp}
              />
            </View>

            <TouchableOpacity
              style={[styles.otpSubmitButton, isVerifyingOtp && { opacity: 0.8 }]}
              onPress={handleVerifyAndRegister}
              disabled={isVerifyingOtp}
            >
              {isVerifyingOtp ? (
                <ActivityIndicator color={Colors.light.textOnPrimary} />
              ) : (
                <Text style={styles.otpSubmitButtonText}>Verify & Complete Registration</Text>
              )}
            </TouchableOpacity>

            <View style={styles.otpResendRow}>
              <TouchableOpacity
                onPress={handleResendOtp}
                disabled={cooldownTimer > 0 || isVerifyingOtp}
              >
                <Text
                  style={[
                    styles.otpResendText,
                    cooldownTimer > 0 && { color: Colors.light.textTertiary },
                  ]}
                >
                  {cooldownTimer > 0
                    ? `Resend Code in ${cooldownTimer}s`
                    : 'Resend Verification Code'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.otpCancelButton}
              onPress={() => setOtpModalVisible(false)}
              disabled={isVerifyingOtp}
            >
              <Text style={styles.otpCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Image Preview Modal (Done / Crop options) */}
      {imagePreview && (
        <Modal visible transparent animationType="slide">
          <View style={styles.imgPreviewOverlay}>
            <View style={styles.imgPreviewContainer}>
              <Text style={styles.imgPreviewTitle}>
                Review Photo ({imagePreview.docName})
              </Text>
              <Text style={styles.imgPreviewSubtitle}>
                Check your full image below. Choose "Done" to use as-is, or "Crop" to crop manually.
              </Text>

              <View style={styles.imgPreviewBox}>
                <Image
                  source={{ uri: imagePreview.uri }}
                  style={styles.imgPreviewImage}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.imgPreviewBtnRow}>
                <TouchableOpacity
                  style={[styles.imgPreviewBtn, styles.imgPreviewCropBtn]}
                  onPress={handlePreviewCrop}
                  activeOpacity={0.8}
                >
                  <Text style={styles.imgPreviewCropBtnText}>✂️ Crop</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.imgPreviewBtn, styles.imgPreviewDoneBtn]}
                  onPress={handlePreviewDone}
                  activeOpacity={0.8}
                >
                  <Text style={styles.imgPreviewDoneBtnText}>✓ Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Dropdown Selection Modal */}
      {activePicker && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                Select {activePicker.charAt(0).toUpperCase() + activePicker.slice(1)}
              </Text>
              <FlatList
                data={
                  activePicker === 'make'
                    ? getAvailableMakes()
                    : activePicker === 'model'
                    ? getAvailableModels()
                    : activePicker === 'city'
                    ? CITIES
                    : VEHICLE_YEARS
                }
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalOption}
                    onPress={() => {
                      if (activePicker === 'make') {
                        setVehicleMake(item);
                        setVehicleModel('');
                      } else if (activePicker === 'model') {
                        setVehicleModel(item);
                      } else if (activePicker === 'city') {
                        setCity(item);
                      } else {
                        setVehicleYear(item);
                      }
                      setActivePicker(null);
                    }}
                  >
                    <Text style={styles.modalOptionText}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setActivePicker(null)}
              >
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
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
    fontWeight: '700',
    fontSize: 15,
  },
  imgPreviewCancelBtn: {
    paddingVertical: 8,
  },
  imgPreviewCancelText: {
    color: Colors.light.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  form: {
    flex: 1,
  },
  roleTabs: {
    flexDirection: 'row',
    backgroundColor: Colors.light.divider,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
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
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 16,
    letterSpacing: 0.2,
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
  eyeIcon: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  eyeIconText: {
    fontSize: 18,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.light.text,
    fontWeight: '500',
  },
  helperText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  dropdownInput: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: { fontSize: 16, color: Colors.light.text },
  dropdownArrow: { fontSize: 12, color: Colors.light.textTertiary },
  driverSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.divider,
    paddingTop: 20,
    marginTop: 10,
    marginBottom: 10,
  },
  sectionHeading: { fontSize: 18, fontWeight: '700', color: Colors.light.text, marginBottom: 16 },
  row: { flexDirection: 'row', gap: 16 },
  uploadSection: { marginBottom: 20 },
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
  uploadButtonText: { color: Colors.light.primary, fontSize: 15, fontWeight: '600' },
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
  registerButtonText: { color: Colors.light.textOnPrimary, fontSize: 18, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 30 },
  footerText: { fontSize: 15, color: Colors.light.textSecondary },
  loginLinkText: { color: Colors.light.primary, fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '60%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.light.text, marginBottom: 16 },
  modalOption: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.light.divider },
  modalOptionText: { fontSize: 16, color: Colors.light.text, fontWeight: '500' },
  modalCloseButton: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.light.divider,
    borderRadius: 12,
  },
  modalCloseText: { fontSize: 16, fontWeight: '600', color: Colors.light.textSecondary },

  // Terms & Conditions Checkbox Styles
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.light.primary,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
  },
  checkboxActive: {
    backgroundColor: Colors.light.primary,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginTop: -2,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 19,
    fontWeight: '500',
  },
  termsLink: {
    color: Colors.light.primary,
    fontWeight: '700',
  },
  checkboxContainer: {
    marginRight: 12,
  },
  feeTextContainer: {
    flex: 1,
  },
  linkText: {
    fontSize: 12,
    color: Colors.light.primary,
    fontWeight: '700',
    marginTop: 2,
  },

  // OTP Verification Modal Styles
  otpModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  otpModalBox: {
    backgroundColor: Colors.light.surface,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  otpModalIcon: {
    fontSize: 44,
    marginBottom: 12,
  },
  otpModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  otpModalSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  otpInputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  otpInput: {
    backgroundColor: Colors.light.primaryGhost,
    borderWidth: 2,
    borderColor: Colors.light.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    fontSize: 24,
    fontWeight: '800',
    color: Colors.light.primary,
    textAlign: 'center',
    letterSpacing: 6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  otpSubmitButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  otpSubmitButtonText: {
    color: Colors.light.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  otpResendRow: {
    marginBottom: 16,
  },
  otpResendText: {
    color: Colors.light.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  otpCancelButton: {
    paddingVertical: 8,
  },
  otpCancelText: {
    color: Colors.light.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  vehicleTypeRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  vehicleTypePill: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: Colors.light.background,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleTypePillActive: {
    backgroundColor: Colors.light.primaryGhost,
    borderColor: Colors.light.primary,
  },
  vehicleTypePillText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  vehicleTypePillTextActive: {
    fontWeight: '800',
    color: Colors.light.primary,
  },
  dropdownPlaceholder: {
    fontSize: 14,
    color: Colors.light.textTertiary,
  },
  catChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginRight: 8,
  },
  catChipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  catChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  catChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  passwordMatchSuccess: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7D32',
  },
  passwordMatchError: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.error,
  },
});
