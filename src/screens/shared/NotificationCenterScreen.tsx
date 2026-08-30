import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import Colors from '../../constants/Colors';
import { useApp } from '../../contexts/AppContext';
import { getApiBaseUrl } from '../../config/apiConfig';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: 'system' | 'ride' | 'safety' | 'payment' | 'promotional' | 'promo' | string;
  is_read: boolean;
  created_at: number;
}

export default function NotificationCenterScreen(): React.JSX.Element {
  const { state } = useApp();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${getApiBaseUrl()}/user/notifications`, {
        headers: {
          Authorization: `Bearer ${state.token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Error', data.error || 'Failed to fetch notifications');
        return;
      }

      setNotifications(data.notifications || []);
    } catch (err: any) {
      console.error('Fetch notifications error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch(`${getApiBaseUrl()}/user/notifications/all/read`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${state.token}`,
        },
      });

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Mark all read error:', err);
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'ride':
        return '🚗';
      case 'safety':
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

  const filteredNotifications = notifications.filter((n) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'promo' || selectedCategory === 'promotional') {
      return n.category === 'promo' || n.category === 'promotional';
    }
    return n.category === selectedCategory;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => {
            setIsRefreshing(true);
            fetchNotifications();
          }}
          tintColor={Colors.light.primary}
        />
      }
    >
      {/* Header Banner */}
      <View style={styles.header}>
        <View style={styles.headerBadge}>
          <Text style={styles.headerIcon}>🔔</Text>
        </View>
        <Text style={styles.headerTitle}>Notifications Center</Text>
        <Text style={styles.headerSubtitle}>
          Stay updated on your rides, safety alerts, monthly payments, and exclusive platform offers.
        </Text>
      </View>

      {/* Category Pills & Mark Read Bar */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {['all', 'ride', 'safety', 'payment', 'system', 'promo'].map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.filterPill, selectedCategory === cat && styles.filterPillActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.filterPillText, selectedCategory === cat && styles.filterPillTextActive]}>
                {cat === 'promo' ? 'Promo' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Mark All Read Action Bar */}
      {unreadCount > 0 && (
        <View style={styles.actionRow}>
          <Text style={styles.unreadBadgeText}>{unreadCount} unread notification(s)</Text>
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markReadText}>✓ Mark All as Read</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Content */}
      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.light.primary} />
          </View>
        ) : filteredNotifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptySubtitle}>You're all caught up! You have no unread notifications in this category.</Text>
          </View>
        ) : (
          filteredNotifications.map((n) => (
            <View key={n.id} style={[styles.notifCard, !n.is_read && styles.notifCardUnread]}>
              <View style={styles.notifIconBox}>
                <Text style={styles.notifIcon}>{getCategoryIcon(n.category)}</Text>
              </View>
              <View style={styles.notifInfo}>
                <View style={styles.notifTitleRow}>
                  <Text style={styles.notifTitle}>{n.title}</Text>
                  {!n.is_read && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.notifMessage}>{n.message}</Text>
                <Text style={styles.notifTime}>
                  {new Date(n.created_at).toLocaleDateString()} • {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          ))
        )}
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
    paddingVertical: 28,
    paddingHorizontal: 20,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  headerBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.light.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
  },
  headerIcon: { fontSize: 32 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.light.text, marginBottom: 4 },
  headerSubtitle: { fontSize: 13, color: Colors.light.textSecondary, textAlign: 'center', lineHeight: 18 },
  filterBar: { paddingVertical: 14, paddingHorizontal: 20 },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  filterPillActive: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  filterPillText: { fontSize: 13, fontWeight: '700', color: Colors.light.textSecondary },
  filterPillTextActive: { color: '#FFFFFF' },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  unreadBadgeText: { fontSize: 13, fontWeight: '700', color: Colors.light.textSecondary },
  markReadText: { fontSize: 13, fontWeight: '800', color: Colors.light.primary },
  content: { paddingHorizontal: 20 },
  loadingBox: { paddingVertical: 40 },
  emptyCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.light.text, marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: Colors.light.textSecondary, textAlign: 'center', lineHeight: 18 },
  notifCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  notifCardUnread: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primaryGhost,
  },
  notifIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.light.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  notifIcon: { fontSize: 22 },
  notifInfo: { flex: 1 },
  notifTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  notifTitle: { fontSize: 15, fontWeight: '800', color: Colors.light.text },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.light.primary },
  notifMessage: { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 18 },
  notifTime: { fontSize: 11, color: Colors.light.textTertiary, marginTop: 6, fontWeight: '600' },
});
