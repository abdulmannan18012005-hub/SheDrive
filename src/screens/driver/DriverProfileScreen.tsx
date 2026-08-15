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
  Modal,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { db } from '../../config/firebaseConfig';
import { DriverStackParamList, DriverProfile } from '../../types';
import Colors from '../../constants/Colors';
import { useApp } from '../../contexts/AppContext';
import { signOutUser } from '../../firebase/auth';
import { getApiBaseUrl } from '../../config/apiConfig';

type DriverProfileNavigationProp = StackNavigationProp<DriverStackParamList, 'DriverProfile'>;

interface Props {
  navigation: DriverProfileNavigationProp;
}

export default function DriverProfileScreen({ navigation }: Props): React.JSX.Element {
  const { state, dispatch } = useApp();
  const user = state.user;
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [completionModalVisible, setCompletionModalVisible] = useState(false);

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

  const handleReselectDocument = async (
    fieldKey: 'cnicFrontUrl' | 'cnicBackUrl' | 'licenseFrontUrl' | 'licenseBackUrl' | 'selfieUrl' | 'vehiclePhotoUrl',
    docLabel: string
  ) => {
    if (!user) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', `Photo library access is needed to update your ${docLabel}.`);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;
        const base64Data = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const finalUrl = `data:image/jpeg;base64,${base64Data}`;

        // 1. Update Firestore
        const driverDocRef = doc(db, 'drivers', user.uid);
        await updateDoc(driverDocRef, { [fieldKey]: finalUrl });

        // 2. Update PostgreSQL backend
        try {
          await fetch(`${getApiBaseUrl()}/driver/documents`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${state.token}`,
            },
            body: JSON.stringify({ [fieldKey]: finalUrl }),
          });
        } catch (apiErr) {
          console.warn('Backend document update warning:', apiErr);
        }

        // 3. Update local state
        setDriverProfile((prev) => (prev ? { ...prev, [fieldKey]: finalUrl } : prev));
        Alert.alert('Document Updated', `Your ${docLabel} has been updated successfully.`);
      }
    } catch (err) {
      Alert.alert('Update Error', `Could not update ${docLabel}. Please try again.`);
    }
  };

  const handleUpdateProfilePicture = async () => {
    if (!user) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Photo library access is needed to update your profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;
        const base64Data = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const finalUrl = `data:image/jpeg;base64,${base64Data}`;

        // 1. Update PostgreSQL backend
        try {
          await fetch(`${getApiBaseUrl()}/driver/documents`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${state.token}`,
            },
            body: JSON.stringify({ photoURL: finalUrl }),
          });
        } catch (apiErr) {
          console.error('Backend profile picture update error:', apiErr);
          Alert.alert('Update Error', 'Could not update profile picture. Please try again.');
          return;
        }

        // 2. Update local AppContext
        dispatch({
          type: 'SET_USER',
          payload: {
            ...user,
            photoURL: finalUrl,
          },
        });

        Alert.alert('Profile Picture Updated', 'Your profile picture has been updated successfully.');
      }
    } catch (err) {
      Alert.alert('Update Error', 'Could not update profile picture. Please try again.');
    }
  };

  const calculateProfileCompletion = (profile: DriverProfile | null): number => {
    if (!profile) return 0;

    let completedFields = 0;
    const totalFields = 8;

    // Check basic info
    if (profile.name) completedFields++;
    if (profile.phone) completedFields++;
    if (profile.photoURL) completedFields++;

    // Check vehicle info
    if (profile.vehicleInfo) {
      if (profile.vehicleInfo.make) completedFields++;
      if (profile.vehicleInfo.model) completedFields++;
      if (profile.vehicleInfo.plate) completedFields++;
      if (profile.vehicleInfo.color) completedFields++;
    }

    // Check documents
    if (profile.licenseFrontUrl) completedFields++;
    if (profile.licenseBackUrl) completedFields++;

    return Math.round((completedFields / totalFields) * 100);
  };

  const profileCompletion = calculateProfileCompletion(driverProfile);

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
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header Profile Photo & Basic Meta */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleUpdateProfilePicture} activeOpacity={0.8}>
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
            <View style={styles.cameraBadge}>
              <Text style={{ fontSize: 12 }}>📷</Text>
            </View>
          </View>
        </TouchableOpacity>
        <Text style={styles.userName}>{user?.name || 'Driver Partner'}</Text>
        <View style={styles.badgeContainer}>
          <Text style={styles.userRole}>🚗 Registered Driver</Text>
          <Text style={[
            styles.statusBadge,
            driverProfile?.isActive ? styles.statusActive : styles.statusPending
          ]}>
            {driverProfile?.isActive ? '✓ Verified Partner' : '⏳ Verification Pending'}
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
            <Text style={styles.statLabel}>Completed Trips</Text>
          </View>
        </View>

        {/* Profile Completion */}
        <TouchableOpacity
          style={styles.completionContainer}
          onPress={() => setCompletionModalVisible(true)}
          activeOpacity={0.85}
        >
          <View style={styles.completionHeader}>
            <View>
              <Text style={styles.completionTitle}>Profile Completion</Text>
              <Text style={{ fontSize: 11, color: Colors.light.textSecondary, marginTop: 2 }}>
                {profileCompletion === 100 ? '🎉 All partner details completed' : 'Tap to view required checklist'}
              </Text>
            </View>
            <Text style={[styles.completionPercentage, profileCompletion === 100 && styles.completionComplete]}>
              {profileCompletion}%
            </Text>
          </View>
          <View style={styles.completionBar}>
            <View style={[styles.completionFill, { width: `${profileCompletion}%` }]} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Driver Contact info section */}
      <View style={styles.card}>
        <Text style={styles.cardHeaderTitle}>Account Details</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>📧 Email Address</Text>
          <Text style={styles.infoValue}>{user?.email || 'N/A'}</Text>
        </View>

        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.infoLabel}>📱 Phone Number</Text>
          <Text style={styles.infoValue}>{user?.phone || 'N/A'}</Text>
        </View>
      </View>

      {/* Vehicle Info Section */}
      {driverProfile?.vehicleInfo && (
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>Vehicle Details</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>🚘 Make & Model</Text>
            <Text style={styles.infoValue}>
              {driverProfile.vehicleInfo.make} {driverProfile.vehicleInfo.model}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>🪪 Plate Number</Text>
            <Text style={[styles.infoValue, styles.plateText]}>
              {driverProfile.vehicleInfo.plate}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>🎨 Color</Text>
            <Text style={styles.infoValue}>{driverProfile.vehicleInfo.color}</Text>
          </View>

          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>❄️ AC Option</Text>
            <Text style={styles.infoValue}>
              {driverProfile.acOption === 'ac'
                ? '❄️ Air Conditioned (AC)'
                : driverProfile.acOption === 'non_ac'
                ? '🍃 Non-AC'
                : '❄️🍃 Both (AC & Non-AC)'}
            </Text>
          </View>
        </View>
      )}

      {/* Driver Verification Documents Section */}
      <View style={styles.card}>
        <Text style={styles.cardHeaderTitle}>🪪 Verification Documents</Text>

        <View style={styles.docGrid}>
          {/* CNIC Front */}
          <View style={styles.docCard}>
            <Text style={styles.docCardLabel}>CNIC Front</Text>
            {driverProfile?.cnicFrontUrl ? (
              <Image source={{ uri: driverProfile.cnicFrontUrl }} style={styles.docThumbnail} />
            ) : (
              <View style={styles.docPlaceholder}><Text style={styles.docPlaceholderText}>Not Provided</Text></View>
            )}
            <TouchableOpacity
              style={styles.reselectBtn}
              onPress={() => handleReselectDocument('cnicFrontUrl', 'CNIC Front')}
            >
              <Text style={styles.reselectBtnText}>📷 Change / Reselect</Text>
            </TouchableOpacity>
          </View>

          {/* CNIC Back */}
          <View style={styles.docCard}>
            <Text style={styles.docCardLabel}>CNIC Back</Text>
            {driverProfile?.cnicBackUrl ? (
              <Image source={{ uri: driverProfile.cnicBackUrl }} style={styles.docThumbnail} />
            ) : (
              <View style={styles.docPlaceholder}><Text style={styles.docPlaceholderText}>Not Provided</Text></View>
            )}
            <TouchableOpacity
              style={styles.reselectBtn}
              onPress={() => handleReselectDocument('cnicBackUrl', 'CNIC Back')}
            >
              <Text style={styles.reselectBtnText}>📷 Change / Reselect</Text>
            </TouchableOpacity>
          </View>

          {/* License Front */}
          <View style={styles.docCard}>
            <Text style={styles.docCardLabel}>License Front</Text>
            {driverProfile?.licenseFrontUrl ? (
              <Image source={{ uri: driverProfile.licenseFrontUrl }} style={styles.docThumbnail} />
            ) : (
              <View style={styles.docPlaceholder}><Text style={styles.docPlaceholderText}>Not Provided</Text></View>
            )}
            <TouchableOpacity
              style={styles.reselectBtn}
              onPress={() => handleReselectDocument('licenseFrontUrl', 'License Front')}
            >
              <Text style={styles.reselectBtnText}>📷 Change / Reselect</Text>
            </TouchableOpacity>
          </View>

          {/* License Back */}
          <View style={styles.docCard}>
            <Text style={styles.docCardLabel}>License Back</Text>
            {driverProfile?.licenseBackUrl ? (
              <Image source={{ uri: driverProfile.licenseBackUrl }} style={styles.docThumbnail} />
            ) : (
              <View style={styles.docPlaceholder}><Text style={styles.docPlaceholderText}>Not Provided</Text></View>
            )}
            <TouchableOpacity
              style={styles.reselectBtn}
              onPress={() => handleReselectDocument('licenseBackUrl', 'License Back')}
            >
              <Text style={styles.reselectBtnText}>📷 Change / Reselect</Text>
            </TouchableOpacity>
          </View>

          {/* Profile Photo / Selfie */}
          <View style={styles.docCard}>
            <Text style={styles.docCardLabel}>Profile Photo</Text>
            {driverProfile?.selfieUrl || driverProfile?.photoURL ? (
              <Image source={{ uri: driverProfile.selfieUrl || driverProfile.photoURL }} style={styles.docThumbnail} />
            ) : (
              <View style={styles.docPlaceholder}><Text style={styles.docPlaceholderText}>Not Provided</Text></View>
            )}
            <TouchableOpacity
              style={styles.reselectBtn}
              onPress={() => handleReselectDocument('selfieUrl', 'Profile Photo')}
            >
              <Text style={styles.reselectBtnText}>📷 Change / Reselect</Text>
            </TouchableOpacity>
          </View>

          {/* Vehicle Photo */}
          <View style={styles.docCard}>
            <Text style={styles.docCardLabel}>Vehicle Photo</Text>
            {driverProfile?.vehiclePhotoUrl || driverProfile?.vehicleInfo?.photoUrl ? (
              <Image source={{ uri: driverProfile.vehiclePhotoUrl || driverProfile.vehicleInfo.photoUrl }} style={styles.docThumbnail} />
            ) : (
              <View style={styles.docPlaceholder}><Text style={styles.docPlaceholderText}>Not Provided</Text></View>
            )}
            <TouchableOpacity
              style={styles.reselectBtn}
              onPress={() => handleReselectDocument('vehiclePhotoUrl', 'Vehicle Photo')}
            >
              <Text style={styles.reselectBtnText}>📷 Change / Reselect</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <Text style={styles.menuGroupTitle}>Partner Menu</Text>

        {/* Vehicle Management Link */}
        <TouchableOpacity
          style={styles.menuItemCard}
          onPress={() => navigation.navigate('VehicleManagement')}
          activeOpacity={0.8}
        >
          <View style={styles.menuItemLeft}>
            <View style={styles.menuItemIconBadge}>
              <Text style={{ fontSize: 18 }}>🚗</Text>
            </View>
            <Text style={styles.menuItemText}>Vehicle Management</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Trip History Link */}
        <TouchableOpacity
          style={styles.menuItemCard}
          onPress={() => navigation.navigate('DriverRideHistory')}
          activeOpacity={0.8}
        >
          <View style={styles.menuItemLeft}>
            <View style={styles.menuItemIconBadge}>
              <Text style={{ fontSize: 18 }}>📋</Text>
            </View>
            <Text style={styles.menuItemText}>Trip History</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Settings Link */}
        <TouchableOpacity
          style={styles.menuItemCard}
          onPress={() => navigation.navigate('DriverSettings')}
          activeOpacity={0.8}
        >
          <View style={styles.menuItemLeft}>
            <View style={styles.menuItemIconBadge}>
              <Text style={{ fontSize: 18 }}>⚙️</Text>
            </View>
            <Text style={styles.menuItemText}>Settings & Legal</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Log Out Link */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Completion Detail Modal */}
      <Modal visible={completionModalVisible} animationType="slide" transparent={true} onRequestClose={() => setCompletionModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Driver Verification Checklist</Text>
              <TouchableOpacity onPress={() => setCompletionModalVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Partner Completion: <Text style={{ fontWeight: '800', color: Colors.light.primary }}>{profileCompletion}%</Text>
            </Text>
            {[
              { label: 'Full Name', done: Boolean(driverProfile?.name) },
              { label: 'Phone Number', done: Boolean(driverProfile?.phone) },
              { label: 'Profile Photo', done: Boolean(driverProfile?.photoURL || driverProfile?.selfieUrl) },
              { label: 'Vehicle Make & Model', done: Boolean(driverProfile?.vehicleInfo?.make && driverProfile?.vehicleInfo?.model) },
              { label: 'Vehicle Plate Number', done: Boolean(driverProfile?.vehicleInfo?.plate) },
              { label: 'Vehicle Color', done: Boolean(driverProfile?.vehicleInfo?.color) },
              { label: 'License Front Document', done: Boolean(driverProfile?.licenseFrontUrl) },
              { label: 'License Back Document', done: Boolean(driverProfile?.licenseBackUrl) },
            ].map((item, idx) => (
              <View key={idx} style={styles.checklistRow}>
                <Text style={styles.checkIcon}>{item.done ? '✅' : '⭕'}</Text>
                <Text style={[styles.checklistLabel, item.done && styles.checklistLabelDone]}>{item.label}</Text>
                <Text style={styles.checkStatus}>{item.done ? 'Verified' : 'Pending'}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={styles.btnEditProfileNav}
              onPress={() => {
                setCompletionModalVisible(false);
                navigation.navigate('VehicleManagement');
              }}
            >
              <Text style={styles.btnEditProfileNavText}>Update Vehicle & Documents</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  avatarText: {
    fontSize: 38,
    fontWeight: '800',
    color: Colors.light.primaryDark,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
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
    fontWeight: '700',
    color: Colors.light.primaryDark,
    backgroundColor: Colors.light.primaryGhost,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
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
    paddingHorizontal: 20,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.light.border,
  },
  completionContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
    width: '100%',
  },
  completionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  completionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  completionPercentage: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.primary,
  },
  completionComplete: {
    color: Colors.light.success,
  },
  completionBar: {
    height: 6,
    backgroundColor: Colors.light.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  completionFill: {
    height: '100%',
    backgroundColor: Colors.light.primary,
    borderRadius: 3,
  },
  completeProfileButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.light.primaryGhost,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    alignItems: 'center',
  },
  completeProfileButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.primary,
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
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
  },
  plateText: {
    textTransform: 'uppercase',
    fontWeight: '800',
  },
  docGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  docCard: {
    width: '47.5%',
    backgroundColor: Colors.light.background,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  docCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  docThumbnail: {
    width: '100%',
    height: 90,
    borderRadius: 8,
    resizeMode: 'cover',
    marginBottom: 8,
  },
  docPlaceholder: {
    width: '100%',
    height: 90,
    borderRadius: 8,
    backgroundColor: Colors.light.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  docPlaceholderText: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    fontWeight: '600',
  },
  reselectBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.light.primaryGhost,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    width: '100%',
    alignItems: 'center',
  },
  reselectBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  actionsContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 12,
  },
  menuGroupTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.light.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  menuItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuItemIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.light.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.text,
  },
  chevron: {
    fontSize: 22,
    color: Colors.light.textTertiary,
    fontWeight: '400',
  },
  logoutButton: {
    backgroundColor: Colors.light.errorLight,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.light.error + '30',
  },
  logoutButtonText: {
    color: Colors.light.error,
    fontSize: 16,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.light.text,
  },
  closeBtn: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 16,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 12,
  },
  checkIcon: {
    fontSize: 16,
  },
  checklistLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  checklistLabelDone: {
    color: Colors.light.textSecondary,
    textDecorationLine: 'line-through',
  },
  checkStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  btnEditProfileNav: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  btnEditProfileNavText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
