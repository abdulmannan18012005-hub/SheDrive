import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ScrollView, Modal } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { PassengerStackParamList } from '../../types';
import Colors from '../../constants/Colors';
import { useApp } from '../../contexts/AppContext';
import { signOutUser } from '../../firebase/auth';

type ProfileScreenNavigationProp = StackNavigationProp<PassengerStackParamList, 'Profile'>;

interface Props {
  navigation: ProfileScreenNavigationProp;
}

export default function ProfileScreen({ navigation }: Props): React.JSX.Element {
  const { state, dispatch } = useApp();
  const user = state.user;

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

  const [modalVisible, setModalVisible] = React.useState(false);

  const calculatePassengerCompletion = () => {
    let completed = 0;
    const items = [
      { id: 'name', label: 'Full Name', completed: Boolean(user?.name && user.name.trim()) },
      { id: 'email', label: 'Email Address', completed: Boolean(user?.email && user.email.trim()) },
      { id: 'phone', label: 'Phone Number', completed: Boolean(user?.phone && user.phone.trim()) },
      { id: 'photo', label: 'Profile Picture', completed: Boolean(user?.photoURL && user.photoURL.trim()) },
      { id: 'cnic', label: 'CNIC Number', completed: Boolean(user?.cnic && user.cnic.trim()) },
    ];
    items.forEach((item) => {
      if (item.completed) completed++;
    });
    const percentage = Math.round((completed / items.length) * 100);
    return { percentage, items };
  };

  const { percentage: completionPct, items: completionItems } = calculatePassengerCompletion();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {user?.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.userName}>{user?.name || 'Guest User'}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>👩 Verified Passenger</Text>
        </View>
      </View>

      {/* Profile Completion Card */}
      <TouchableOpacity
        style={styles.completionCard}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <View style={styles.completionHeaderRow}>
          <View>
            <Text style={styles.completionTitle}>Profile Completion</Text>
            <Text style={styles.completionSubtitle}>
              {completionPct === 100 ? '🎉 All profile details completed' : 'Tap to view required items'}
            </Text>
          </View>
          <Text style={[styles.completionPercentageText, completionPct === 100 && { color: '#10B981' }]}>
            {completionPct}%
          </Text>
        </View>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${completionPct}%` }]} />
        </View>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.cardHeaderTitle}>Contact & Identity Information</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>📧 Email Address</Text>
          <Text style={styles.infoValue}>{user?.email || 'N/A'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>📱 Phone Number</Text>
          <Text style={styles.infoValue}>{user?.phone || 'N/A'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>🪪 CNIC Number</Text>
          <Text style={[styles.infoValue, !user?.cnic && { color: Colors.light.textTertiary, fontStyle: 'italic' }]}>
            {user?.cnic || 'Not Added (Tap Edit Profile)'}
          </Text>
        </View>

        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.infoLabel}>👩 Gender</Text>
          <Text style={styles.infoValue}>Female (Verified)</Text>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <Text style={styles.menuGroupTitle}>Account Options</Text>

        {/* Edit Profile Link */}
        <TouchableOpacity
          style={styles.menuItemCard}
          onPress={() => navigation.navigate('EditProfile')}
          activeOpacity={0.8}
        >
          <View style={styles.menuItemLeft}>
            <View style={styles.menuItemIconBadge}>
              <Text style={{ fontSize: 18 }}>✏️</Text>
            </View>
            <Text style={styles.menuItemText}>Edit Profile</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Saved Places Link */}
        <TouchableOpacity
          style={styles.menuItemCard}
          onPress={() => navigation.navigate('SavedPlaces')}
          activeOpacity={0.8}
        >
          <View style={styles.menuItemLeft}>
            <View style={styles.menuItemIconBadge}>
              <Text style={{ fontSize: 18 }}>📍</Text>
            </View>
            <Text style={styles.menuItemText}>Saved Places</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Trip History Link */}
        <TouchableOpacity
          style={styles.menuItemCard}
          onPress={() => navigation.navigate('RideHistory')}
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
          onPress={() => navigation.navigate('Settings')}
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
      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Profile Completion Checklist</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Overall Completion: <Text style={{ fontWeight: '800', color: Colors.light.primary }}>{completionPct}%</Text>
            </Text>
            {completionItems.map((item) => (
              <View key={item.id} style={styles.checklistRow}>
                <Text style={styles.checkIcon}>{item.completed ? '✅' : '⭕'}</Text>
                <Text style={[styles.checklistLabel, item.completed && styles.checklistLabelDone]}>{item.label}</Text>
                <Text style={styles.checkStatus}>{item.completed ? 'Completed' : 'Pending'}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={styles.btnEditProfileNav}
              onPress={() => {
                setModalVisible(false);
                navigation.navigate('EditProfile');
              }}
            >
              <Text style={styles.btnEditProfileNavText}>Update Profile Information</Text>
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
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  avatarContainer: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: Colors.light.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: Colors.light.primary,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
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
    fontSize: 42,
    fontWeight: '800',
    color: Colors.light.primary,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 6,
  },
  roleBadge: {
    backgroundColor: Colors.light.primaryGhost,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
  },
  roleBadgeText: {
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
  completionCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: Colors.light.surface,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    elevation: 2,
  },
  completionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  completionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.light.text,
  },
  completionSubtitle: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  completionPercentageText: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.light.primary,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: Colors.light.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.light.primary,
    borderRadius: 4,
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
