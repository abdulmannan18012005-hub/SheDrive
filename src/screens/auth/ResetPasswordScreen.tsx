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
import { AuthStackParamList } from '../../types';
import Colors from '../../constants/Colors';
import { getApiBaseUrl } from '../../config/apiConfig';
import { useApp } from '../../contexts/AppContext';
import PasswordStrengthIndicator from '../../components/PasswordStrengthIndicator';

type ResetPasswordNavigationProp = StackNavigationProp<AuthStackParamList, 'ResetPassword'>;

interface Props {
  navigation: ResetPasswordNavigationProp;
  route: any;
}

export default function ResetPasswordScreen({ navigation, route }: Props): React.JSX.Element {
  const { dispatch } = useApp();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState<string | undefined>(undefined);
  const [token, setToken] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [actionType, setActionType] = useState<'update' | 'signin' | null>(null);

  // Get email, token, and role from deep link params if available
  React.useEffect(() => {
    if (route.params?.email) {
      setEmail(route.params.email);
    }
    if (route.params?.token) {
      setToken(route.params.token);
    }
    if (route.params?.role) {
      setRole(route.params.role);
    }
  }, [route.params]);

  const handlePerformReset = async (autoSignIn: boolean) => {
    if (!email.trim()) {
      Alert.alert('Missing Email', 'Email address is required.');
      return;
    }

    if (!newPassword || !confirmPassword) {
      Alert.alert('Missing Password', 'Please enter and confirm your new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Password Mismatch', 'New password and confirmation do not match.');
      return;
    }

    // Password validation
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      Alert.alert(
        'Weak Password',
        'Password must be at least 8 characters with at least one uppercase letter, one lowercase letter, and one special character (e.g. @, #, $).'
      );
      return;
    }

    try {
      setIsLoading(true);
      setActionType(autoSignIn ? 'signin' : 'update');

      const res = await fetch(`${getApiBaseUrl()}/auth/update-password-from-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          newPassword,
          token,
          role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        Alert.alert('Reset Failed', data.error || 'Failed to update password. Please try again.');
        return;
      }

      if (autoSignIn && data.user && data.token) {
        // Automatically sign user in and navigate to their dashboard
        dispatch({
          type: 'SET_USER',
          payload: {
            uid: data.user.id,
            phone: data.user.phone,
            email: data.user.email,
            name: data.user.name,
            role: data.user.role,
            createdAt: Date.now(),
          },
        });
        dispatch({ type: 'SET_ROLE', payload: data.user.role });
        dispatch({ type: 'SET_AUTHENTICATED', payload: true });
      } else {
        // Redirect to Login screen
        Alert.alert(
          'Password Updated',
          'Your password has been updated successfully. Please sign in with your new password.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Login'),
            },
          ]
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Unable to Connect',
        'Could not reach the server. Please check your internet connection and try again.'
      );
    } finally {
      setIsLoading(false);
      setActionType(null);
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
            <Text style={styles.iconEmoji}>🔐</Text>
          </View>
          <Text style={styles.title}>Set New Password</Text>
          <Text style={styles.subtitle}>
            Create a strong new password for your account.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email Address {role ? `(${role.toUpperCase()})` : ''}</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>📧</Text>
              <TextInput
                style={[styles.input, Boolean(route.params?.email) && styles.disabledInput]}
                placeholder="Enter your registered email"
                placeholderTextColor={Colors.light.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                textContentType="none"
                importantForAutofill="no"
                editable={!route.params?.email && !isLoading}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter new password"
                placeholderTextColor={Colors.light.textTertiary}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowNewPassword(!showNewPassword)}
                activeOpacity={0.7}
              >
                <Text style={styles.eyeIconText}>{showNewPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
            <PasswordStrengthIndicator password={newPassword} />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                placeholderTextColor={Colors.light.textTertiary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                activeOpacity={0.7}
              >
                <Text style={styles.eyeIconText}>{showConfirmPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Password match indicator */}
          {confirmPassword.length > 0 && (
            <View style={styles.matchIndicator}>
              <Text style={{ fontSize: 14, color: newPassword === confirmPassword ? Colors.light.success : Colors.light.error }}>
                {newPassword === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.submitButton, styles.updateOnlyButton, { flex: 1, marginRight: 8 }]}
              onPress={() => handlePerformReset(false)}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading && actionType === 'update' ? (
                <ActivityIndicator color={Colors.light.primary} />
              ) : (
                <Text style={styles.updateOnlyButtonText}>Update</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, { flex: 1.3, marginLeft: 8 }]}
              onPress={() => handlePerformReset(true)}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading && actionType === 'signin' ? (
                <ActivityIndicator color={Colors.light.textOnPrimary} />
              ) : (
                <Text style={styles.submitButtonText}>Update & Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>💡</Text>
            <Text style={styles.infoText}>
              Password must be at least 8 characters with uppercase, lowercase, and special characters.
            </Text>
          </View>
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
  },
  inputContainer: {
    marginBottom: 18,
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
  disabledInput: {
    color: Colors.light.textTertiary,
    opacity: 0.7,
  },
  matchIndicator: {
    marginBottom: 18,
    paddingLeft: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  updateOnlyButton: {
    backgroundColor: Colors.light.primaryGhost,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    shadowOpacity: 0,
    elevation: 0,
  },
  updateOnlyButtonText: {
    color: Colors.light.primary,
    fontSize: 15,
    fontWeight: '700',
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
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  infoBox: {
    marginTop: 20,
    flexDirection: 'row',
    backgroundColor: Colors.light.primaryGhost,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
  },
  infoIcon: {
    fontSize: 18,
    marginRight: 12,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 20,
    fontWeight: '500',
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
});
