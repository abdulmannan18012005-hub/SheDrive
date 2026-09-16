import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Colors from '../../constants/Colors';
import { getApiBaseUrl } from '../../config/apiConfig';
import { useApp } from '../../contexts/AppContext';

export default function PublicProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<any, 'PublicProfile'>>();
  const { userId } = route.params || {};
  const { state } = useApp();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (userId) fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/user/public-profile/${userId}`, {
        headers: {
          Authorization: `Bearer ${state.token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setProfile(data.profile);
      }
    } catch (e) {
      console.warn('Failed to fetch public profile', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>{'< Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Profile</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.light.primary} style={{ marginTop: 50 }} />
        ) : profile ? (
          <View style={styles.card}>
            <View style={styles.avatarContainer}>
              {profile.avatar ? (
                <Image source={{ uri: profile.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ fontSize: 40 }}>👤</Text>
                </View>
              )}
            </View>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.role}>{profile.role.toUpperCase()}</Text>

            <View style={styles.statsContainer}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Member Since</Text>
                <Text style={styles.statValue}>
                  {new Date(profile.memberSince).toLocaleDateString()}
                </Text>
              </View>
              {profile.role === 'driver' && (
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Rating</Text>
                  <Text style={styles.statValue}>⭐ {profile.rating.toFixed(1)}</Text>
                </View>
              )}
            </View>

            {profile.role === 'driver' && (
              <View style={styles.vehicleInfo}>
                <Text style={styles.sectionTitle}>Vehicle Details</Text>
                <Text style={styles.vehicleText}>{profile.vehicleColor} {profile.vehicleMake} {profile.vehicleModel} ({profile.vehicleYear})</Text>
                <View style={styles.plateContainer}>
                  <Text style={styles.plateText}>{profile.vehiclePlate}</Text>
                </View>
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.errorText}>Profile not found.</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backButton: { padding: 8 },
  backText: { color: Colors.light.primary, fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.light.text },
  content: { padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  avatarContainer: { marginBottom: 16 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  name: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  role: { fontSize: 14, fontWeight: '600', color: Colors.light.primary, marginBottom: 20 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 24 },
  statBox: { flex: 1, alignItems: 'center', backgroundColor: '#F1F5F9', padding: 12, borderRadius: 12, marginHorizontal: 4 },
  statLabel: { fontSize: 12, color: '#64748B', marginBottom: 4 },
  statValue: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  vehicleInfo: { width: '100%', alignItems: 'center', paddingTop: 20, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#334155', marginBottom: 12 },
  vehicleText: { fontSize: 15, color: '#475569', marginBottom: 12 },
  plateContainer: { backgroundColor: '#FFD700', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#000' },
  plateText: { fontSize: 18, fontWeight: '900', color: '#000', letterSpacing: 2 },
  errorText: { textAlign: 'center', marginTop: 40, color: '#EF4444', fontSize: 16 }
});
