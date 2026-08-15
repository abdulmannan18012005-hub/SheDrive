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
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import Colors from '../../constants/Colors';
import { useApp } from '../../contexts/AppContext';
import { getApiBaseUrl } from '../../config/apiConfig';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';

const VEHICLE_MAKES = [
  'Suzuki', 'Toyota', 'Honda', 'Hyundai', 'Kia', 'Changan', 'MG', 'DFSK',
  'Prince', 'FAW', 'Isuzu', 'JAC', 'Proton', 'Audi', 'BMW', 'Mercedes',
  'Nissan', 'Mitsubishi', 'Others',
];

const VEHICLE_MODELS_MAP: Record<string, string[]> = {
  Suzuki: ['Alto', 'Cultus', 'Wagon R', 'Swift', 'Bolan', 'Mehran', 'Every', 'Ciaz'],
  Toyota: ['Corolla', 'Yaris', 'Vitz', 'Passo', 'Fortuner', 'Hilux Revo', 'Prius', 'Aqua'],
  Honda: ['Civic', 'City', 'BR-V', 'HR-V', 'Vezel', 'N-One', 'N-Wgn'],
  Hyundai: ['Elantra', 'Tucson', 'Sonata', 'Grand Starex', 'Porter H-100'],
  Kia: ['Sportage', 'Picanto', 'Stonic', 'Sorento', 'Carnival'],
  Changan: ['Alsvin', 'Karvaan', 'Oshan X7', 'M9'],
  MG: ['HS', 'ZS', 'ZS EV', 'GT'],
  DFSK: ['Glory 580', 'K01'],
  Prince: ['Pearl', 'K07'],
  FAW: ['V2', 'X-PV', 'Carrier'],
  Isuzu: ['D-Max'],
  JAC: ['J4', 'J5', 'S2', 'S3'],
  Proton: ['Saga', 'Persona', 'Iriz', 'Exora', 'X70'],
  Audi: ['A3', 'A4', 'A6', 'Q3', 'Q5', 'Q7'],
  BMW: ['1 Series', '3 Series', '5 Series', 'X1', 'X3', 'X5'],
  Mercedes: ['A-Class', 'C-Class', 'E-Class', 'GLA', 'GLC', 'GLE'],
  Nissan: ['Sunny', 'Civic', 'Juke', 'X-Trail', 'Patrol'],
  Mitsubishi: ['Lancer', 'Mirage', 'Outlander', 'Pajero'],
  Others: ['Other'],
};

