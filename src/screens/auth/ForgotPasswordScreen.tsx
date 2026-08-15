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
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList, UserRole } from '../../types';
import Colors from '../../constants/Colors';
import { getApiBaseUrl } from '../../config/apiConfig';

type ForgotPasswordNavigationProp = StackNavigationProp<AuthStackParamList, 'ForgotPassword'>;

interface Props {
  navigation: ForgotPasswordNavigationProp;
}

export default function ForgotPasswordScreen({ navigation }: Props): React.JSX.Element {
  const [role, setRole] = useState<UserRole>('passenger');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  React.useEffect(() => {
    let timer: any;
    if (cooldownSeconds > 0) {
      timer = setInterval(() => {
        setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const handleSendResetEmail = async () => {
    if (cooldownSeconds > 0) {
      Alert.alert('Please Wait', `You can request another reset link in ${formatTime(cooldownSeconds)}.`);
      return;
    }

    if (!email.trim()) {
      Alert.alert('Validation Error', 'Please enter your registered email address.');
      return;
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch(`${getApiBaseUrl()}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.cooldownSeconds) {
          setCooldownSeconds(data.cooldownSeconds);
        }
        Alert.alert('Reset Request Error', data.error || 'We were unable to send a reset link. Please try again.');
        return;
      }

      setCooldownSeconds(300); // 5 minutes (300 seconds)
      setEmailSent(true);
    } catch (error: any) {
      Alert.alert(
        'Unable to Connect',
        'Could not reach the server. Please check your internet connection and try again.'
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
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Text style={styles.iconEmoji}>{emailSent ? '✅' : '🔑'}</Text>
          </View>
          <Text style={styles.title}>{emailSent ? 'Check Your Email' : 'Reset Password'}</Text>
          <Text style={styles.subtitle}>
            {emailSent
              ? 'A password reset link has been sent to your email. Check your inbox and spam folder.'
              : 'Select your account type and enter your registered email to receive a secure reset link.'}
          </Text>
        </View>

        <View style={styles.card}>
          {!emailSent ? (
            <>
              {/* Account Type Selector */}
              <View style={styles.roleTabs}>
                <TouchableOpacity
                  style={[styles.roleTab, role === 'passenger' && styles.roleTabActive]}
                  onPress={() => setRole('passenger')}
                  disabled={isLoading}
                >
                  <Text
                    style={[
                      styles.roleTabText,
                      role === 'passenger' && styles.roleTabActiveText,
                    ]}
                  >
                    👩 Passenger
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleTab, role === 'driver' && styles.roleTabActive]}
                  onPress={() => setRole('driver')}
                  disabled={isLoading}
                >
                  <Text
                    style={[
                      styles.roleTabText,
                      role === 'driver' && styles.roleTabActiveText,
                    ]}
                  >
                    🚗 Driver
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputIcon}>📧</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={`Enter your registered ${role} email`}
                    placeholderTextColor={Colors.light.textTertiary}
                    value={email}
                    onChangeText={setEmail}
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

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (isLoading || cooldownSeconds > 0) && { opacity: 0.7 },
                ]}
                onPress={handleSendResetEmail}
                disabled={isLoading || cooldownSeconds > 0}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color={Colors.light.textOnPrimary} />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {cooldownSeconds > 0
                      ? `Resend Link in ${formatTime(cooldownSeconds)}`
                      : 'Send Reset Link'}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Success State */}
              <View style={styles.successBox}>
                <Text style={styles.successIcon}>📩</Text>
                <Text style={styles.successTitle}>Email Sent Successfully</Text>
                <Text style={styles.successText}>
                  If an account with that email exists, you will receive a password reset link shortly.
                  Please check your inbox and spam/junk folder.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, { marginTop: 20 }]}
                onPress={() => {
                  setEmailSent(false);
                  setEmail('');
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.submitButtonText}>Try a Different Email</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Back to Login */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('Login')}
          disabled={isLoading}
        >
          <Text style={styles.backButtonText}>← Back to Sign In</Text>
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
    justifyContent: 'space-between',
  },
  header: {
    marginTop: 10,
    marginBottom: 24,
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
  iconEmoji: {
    fontSize: 38,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.light.text,
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: 10,
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
    marginBottom: 22,
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
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.light.text,
    fontWeight: '500',
  },
  submitButton: {
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
  submitButtonText: {
    color: Colors.light.textOnPrimary,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  successBox: {
    backgroundColor: Colors.light.successLight,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.success + '40',
  },
  successIcon: {
    fontSize: 44,
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.light.success,
    marginBottom: 10,
  },
  successText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backButtonText: {
    color: Colors.light.primary,
    fontSize: 15,
    fontWeight: '700',
  },
});
