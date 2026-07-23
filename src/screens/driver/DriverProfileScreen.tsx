import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { DriverStackParamList, DriverProfile } from '../../types';
import Colors from '../../constants/Colors';
import { useApp } from '../../contexts/AppContext';
import { signOutUser } from '../../firebase/auth';

type DriverProfileNavigationProp = StackNavigationProp<DriverStackParamList, 'DriverProfile'>;

interface Props {
  navigation: DriverProfileNavigationProp;
}

export default function DriverProfileScreen({ navigation }: Props): React.JSX.Element {
  const { state, dispatch } = useApp();
  const user = state.user;
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDriverProfile = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        const driverSnap = await getDoc(doc(db, 'drivers', user.uid));
        if (driverSnap.exists()) {
          setDriverProfile(driverSnap.data() as DriverProfile);
        }
      } catch (error) {
        console.error('Error fetching driver profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDriverProfile();
  }, [user]);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOutUser();
            dispatch({ type: 'LOGOUT' });
          } catch (error) {
            Alert.alert('Error', 'Unable to sign out. Please check your network connection.');
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header Profile Photo & Basic Meta */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {user?.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'D'}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.userName}>{user?.name || 'Driver Partner'}</Text>
        <View style={styles.badgeContainer}>
          <Text style={styles.userRole}>🚗 SheDrive Driver</Text>
          <Text style={[
            styles.statusBadge,
            driverProfile?.isActive ? styles.statusActive : styles.statusPending
          ]}>
            {driverProfile?.isActive ? 'Active / Approved' : 'Verification Pending'}
          </Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>⭐ {driverProfile?.rating?.toFixed(1) || '5.0'}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{driverProfile?.totalRides || 0}</Text>
            <Text style={styles.statLabel}>Trips</Text>
          </View>
        </View>
      </View>

      {/* Driver Contact info section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Account Details</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email Address</Text>
          <Text style={styles.infoValue}>{user?.email || 'N/A'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Phone Number</Text>
          <Text style={styles.infoValue}>{user?.phone || 'N/A'}</Text>
        </View>
      </View>

      {/* Vehicle Info Section */}
      {driverProfile?.vehicleInfo && (
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Vehicle Details</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Make & Model</Text>
            <Text style={styles.infoValue}>
              {driverProfile.vehicleInfo.make} {driverProfile.vehicleInfo.model}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Plate Number</Text>
            <Text style={[styles.infoValue, styles.plateText]}>
              {driverProfile.vehicleInfo.plate}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Color</Text>
            <Text style={styles.infoValue}>{driverProfile.vehicleInfo.color}</Text>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {/* Trip History Link */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('DriverRideHistory')}
          activeOpacity={0.8}
        >
          <Text style={styles.actionButtonText}>Trip History</Text>
        </TouchableOpacity>

        {/* Sign Out Link */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>
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
    paddingVertical: 30,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  avatarContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.light.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
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
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  userRole: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.primary,
    backgroundColor: Colors.light.primaryGhost,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    color: Colors.light.success,
    backgroundColor: Colors.light.successLight,
  },
  statusPending: {
    color: Colors.light.warning,
    backgroundColor: Colors.light.warningLight,
  },
  statsContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.light.border,
  },
  section: {
    backgroundColor: Colors.light.surface,
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.light.divider,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  infoLabel: {
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.text,
  },
  plateText: {
    textTransform: 'uppercase',
  },
  actionsContainer: {
    paddingHorizontal: 24,
    paddingVertical: 36,
    gap: 16,
  },
  actionButton: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: Colors.light.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  logoutButton: {
    backgroundColor: Colors.light.errorLight,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: Colors.light.error,
    fontSize: 16,
    fontWeight: '700',
  },
});