export default function VehicleManagementScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { state } = useApp();
  const user = state.user;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Vehicle form states
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [plate, setPlate] = useState('');
  const [color, setColor] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [acOption, setAcOption] = useState<'ac' | 'non_ac' | 'both'>('both');

  // Document states
  const [licenseFrontUrl, setLicenseFrontUrl] = useState('');
  const [licenseBackUrl, setLicenseBackUrl] = useState('');
  const [registrationUrl, setRegistrationUrl] = useState('');
  const [insuranceUrl, setInsuranceUrl] = useState('');

  // Modal states
  const [makeModalVisible, setMakeModalVisible] = useState(false);
  const [modelModalVisible, setModelModalVisible] = useState(false);

  useEffect(() => {
    fetchDriverProfile();
  }, []);

  const fetchDriverProfile = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const driverSnap = await getDoc(doc(db, 'drivers', user.uid));
      if (driverSnap.exists()) {
        const driverData = driverSnap.data();
        if (driverData.vehicleInfo) {
          setMake(driverData.vehicleInfo.make || '');
          setModel(driverData.vehicleInfo.model || '');
          setYear(driverData.vehicleInfo.year || '');
          setPlate(driverData.vehicleInfo.plate || '');
          setColor(driverData.vehicleInfo.color || '');
          setPhotoUrl(driverData.vehicleInfo.photoUrl || '');
        }
        if (driverData.acOption) {
          setAcOption(driverData.acOption);
        }
        setLicenseFrontUrl(driverData.licenseFrontUrl || '');
        setLicenseBackUrl(driverData.licenseBackUrl || '');
        setRegistrationUrl(driverData.registrationUrl || '');
        setInsuranceUrl(driverData.insuranceUrl || '');
      }
    } catch (error) {
      console.error('Error fetching driver profile:', error);
      Alert.alert('Error', 'Failed to load vehicle information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImagePick = async (type: 'vehicle' | 'licenseFront' | 'licenseBack' | 'registration' | 'insurance') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const uri = result.assets[0].uri;
        
        // For now, just set the URI. In production, upload to server/cloud
        switch (type) {
          case 'vehicle':
            setPhotoUrl(uri);
            break;
          case 'licenseFront':
            setLicenseFrontUrl(uri);
            break;
          case 'licenseBack':
            setLicenseBackUrl(uri);
            break;
          case 'registration':
            setRegistrationUrl(uri);
            break;
          case 'insurance':
            setInsuranceUrl(uri);
            break;
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const handleSubmit = async () => {
    if (!make.trim() || !model.trim() || !plate.trim() || !color.trim()) {
      Alert.alert('Required Fields', 'Please fill in all vehicle details');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`${getApiBaseUrl()}/driver/vehicle-info`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.token}`,
        },
        body: JSON.stringify({
          vehicleInfo: {
            make: make.trim(),
            model: model.trim(),
            year: year.trim(),
            plate: plate.trim(),
            color: color.trim(),
            photoUrl,
          },
          acOption,
          documents: {
            licenseFrontUrl,
            licenseBackUrl,
            registrationUrl,
            insuranceUrl,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Error', data.error || 'Failed to update vehicle information');
        return;
      }

      Alert.alert(
        'Success',
        'Vehicle information updated successfully. Your changes will be reviewed by the admin team.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } catch (error) {
      console.error('Error submitting vehicle info:', error);
      Alert.alert('Network Error', 'Unable to connect to server');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  const availableModels = make ? VEHICLE_MODELS_MAP[make] || [] : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Text style={styles.headerIcon}>🚗</Text>
        </View>
        <Text style={styles.headerTitle}>Vehicle Management</Text>
        <Text style={styles.headerSubtitle}>Update your vehicle details and documents</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardHeaderTitle}>Vehicle Details</Text>

        <Text style={styles.label}>Vehicle Make</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => setMakeModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.inputText, !make && styles.placeholderText]}>
            {make || 'Select vehicle make'}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Vehicle Model</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => {
            if (make) setModelModalVisible(true);
            else Alert.alert('Select Make First', 'Please select a vehicle make first');
          }}
          activeOpacity={0.7}
          disabled={!make}
        >
          <Text style={[styles.inputText, !model && styles.placeholderText]}>
            {model || 'Select vehicle model'}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Year</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., 2020"
          placeholderTextColor={Colors.light.textTertiary}
          value={year}
          onChangeText={setYear}
          keyboardType="number-pad"
          maxLength={4}
          editable={!isSubmitting}
        />

        <Text style={styles.label}>License Plate</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., LEA-1234"
          placeholderTextColor={Colors.light.textTertiary}
          value={plate}
          onChangeText={setPlate}
          autoCapitalize="characters"
          editable={!isSubmitting}
        />

        <Text style={styles.label}>Color</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., White"
          placeholderTextColor={Colors.light.textTertiary}
          value={color}
          onChangeText={setColor}
          editable={!isSubmitting}
        />

        <Text style={styles.label}>Air Conditioning (AC) Option</Text>
        <Text style={{ fontSize: 12, color: Colors.light.textTertiary, marginBottom: 8, fontStyle: 'italic' }}>
          You can select both AC and Non-AC.
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          {[
            { id: 'ac', label: '❄️ AC' },
            { id: 'non_ac', label: '🍃 Non-AC' },
            { id: 'both', label: '❄️🍃 Both' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: acOption === opt.id ? Colors.light.primary : Colors.light.border,
                backgroundColor: acOption === opt.id ? Colors.light.primaryGhost : Colors.light.background,
                alignItems: 'center',
              }}
              onPress={() => setAcOption(opt.id as 'ac' | 'non_ac' | 'both')}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 13, fontWeight: acOption === opt.id ? '800' : '600', color: acOption === opt.id ? Colors.light.primary : Colors.light.textSecondary }}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Vehicle Photo</Text>
        <TouchableOpacity
          style={styles.imageUploadButton}
          onPress={() => handleImagePick('vehicle')}
          activeOpacity={0.7}
        >
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.imagePreview} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderIcon}>📷</Text>
              <Text style={styles.imagePlaceholderText}>Tap to upload vehicle photo</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardHeaderTitle}>Documents</Text>

        <Text style={styles.label}>Driving License (Front)</Text>
        <TouchableOpacity
          style={styles.imageUploadButton}
          onPress={() => handleImagePick('licenseFront')}
          activeOpacity={0.7}
        >
          {licenseFrontUrl ? (
            <Image source={{ uri: licenseFrontUrl }} style={styles.imagePreview} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderIcon}>📷</Text>
              <Text style={styles.imagePlaceholderText}>Tap to upload license front</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Driving License (Back)</Text>
        <TouchableOpacity
          style={styles.imageUploadButton}
          onPress={() => handleImagePick('licenseBack')}
          activeOpacity={0.7}
        >
          {licenseBackUrl ? (
            <Image source={{ uri: licenseBackUrl }} style={styles.imagePreview} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderIcon}>📷</Text>
              <Text style={styles.imagePlaceholderText}>Tap to upload license back</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Vehicle Registration</Text>
        <TouchableOpacity
          style={styles.imageUploadButton}
          onPress={() => handleImagePick('registration')}
          activeOpacity={0.7}
        >
          {registrationUrl ? (
            <Image source={{ uri: registrationUrl }} style={styles.imagePreview} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderIcon}>📷</Text>
              <Text style={styles.imagePlaceholderText}>Tap to upload registration</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Insurance (Optional)</Text>
        <TouchableOpacity
          style={styles.imageUploadButton}
          onPress={() => handleImagePick('insurance')}
          activeOpacity={0.7}
        >
          {insuranceUrl ? (
            <Image source={{ uri: insuranceUrl }} style={styles.imagePreview} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderIcon}>📷</Text>
              <Text style={styles.imagePlaceholderText}>Tap to upload insurance</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>ℹ️ Important</Text>
        <Text style={styles.infoText}>
          • All changes will be reviewed by the admin team
        </Text>
        <Text style={styles.infoText}>
          • Your account may be temporarily suspended during review
        </Text>
        <Text style={styles.infoText}>
          • Ensure all documents are clear and readable
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        activeOpacity={0.8}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.submitButtonText}>Submit for Review</Text>
        )}
      </TouchableOpacity>

      {/* Make Selection Modal */}
      <Modal
        visible={makeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMakeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Vehicle Make</Text>
              <TouchableOpacity
                onPress={() => setMakeModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {VEHICLE_MAKES.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={styles.optionItem}
                  onPress={() => {
                    setMake(item);
                    setModel('');
                    setMakeModalVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.optionText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Model Selection Modal */}
      <Modal
        visible={modelModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Vehicle Model</Text>
              <TouchableOpacity
                onPress={() => setModelModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {availableModels.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={styles.optionItem}
                  onPress={() => {
                    setModel(item);
                    setModelModalVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.optionText}>{item}</Text>
                </TouchableOpacity>
              ))}
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
  cardHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    color: Colors.light.text,
  },
  placeholderText: {
    color: Colors.light.textTertiary,
  },
  chevron: {
    fontSize: 22,
    color: Colors.light.textTertiary,
  },
  imageUploadButton: {
    height: 150,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.light.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  imagePlaceholderText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
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
  submitButton: {
    backgroundColor: Colors.light.primary,
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
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
    maxHeight: '70%',
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
    padding: 8,
  },
  optionItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
});
