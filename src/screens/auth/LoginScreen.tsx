import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthStackParamList, UserRole } from '../../types';
import Colors from '../../constants/Colors';
import { useApp } from '../../contexts/AppContext';
import { getApiBaseUrl } from '../../config/apiConfig';
import loginSecurity from '../../utils/loginSecurity';
import sessionManager from '../../utils/sessionManager';


type LoginScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

export default function LoginScreen({ navigation }: Props): React.JSX.Element {
  const { dispatch } = useApp();
  const [accountType, setAccountType] = useState<UserRole>('passenger');
  const [identifier, setIdentifier] = useState(''); // Can be email or phone
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTimeRemaining, setLockoutTimeRemaining] = useState(0);

  useEffect(() => {
    // Load saved Remember Me identifier on mount
    AsyncStorage.getItem('@shedrive_remember_me').then((savedIdentifier) => {
      if (savedIdentifier) {
        setIdentifier(savedIdentifier);
      }
    }).catch(() => {});
  }, []);

  const checkLockoutStatus = async () => {
    if (!identifier) return;
    
    const lockoutStatus = await loginSecurity.isLockedOut(identifier);
    if (lockoutStatus.locked && lockoutStatus.remainingTime) {
      setIsLocked(true);
      setLockoutTimeRemaining(lockoutStatus.remainingTime);
      
      // Update countdown every second
      const interval = setInterval(async () => {
        const status = await loginSecurity.isLockedOut(identifier);
        if (!status.locked) {
          setIsLocked(false);
          setLockoutTimeRemaining(0);
          clearInterval(interval);
        } else if (status.remainingTime) {
          setLockoutTimeRemaining(status.remainingTime);
        }
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setIsLocked(false);
      setLockoutTimeRemaining(0);
    }
  };

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      Alert.alert(
        "Missing Information",
        "Please enter your mobile number/email and password."
      );
      return;
    }

    // Check if account is locked out
    const lockoutStatus = await loginSecurity.isLockedOut(identifier.trim());
    if (lockoutStatus.locked) {
      const remainingTime = loginSecurity.formatRemainingTime(lockoutStatus.remainingTime || 0);
      Alert.alert(
        'Account Locked',
        `Too many failed login attempts. Please try again in ${remainingTime}.`
      );
      return;
    }

    try {
      setIsLoading(true);

      const res = await fetch(`${getApiBaseUrl()}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
          role: accountType,
        }),
      });

      const data = await res.json();

      if (res.status === 403) {
        Alert.alert(
          'Account Suspended',
          data.error || 'Your account has been suspended.'
        );
        return;
      }

      if (res.status === 401) {
        // Record failed attempt
        await loginSecurity.recordFailedAttempt(identifier.trim());
        
        const remainingAttempts = await loginSecurity.getRemainingAttempts(identifier.trim());
        const newLockoutStatus = await loginSecurity.isLockedOut(identifier.trim());
        
        if (newLockoutStatus.locked) {
          const remainingTime = loginSecurity.formatRemainingTime(newLockoutStatus.remainingTime || 0);
          Alert.alert(
            'Account Locked',
            `Too many failed login attempts. Please try again in ${remainingTime}.`
          );
          setIsLocked(true);
          checkLockoutStatus();
        } else {
          Alert.alert(
            'Incorrect Credentials',
            `Incorrect mobile number/email or password. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`
          );
        }
        return;
      }

      if (!res.ok) {
        Alert.alert('Sign In Failed', data.error || 'Unable to sign in. Please try again.');
        return;
      }

      if (data.user.role !== accountType) {
        Alert.alert(
          'Wrong Account Type',
          `This account is registered as a ${data.user.role === 'driver' ? 'Driver' : 'Passenger'}. Please select ${data.user.role === 'driver' ? 'Driver' : 'Passenger'} above to sign in.`
        );
        return;
      }

      // Record successful login
      await loginSecurity.recordSuccessfulLogin(identifier.trim());

      // Save session with session manager
      await sessionManager.saveSession(
        data.token,
        data.refreshToken,
        data.expiresAt,
        rememberMe
      );

      // Build defensive user profile object
      const isDriver = data.user.role === 'driver';
      const userProfile: any = {
        uid: data.user.id,
        phone: data.user.phone || '',
        email: data.user.email || '',
        name: data.user.name || '',
        role: data.user.role,
        cnic: data.user.cnic || '',
        gender: data.user.gender || 'female',
        isVerified: Boolean(data.user.isVerified ?? data.user.is_verified ?? (!isDriver)),
        verificationStatus: data.user.verificationStatus || data.user.verification_status || (data.user.is_verified ? 'approved' : 'pending'),
        photoURL: data.user.photo_url || data.user.photoURL || undefined,
        createdAt: Date.now(),
      };

      if (isDriver) {
        userProfile.vehicleInfo = data.user.vehicleInfo || {
          make: data.user.vehicle_make || '',
          model: data.user.vehicle_model || '',
          plate: data.user.vehicle_plate || '',
          color: data.user.vehicle_color || '',
          year: data.user.vehicle_year || '2022',
          category: data.user.vehicle_category || data.user.vehicleCategory || 'mini',
        };
        userProfile.vehicleCategory = data.user.vehicleCategory || data.user.vehicle_category || userProfile.vehicleInfo.category || 'mini';
        userProfile.isOnline = Boolean(data.user.isOnline ?? data.user.is_online ?? false);
        userProfile.isAvailable = Boolean(data.user.isAvailable ?? data.user.is_available ?? true);
        userProfile.rating = typeof data.user.rating === 'number' ? data.user.rating : parseFloat(data.user.rating || '5.0');
        userProfile.totalRides = typeof data.user.totalRides === 'number' ? data.user.totalRides : parseInt(data.user.total_rides || '0', 10);
        userProfile.earningsToday = typeof data.user.earningsToday === 'number' ? data.user.earningsToday : 0;
        userProfile.isFeeSuspended = Boolean(data.user.isFeeSuspended ?? data.user.is_fee_suspended ?? false);
        userProfile.licenseFrontUrl = data.user.licenseFrontUrl || data.user.license_front_url || null;
        userProfile.licenseBackUrl = data.user.licenseBackUrl || data.user.license_back_url || null;
        userProfile.cnicFrontUrl = data.user.cnicFrontUrl || data.user.cnic_front_url || null;
        userProfile.cnicBackUrl = data.user.cnicBackUrl || data.user.cnic_back_url || null;
      }

      if (rememberMe) {
        AsyncStorage.setItem('@shedrive_remember_me', identifier.trim()).catch(() => {});
        AsyncStorage.setItem('@shedrive_remember_me_flag', 'true').catch(() => {});
      } else {
        AsyncStorage.removeItem('@shedrive_remember_me').catch(() => {});
        AsyncStorage.setItem('@shedrive_remember_me_flag', 'false').catch(() => {});
      }

      // Persist last active role & user session for seamless auto-restore
      AsyncStorage.setItem('@shedrive_last_active_role', data.user.role).catch(() => {});

      if (data.token) {
        dispatch({ type: 'SET_TOKEN', payload: data.token });
        AsyncStorage.setItem('@shedrive_auth_token', data.token).catch(() => {});
        AsyncStorage.setItem('@shedrive_user_profile', JSON.stringify(userProfile)).catch(() => {});
      }

      dispatch({ type: 'SET_USER', payload: userProfile });
      dispatch({ type: 'SET_ROLE', payload: data.user.role });
      dispatch({ type: 'SET_AUTHENTICATED', payload: true });

    } catch (error: any) {
      Alert.alert(
        "Connection Error",
        "Unable to connect to server. Please check your internet connection and try again."
      );
    } finally {
      setIsLoading(false);
    }
};

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Text style={styles.brandIcon}>{accountType === 'driver' ? '🚗' : '👩'}</Text>
          </View>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue your safe journey with SheDrive</Text>
        </View>

        {/* Elevated Form Card */}
        <View style={styles.card}>
          {/* Account Type Selector Tabs */}
          <Text style={styles.label}>Sign in as</Text>
          <View style={styles.roleTabs}>
            <TouchableOpacity
              style={[styles.roleTab, accountType === 'passenger' && styles.roleTabActive]}
              onPress={() => setAccountType('passenger')}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <Text style={[styles.roleTabText, accountType === 'passenger' && styles.roleTabActiveText]}>
                👩 Passenger
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleTab, accountType === 'driver' && styles.roleTabActive]}
              onPress={() => setAccountType('driver')}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <Text style={[styles.roleTabText, accountType === 'driver' && styles.roleTabActiveText]}>
                🚗 Driver
              </Text>
            </TouchableOpacity>
          </View>

          {/* Mobile Number / Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Mobile Number or Email</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>📱</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 03001234567 or email@example.com"
                placeholderTextColor={Colors.light.textTertiary}
                value={identifier}
                onChangeText={setIdentifier}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                textContentType="none"
                importantForAutofill="no"
                editable={!isLoading}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
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
          </View>

          {/* Remember Me & Forgot Password Row */}
          <View style={styles.rememberForgotRow}>
            <TouchableOpacity
              style={styles.rememberMeContainer}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                {rememberMe && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.rememberMeText}>Remember Me</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.forgotPasswordLink}
              onPress={() => navigation.navigate('ForgotPassword')}
              disabled={isLoading}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.light.textOnPrimary} />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Register Redirect Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')} disabled={isLoading}>
            <Text style={styles.registerLinkText}>Register Now</Text>
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
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  header: {
    marginTop: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  iconBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: Colors.light.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  brandIcon: {
    fontSize: 40,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.light.text,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
    fontWeight: '500',
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 24,
    padding: 22,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 20,
  },
  roleTabs: {
    flexDirection: 'row',
    backgroundColor: Colors.light.divider,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  roleTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
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
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  roleTabActiveText: {
    color: Colors.light.primary,
    fontWeight: '700',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
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
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.light.text,
    fontWeight: '500',
  },
  rememberForgotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
    marginTop: 4,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.light.primary,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
  },
  checkboxActive: {
    backgroundColor: Colors.light.primary,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    marginTop: -2,
  },
  rememberMeText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  forgotPasswordLink: {
    alignSelf: 'center',
  },
  forgotPasswordText: {
    color: Colors.light.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  loginButton: {
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
  loginButtonText: {
    color: Colors.light.textOnPrimary,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  footerText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  registerLinkText: {
    color: Colors.light.primary,
    fontSize: 15,
    fontWeight: '800',
  },
});
