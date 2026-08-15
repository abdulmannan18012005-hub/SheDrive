import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import Colors from '../../constants/Colors';
import { useApp } from '../../contexts/AppContext';
import { getApiBaseUrl } from '../../config/apiConfig';
import { searchAddress, reverseGeocode } from '../../services/nominatim';
import { LocationPoint } from '../../types';

interface SavedPlace {
  id: string;
  label: string;
  name: string;
  latitude: number;
  longitude: number;
  createdAt: number;
}

type PlaceLabel = 'home' | 'work' | 'other';

export default function SavedPlacesScreen(): React.JSX.Element {
  const { state } = useApp();
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPlace, setEditingPlace] = useState<SavedPlace | null>(null);

  // Form states
  const [label, setLabel] = useState<PlaceLabel>('other');
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchSavedPlaces();
  }, []);

  const fetchSavedPlaces = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${getApiBaseUrl()}/user/saved-places`, {
        headers: {
          Authorization: `Bearer ${state.token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Error', data.error || 'Failed to fetch saved places');
        return;
      }

      setPlaces(data.places || []);
    } catch (err: any) {
      console.error('Fetch saved places error:', err);
      // If API fails, show empty state - this is expected during development
      setPlaces([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPlace = async () => {
    if (!name.trim() || !latitude.trim() || !longitude.trim()) {
      Alert.alert('Location Required', 'Please search and select a location from the search results dropdown.');
      return;
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      Alert.alert('Invalid Latitude', 'Please enter a valid latitude (-90 to 90).');
      return;
    }

    if (isNaN(lon) || lon < -180 || lon > 180) {
      Alert.alert('Invalid Longitude', 'Please enter a valid longitude (-180 to 180).');
      return;
    }

    // Check if Home or Work already exists
    if (label === 'home' || label === 'work') {
      const existing = places.find(p => p.label === label);
      if (existing && (!editingPlace || existing.id !== editingPlace.id)) {
        Alert.alert(
          'Place Exists',
          `You already have a ${label === 'home' ? 'Home' : 'Work'} location. Please edit it instead.`,
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const url = editingPlace
        ? `${getApiBaseUrl()}/user/saved-places/${editingPlace.id}`
        : `${getApiBaseUrl()}/user/saved-places`;

      const res = await fetch(url, {
        method: editingPlace ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.token}`,
        },
        body: JSON.stringify({
          label,
          name: name.trim(),
          latitude: lat,
          longitude: lon,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Error', data.error || 'Failed to save place');
        return;
      }

      Alert.alert(
        'Success',
        editingPlace ? 'Place updated successfully.' : 'Place saved successfully.',
      );
      closeModal();
      fetchSavedPlaces();
    } catch (err: any) {
      console.error('Save place error:', err);
      Alert.alert('Network Error', 'Unable to connect to server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePlace = async (placeId: string) => {
    Alert.alert(
      'Delete Place',
      'Are you sure you want to delete this saved place?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${getApiBaseUrl()}/user/saved-places/${placeId}`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${state.token}`,
                },
              });

              if (!res.ok) {
                const data = await res.json();
                Alert.alert('Error', data.error || 'Failed to delete place');
                return;
              }

              Alert.alert('Deleted', 'Place deleted successfully.');
              fetchSavedPlaces();
            } catch (err: any) {
              console.error('Delete place error:', err);
              Alert.alert('Network Error', 'Unable to connect to server');
            }
          },
        },
      ],
    );
  };

  const openAddModal = () => {
    setEditingPlace(null);
    setLabel('other');
    setName('');
    setLatitude('');
    setLongitude('');
    setModalVisible(true);
  };

  const openEditModal = (place: SavedPlace) => {
    setEditingPlace(place);
    setLabel(place.label as PlaceLabel);
    setName(place.name);
    setLatitude(place.latitude.toString());
    setLongitude(place.longitude.toString());
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingPlace(null);
    setLabel('other');
    setName('');
    setLatitude('');
    setLongitude('');
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSearchLocation = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const results = await searchAddress(query);
      setSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (item: any) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    const shortLabel = item.display_name.split(',')[0];
    
    setLatitude(lat.toString());
    setLongitude(lon.toString());
    setName(shortLabel);
    setSearchQuery(shortLabel);
    setSearchResults([]);
  };

  const getLabelIcon = (label: string): string => {
    switch (label) {
      case 'home':
        return '🏠';
      case 'work':
        return '💼';
      default:
        return '📍';
    }
  };

  const getLabelDisplay = (label: string): string => {
    switch (label) {
      case 'home':
        return 'Home';
      case 'work':
        return 'Work';
      default:
        return 'Other';
    }
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
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Text style={styles.headerIcon}>📍</Text>
        </View>
        <Text style={styles.headerTitle}>Saved Places</Text>
        <Text style={styles.headerSubtitle}>Save your favorite locations for quick access</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardHeaderTitle}>Your Saved Places</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={openAddModal}
            activeOpacity={0.7}
          >
            <Text style={styles.addButtonText}>+ Add New</Text>
          </TouchableOpacity>
        </View>

        {places.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🗺️</Text>
            <Text style={styles.emptyTitle}>No Saved Places</Text>
            <Text style={styles.emptyText}>
              Save your Home, Work, or other favorite locations for easier ride booking.
            </Text>
          </View>
        ) : (
          <View style={styles.placesList}>
            {places.map((place) => (
              <View key={place.id} style={styles.placeCard}>
                <View style={styles.placeLeft}>
                  <View style={styles.placeIconBadge}>
                    <Text style={styles.placeIcon}>{getLabelIcon(place.label)}</Text>
                  </View>
                  <View style={styles.placeInfo}>
                    <Text style={styles.placeName}>{place.name}</Text>
                    <View style={styles.placeMeta}>
                      <Text style={styles.placeLabel}>{getLabelDisplay(place.label)}</Text>
                      <Text style={styles.placeCoords}>
                        {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.placeActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => openEditModal(place)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDeletePlace(place.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>💡 Tips</Text>
        <Text style={styles.infoText}>
          • You can save up to 10 places
        </Text>
        <Text style={styles.infoText}>
          • Home and Work are special labels for quick access
        </Text>
        <Text style={styles.infoText}>
          • Use the map to select coordinates for accurate locations
        </Text>
      </View>

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingPlace ? 'Edit Place' : 'Add New Place'}
              </Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.label}>Place Type</Text>
              <View style={styles.labelSelector}>
                {(['home', 'work', 'other'] as PlaceLabel[]).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.labelOption,
                      label === type && styles.labelOptionActive,
                    ]}
                    onPress={() => setLabel(type)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.labelOptionIcon}>{getLabelIcon(type)}</Text>
                    <Text
                      style={[
                        styles.labelOptionText,
                        label === type && styles.labelOptionTextActive,
                      ]}
                    >
                      {getLabelDisplay(type)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Search Location</Text>
              <TextInput
                style={styles.input}
                placeholder="Search for a place..."
                placeholderTextColor={Colors.light.textTertiary}
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  handleSearchLocation(text);
                }}
                editable={!isSubmitting}
              />

              {isSearching && (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <ActivityIndicator color={Colors.light.primary} size="small" />
                </View>
              )}

              {searchResults.length > 0 && (
                <View style={styles.searchResultsContainer}>
                  <Text style={styles.searchResultsTitle}>Search Results</Text>
                  {searchResults.map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.searchResultItem}
                      onPress={() => handleSelectSearchResult(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.searchResultIcon}>📍</Text>
                      <View style={styles.searchResultTextContainer}>
                        <Text style={styles.searchResultTitle}>{item.display_name.split(',')[0]}</Text>
                        <Text style={styles.searchResultSubtitle} numberOfLines={2}>
                          {item.display_name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.label}>Place Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., My Home, Office, Gym"
                placeholderTextColor={Colors.light.textTertiary}
                value={name}
                onChangeText={setName}
                editable={!isSubmitting}
              />



              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleAddPlace}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {editingPlace ? 'Update Place' : 'Save Place'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.light.text,
  },
  addButton: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  placesList: {
    gap: 12,
  },
  placeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  placeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  placeIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.light.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeIcon: {
    fontSize: 20,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
  },
  placeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  placeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.primary,
    backgroundColor: Colors.light.primaryGhost,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    textTransform: 'capitalize',
  },
  placeCoords: {
    fontSize: 12,
    color: Colors.light.textTertiary,
  },
  placeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.light.primaryGhost,
    borderWidth: 1,
    borderColor: Colors.light.primary,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  deleteButton: {
    backgroundColor: Colors.light.errorLight,
    borderColor: Colors.light.error,
  },
  deleteButtonText: {
    color: Colors.light.error,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.light.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  modalBody: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
    marginTop: 8,
  },
  labelSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  labelOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  labelOptionActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  labelOptionIcon: {
    fontSize: 16,
  },
  labelOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  labelOptionTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.light.text,
    marginBottom: 8,
  },
  submitButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  searchResultsContainer: {
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    maxHeight: 200,
  },
  searchResultsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
    gap: 12,
  },
  searchResultIcon: {
    fontSize: 16,
  },
  searchResultTextContainer: {
    flex: 1,
  },
  searchResultTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  searchResultSubtitle: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
});
