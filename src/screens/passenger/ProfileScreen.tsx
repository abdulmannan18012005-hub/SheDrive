import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ScrollView } from 'react-native';
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

  return (
    <ScrollView style={styles.container}>
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
        <Text style={styles.userRole}>👩 Passenger</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Contact Details</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email Address</Text>
          <Text style={styles.infoValue}>{user?.email || 'N/A'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Phone Number</Text>
          <Text style={styles.infoValue}>{user?.phone || 'N/A'}</Text>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        {/* Edit Profile Link */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('EditProfile')}
          activeOpacity={0.8}
        >
          <Text style={styles.actionButtonText}>Edit Profile</Text>
        </TouchableOpacity>

        {/* Trip History Link */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('RideHistory')}
          activeOpacity={0.8}
        >
          <Text style={styles.actionButtonText}>Trip History</Text>
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
    paddingVertical: 36,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
    fontSize: 40,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 6,
  },
  userRole: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.primary,
    backgroundColor: Colors.light.primaryGhost,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
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
