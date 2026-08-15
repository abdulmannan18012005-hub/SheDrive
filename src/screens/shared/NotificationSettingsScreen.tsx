import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Colors from '../../constants/Colors';
import { useApp } from '../../contexts/AppContext';
import { getApiBaseUrl } from '../../config/apiConfig';

interface NotificationSettings {
  rideNotifications: boolean;
  promotionalNotifications: boolean;
  platformNotifications: boolean;
  paymentNotifications: boolean;
  emergencyNotifications: boolean;
}

export default function NotificationSettingsScreen(): React.JSX.Element {
  const { state } = useApp();
  const [settings, setSettings] = useState<NotificationSettings>({
    rideNotifications: true,
    promotionalNotifications: true,
    platformNotifications: true,
    paymentNotifications: true,
    emergencyNotifications: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchNotificationSettings();
  }, []);

  const fetchNotificationSettings = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${getApiBaseUrl()}/user/notification-settings`, {
        headers: {
          Authorization: `Bearer ${state.token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        // If API fails, use default settings
        console.log('Using default notification settings');
        return;
      }

      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (err: any) {
      console.error('Fetch notification settings error:', err);
      // If API fails, use default settings
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (key: keyof NotificationSettings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);

    try {
      setIsSaving(true);
      const res = await fetch(`${getApiBaseUrl()}/user/notification-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.token}`,
        },
        body: JSON.stringify(newSettings),
      });

      if (!res.ok) {
        const data = await res.json();
        Alert.alert('Error', data.error || 'Failed to update settings');
        // Revert the change
        setSettings(settings);
        return;
      }
    } catch (err: any) {
      console.error('Update notification settings error:', err);
      Alert.alert('Network Error', 'Unable to connect to server');
      // Revert the change
      setSettings(settings);
    } finally {
      setIsSaving(false);
    }
  };

  const ToggleSwitch = ({
    value,
    onToggle,
    disabled,
  }: {
    value: boolean;
    onToggle: () => void;
    disabled?: boolean;
  }) => (
    <TouchableOpacity
      style={[styles.toggle, value && styles.toggleActive, disabled && styles.toggleDisabled]}
      onPress={onToggle}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <View style={[styles.toggleCircle, value && styles.toggleCircleActive]} />
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Text style={styles.headerIcon}>🔔</Text>
        </View>
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <Text style={styles.headerSubtitle}>Choose which notifications you want to receive</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardHeaderTitle}>Ride Notifications</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={styles.settingIconBadge}>
              <Text style={styles.settingIcon}>🚗</Text>
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Ride Updates</Text>
              <Text style={styles.settingDescription}>
                Get notified about ride status, driver arrival, and trip completion
              </Text>
            </View>
          </View>
          <ToggleSwitch
            value={settings.rideNotifications}
            onToggle={() => handleToggle('rideNotifications')}
            disabled={isSaving}
          />
        </View>

        <View style={[styles.divider, { marginTop: 8 }]} />

        <Text style={[styles.cardHeaderTitle, { marginTop: 16 }]}>Promotional Notifications</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={styles.settingIconBadge}>
              <Text style={styles.settingIcon}>🎉</Text>
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Promotions & Offers</Text>
              <Text style={styles.settingDescription}>
                Receive special offers, discounts, and promotional updates
              </Text>
            </View>
          </View>
          <ToggleSwitch
            value={settings.promotionalNotifications}
            onToggle={() => handleToggle('promotionalNotifications')}
            disabled={isSaving}
          />
        </View>

        <View style={[styles.divider, { marginTop: 8 }]} />

        <Text style={[styles.cardHeaderTitle, { marginTop: 16 }]}>Platform Notifications</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={styles.settingIconBadge}>
              <Text style={styles.settingIcon}>📱</Text>
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Platform Updates</Text>
              <Text style={styles.settingDescription}>
                Get notified about new features, app updates, and maintenance
              </Text>
            </View>
          </View>
          <ToggleSwitch
            value={settings.platformNotifications}
            onToggle={() => handleToggle('platformNotifications')}
            disabled={isSaving}
          />
        </View>

        <View style={[styles.divider, { marginTop: 8 }]} />

        <Text style={[styles.cardHeaderTitle, { marginTop: 16 }]}>Payment Notifications</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={styles.settingIconBadge}>
              <Text style={styles.settingIcon}>💳</Text>
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Payment Alerts</Text>
              <Text style={styles.settingDescription}>
                Receive notifications about payments, receipts, and billing
              </Text>
            </View>
          </View>
          <ToggleSwitch
            value={settings.paymentNotifications}
            onToggle={() => handleToggle('paymentNotifications')}
            disabled={isSaving}
          />
        </View>

        <View style={[styles.divider, { marginTop: 8 }]} />

        <Text style={[styles.cardHeaderTitle, { marginTop: 16 }]}>Safety Notifications</Text>

        <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
          <View style={styles.settingLeft}>
            <View style={styles.settingIconBadge}>
              <Text style={styles.settingIcon}>🆘</Text>
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Emergency Alerts</Text>
              <Text style={styles.settingDescription}>
                Critical safety alerts and emergency notifications (cannot be disabled)
              </Text>
            </View>
          </View>
          <ToggleSwitch
            value={settings.emergencyNotifications}
            onToggle={() => {
              Alert.alert(
                'Cannot Disable',
                'Emergency notifications are required for your safety and cannot be disabled.',
              );
            }}
            disabled={true}
          />
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>ℹ️ Information</Text>
        <Text style={styles.infoText}>
          • Emergency notifications are always enabled for your safety
        </Text>
        <Text style={styles.infoText}>
          • You can change these settings anytime
        </Text>
        <Text style={styles.infoText}>
          • Disabling notifications may affect your ride experience
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: Colors.light.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
  },
  headerIcon: {
    fontSize: 36,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
    fontWeight: '500',
  },
  card: {
    backgroundColor: Colors.light.surface,
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.light.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingIcon: {
    fontSize: 20,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    lineHeight: 16,
  },
  toggle: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.light.border,
    padding: 3,
  },
  toggleActive: {
    backgroundColor: Colors.light.primary,
  },
  toggleDisabled: {
    opacity: 0.5,
  },
  toggleCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleCircleActive: {
    alignSelf: 'flex-end',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.divider,
  },
  infoCard: {
    backgroundColor: Colors.light.primaryGhost,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.primaryDark,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
});
