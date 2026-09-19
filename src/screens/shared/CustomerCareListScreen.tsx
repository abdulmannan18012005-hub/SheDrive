import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { PassengerStackParamList } from '../../types';
import { getApiBaseUrl } from '../../config/apiConfig';

type NavigationProp = StackNavigationProp<PassengerStackParamList>;

interface Ticket {
  id: string;
  category: string;
  subject: string;
  status: string;
  created_at: string;
}

export const CustomerCareListScreen: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation<NavigationProp>();
  const isFocused = useIsFocused();
  const { state } = useApp();

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const token = state.token;
      const response = await fetch(`${getApiBaseUrl()}/support/tickets`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setTickets(data.tickets || []);
      } else {
        console.error('Failed to fetch tickets');
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchTickets();
    }
  }, [isFocused]);

  const handleDelete = async (ticketId: string) => {
    Alert.alert('Delete Ticket', 'Are you sure you want to delete this ticket?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = state.token;
            const response = await fetch(`${getApiBaseUrl()}/support/tickets/${ticketId}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            if (response.ok) {
              setTickets(tickets.filter((t) => t.id !== ticketId));
            } else {
              Alert.alert('Error', 'Failed to delete ticket.');
            }
          } catch (error) {
            console.error('Delete ticket error:', error);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Ticket }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('CustomerCareChat', { ticketId: item.id, subject: item.subject })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.subject} numberOfLines={1}>{item.subject}</Text>
        <Text style={[styles.status, { color: item.status === 'open' ? '#e53935' : '#43a047' }]}>
          {item.status.toUpperCase()}
        </Text>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.category}>{item.category}</Text>
        <Text style={styles.date}>{new Date(Number(item.created_at)).toLocaleDateString()}</Text>
      </View>
      <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
        <Ionicons name="trash-outline" size={20} color="#e53935" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customer Care</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#e91e63" style={styles.loader} />
      ) : tickets.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No support tickets found.</Text>
        </View>
      ) : (
        <FlatList
          data={tickets}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('ReportProblem')}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 10, fontSize: 16, color: '#666' },
  listContainer: { padding: 15 },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    position: 'relative',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingRight: 30 },
  subject: { fontSize: 16, fontWeight: 'bold', color: '#333', flex: 1 },
  status: { fontSize: 12, fontWeight: 'bold' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  category: { fontSize: 14, color: '#666' },
  date: { fontSize: 12, color: '#999' },
  deleteButton: { position: 'absolute', top: 15, right: 15, padding: 5 },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#e91e63',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});
