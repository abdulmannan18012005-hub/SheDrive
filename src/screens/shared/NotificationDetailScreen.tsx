import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import Colors from '../../constants/Colors';

interface NotificationDetailParams {
  notificationId?: string;
  title: string;
  message: string;
  category?: string;
  createdAt?: number;
  data?: Record<string, any>;
}

export default function NotificationDetailScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: NotificationDetailParams }, 'params'>>();
  const { title, message, category = 'system', createdAt, data } = route.params || {};

  const formattedDate = createdAt
    ? new Date(createdAt).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

  const getCategoryIcon = (cat: string) => {
    switch ((cat || '').toLowerCase()) {
      case 'ride':
      case 'ride_alerts':
        return '🚗';
      case 'safety':
      case 'safety_alerts':
        return '🚨';
      case 'payment':
        return '💳';
      case 'promo':
      case 'promotional':
        return '🎁';
      default:
        return '🔔';
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch ((cat || '').toLowerCase()) {
      case 'ride':
      case 'ride_alerts':
        return 'Ride Alert';
      case 'safety':
      case 'safety_alerts':
        return 'Safety Update';
      case 'payment':
        return 'Payment & Billing';
      case 'promo':
      case 'promotional':
        return 'Promotion';
      default:
        return 'Platform Notice';
    }
  };

  const handleAction = () => {
    const rideId = data?.rideId;
    const type = data?.type;

    if (rideId) {
      if (type === 'new_ride_request' || type === 'ride_offer') {
        navigation.navigate('DriverHome', { selectedRideId: rideId });
      } else if (type === 'ride_accepted') {
        navigation.navigate('ActiveRide', { rideId });
      } else {
        navigation.navigate('RideTracking', { rideId });
      }
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryIcon}>{getCategoryIcon(category)}</Text>
              <Text style={styles.categoryText}>{getCategoryLabel(category)}</Text>
            </View>
            <Text style={styles.timestamp}>{formattedDate}</Text>
          </View>

          <Text style={styles.title}>{title || 'Notification'}</Text>
          <View style={styles.divider} />
          <Text style={styles.body}>{message || 'No additional details provided.'}</Text>
        </View>

        <View style={styles.actionContainer}>
          {data?.rideId ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={handleAction} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>View Ride Details →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
              <Text style={styles.secondaryBtnText}>Back to Notifications</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  container: {
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primaryGhost,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    gap: 6,
  },
  categoryIcon: {
    fontSize: 14,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  timestamp: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    fontWeight: '500',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.light.text,
    lineHeight: 28,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 16,
  },
  body: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    lineHeight: 24,
  },
  actionContainer: {
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: Colors.light.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});
