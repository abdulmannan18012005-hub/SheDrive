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
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import Colors from '../../constants/Colors';
import { useApp } from '../../contexts/AppContext';
import { getApiBaseUrl } from '../../config/apiConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
  const [cnicFrontUrl, setCnicFrontUrl] = useState('');
  const [cnicBackUrl, setCnicBackUrl] = useState('');
  const [selfieUrl, setSelfieUrl] = useState('');

  // Preview modal state
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

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

      // 1. Fetch live profile and documents from backend PostgreSQL
      try {
        const res = await fetch(`${getApiBaseUrl()}/driver/profile`, {
          headers: { Authorization: `Bearer ${state.token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.driver) {
            const d = data.driver;
            if (d.vehicle_make) setMake(d.vehicle_make);
            if (d.vehicle_model) setModel(d.vehicle_model);
            if (d.vehicle_year) setYear(String(d.vehicle_year));
            if (d.vehicle_plate) setPlate(d.vehicle_plate);
            if (d.vehicle_color) setColor(d.vehicle_color);
            if (d.vehicle_photo_url) setPhotoUrl(d.vehicle_photo_url);
            if (d.ac_option) setAcOption(d.ac_option);
            if (d.license_front_url) setLicenseFrontUrl(d.license_front_url);
            if (d.license_back_url) setLicenseBackUrl(d.license_back_url);
            if (d.cnic_front_url) setCnicFrontUrl(d.cnic_front_url);
            if (d.cnic_back_url) setCnicBackUrl(d.cnic_back_url);
            if (d.selfie_url) setSelfieUrl(d.selfie_url);
          }
        }
      } catch (backendErr) {
        console.warn('Backend driver profile fetch error:', backendErr);
      }

      // 2. Fetch supplementary/fallback details from Firestore
      const driverSnap = await getDoc(doc(db, 'drivers', user.uid));
      if (driverSnap.exists()) {
        const driverData = driverSnap.data();
        if (driverData.vehicleInfo) {
          setMake((prev) => prev || driverData.vehicleInfo.make || '');
          setModel((prev) => prev || driverData.vehicleInfo.model || '');
          setYear((prev) => prev || (driverData.vehicleInfo.year ? String(driverData.vehicleInfo.year) : ''));
          setPlate((prev) => prev || driverData.vehicleInfo.plate || '');
          setColor((prev) => prev || driverData.vehicleInfo.color || '');
          setPhotoUrl((prev) => prev || driverData.vehicleInfo.photoUrl || '');
        }
        if (driverData.acOption) {
          setAcOption((prev) => prev || driverData.acOption);
        }
        setLicenseFrontUrl((prev) => prev || driverData.licenseFrontUrl || '');
        setLicenseBackUrl((prev) => prev || driverData.licenseBackUrl || '');
        setRegistrationUrl((prev) => prev || driverData.registrationUrl || '');
        setInsuranceUrl((prev) => prev || driverData.insuranceUrl || '');
        setCnicFrontUrl((prev) => prev || driverData.cnicFrontUrl || '');
        setCnicBackUrl((prev) => prev || driverData.cnicBackUrl || '');
        setSelfieUrl((prev) => prev || driverData.selfieUrl || '');
      }
    } catch (error) {
      console.error('Error fetching driver profile:', error);
      Alert.alert('Error', 'Failed to load vehicle and document information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImagePick = async (
    type: 'vehicle' | 'licenseFront' | 'licenseBack' | 'registration' | 'insurance' | 'cnicFront' | 'cnicBack' | 'selfie'
  ) => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Photo library access is needed to upload documents.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const uri = result.assets[0].uri;
        let finalUrl = uri;

        try {
          const base64Data = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const formattedBase64 = `data:image/jpeg;base64,${base64Data}`;
          const uploadRes = await fetch(`${getApiBaseUrl()}/upload/document`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${state.token}`,
            },
            body: JSON.stringify({
              base64Data: formattedBase64,
              folder: 'shedrive/documents',
            }),
          });
          const uploadData = await uploadRes.json();
          if (uploadRes.ok && uploadData.url) {
            finalUrl = uploadData.url;
          }
        } catch (uploadErr) {
          console.warn('Document upload warning (using fallback URI):', uploadErr);
        }

        switch (type) {
          case 'vehicle':
            setPhotoUrl(finalUrl);
            break;
          case 'licenseFront':
            setLicenseFrontUrl(finalUrl);
            break;
          case 'licenseBack':
            setLicenseBackUrl(finalUrl);
            break;
          case 'registration':
            setRegistrationUrl(finalUrl);
            break;
          case 'insurance':
            setInsuranceUrl(finalUrl);
            break;
          case 'cnicFront':
            setCnicFrontUrl(finalUrl);
            break;
          case 'cnicBack':
            setCnicBackUrl(finalUrl);
            break;
          case 'selfie':
            setSelfieUrl(finalUrl);
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
      const token = state.token;

      // 1. Vehicle info endpoint
      const res = await fetch(`${getApiBaseUrl()}/driver/vehicle-info`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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
            cnicFrontUrl,
            cnicBackUrl,
            selfieUrl,
          },
        }),
      });

      // 2. Documents endpoint
      await fetch(`${getApiBaseUrl()}/driver/documents`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cnicFrontUrl,
          cnicBackUrl,
          licenseFrontUrl,
          licenseBackUrl,
          selfieUrl,
          vehiclePhotoUrl: photoUrl,
        }),
      }).catch((e) => console.warn('Documents update warning:', e));

      // 3. Firestore sync
      if (user?.uid) {
        const driverDocRef = doc(db, 'drivers', user.uid);
        await setDoc(driverDocRef, {
          vehicleInfo: {
            make: make.trim(),
            model: model.trim(),
            year: year.trim(),
            plate: plate.trim(),
            color: color.trim(),
            photoUrl,
          },
          acOption,
          licenseFrontUrl,
          licenseBackUrl,
          registrationUrl,
          insuranceUrl,
          cnicFrontUrl,
          cnicBackUrl,
          selfieUrl,
        }, { merge: true }).catch(() => {});
      }

      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Error', data.error || 'Failed to update vehicle information');
        return;
      }

      Alert.alert(
        'Success',
        'Vehicle information and verification documents updated successfully. Your changes will be reviewed by the admin team.',
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
    <View style={{ flex: 1, backgroundColor: Colors.light.background }}>
      {/* Top Header with Back Navigation */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Text style={styles.backBtnIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>Vehicle Management</Text>
        <View style={{ width: 36 }} />
      </View>

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
        {photoUrl ? (
          <View style={styles.docItemContainer}>
            <Image source={{ uri: photoUrl }} style={styles.docImagePreview} />
            <View style={styles.docActionsRow}>
              <TouchableOpacity
                style={styles.docActionBtn}
                onPress={() => setPreviewImage({ url: photoUrl, title: 'Vehicle Photo' })}
              >
                <Text style={styles.docActionBtnText}>🔍 View Fullscreen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.docActionBtn, styles.docChangeBtn]}
                onPress={() => handleImagePick('vehicle')}
              >
                <Text style={styles.docChangeBtnText}>📷 Change Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.imageUploadButton}
            onPress={() => handleImagePick('vehicle')}
            activeOpacity={0.7}
          >
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderIcon}>📷</Text>
              <Text style={styles.imagePlaceholderText}>Tap to upload vehicle photo</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardHeaderTitle}>🪪 Verification Documents</Text>
        <Text style={{ fontSize: 13, color: Colors.light.textSecondary, marginBottom: 14 }}>
          Upload clear, readable photos of your required verification documents.
        </Text>

        {/* CNIC Front */}
        <Text style={styles.label}>National ID Card (CNIC Front)</Text>
        {cnicFrontUrl ? (
          <View style={styles.docItemContainer}>
            <Image source={{ uri: cnicFrontUrl }} style={styles.docImagePreview} />
            <View style={styles.docActionsRow}>
              <TouchableOpacity
                style={styles.docActionBtn}
                onPress={() => setPreviewImage({ url: cnicFrontUrl, title: 'CNIC Front' })}
              >
                <Text style={styles.docActionBtnText}>🔍 View Fullscreen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.docActionBtn, styles.docChangeBtn]}
                onPress={() => handleImagePick('cnicFront')}
              >
                <Text style={styles.docChangeBtnText}>📷 Change Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.imageUploadButton}
            onPress={() => handleImagePick('cnicFront')}
            activeOpacity={0.7}
          >
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderIcon}>📷</Text>
              <Text style={styles.imagePlaceholderText}>Tap to upload CNIC Front</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* CNIC Back */}
        <Text style={styles.label}>National ID Card (CNIC Back)</Text>
        {cnicBackUrl ? (
          <View style={styles.docItemContainer}>
            <Image source={{ uri: cnicBackUrl }} style={styles.docImagePreview} />
            <View style={styles.docActionsRow}>
              <TouchableOpacity
                style={styles.docActionBtn}
                onPress={() => setPreviewImage({ url: cnicBackUrl, title: 'CNIC Back' })}
              >
                <Text style={styles.docActionBtnText}>🔍 View Fullscreen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.docActionBtn, styles.docChangeBtn]}
                onPress={() => handleImagePick('cnicBack')}
              >
                <Text style={styles.docChangeBtnText}>📷 Change Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.imageUploadButton}
            onPress={() => handleImagePick('cnicBack')}
            activeOpacity={0.7}
          >
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderIcon}>📷</Text>
              <Text style={styles.imagePlaceholderText}>Tap to upload CNIC Back</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Profile Photo / Registration Selfie */}
        <Text style={styles.label}>Driver Registration Photo / Selfie</Text>
        {selfieUrl ? (
          <View style={styles.docItemContainer}>
            <Image source={{ uri: selfieUrl }} style={styles.docImagePreview} />
            <View style={styles.docActionsRow}>
              <TouchableOpacity
                style={styles.docActionBtn}
                onPress={() => setPreviewImage({ url: selfieUrl, title: 'Driver Photo / Selfie' })}
              >
                <Text style={styles.docActionBtnText}>🔍 View Fullscreen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.docActionBtn, styles.docChangeBtn]}
                onPress={() => handleImagePick('selfie')}
              >
                <Text style={styles.docChangeBtnText}>📷 Change Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.imageUploadButton}
            onPress={() => handleImagePick('selfie')}
            activeOpacity={0.7}
          >
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderIcon}>📷</Text>
              <Text style={styles.imagePlaceholderText}>Tap to upload Driver Photo</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Driving License (Front) */}
        <Text style={styles.label}>Driving License (Front)</Text>
        {licenseFrontUrl ? (
          <View style={styles.docItemContainer}>
            <Image source={{ uri: licenseFrontUrl }} style={styles.docImagePreview} />
            <View style={styles.docActionsRow}>
              <TouchableOpacity
                style={styles.docActionBtn}
                onPress={() => setPreviewImage({ url: licenseFrontUrl, title: 'Driving License Front' })}
              >
                <Text style={styles.docActionBtnText}>🔍 View Fullscreen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.docActionBtn, styles.docChangeBtn]}
                onPress={() => handleImagePick('licenseFront')}
              >
                <Text style={styles.docChangeBtnText}>📷 Change Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.imageUploadButton}
            onPress={() => handleImagePick('licenseFront')}
            activeOpacity={0.7}
          >
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderIcon}>📷</Text>
              <Text style={styles.imagePlaceholderText}>Tap to upload license front</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Driving License (Back) */}
        <Text style={styles.label}>Driving License (Back)</Text>
        {licenseBackUrl ? (
          <View style={styles.docItemContainer}>
            <Image source={{ uri: licenseBackUrl }} style={styles.docImagePreview} />
            <View style={styles.docActionsRow}>
              <TouchableOpacity
                style={styles.docActionBtn}
                onPress={() => setPreviewImage({ url: licenseBackUrl, title: 'Driving License Back' })}
              >
                <Text style={styles.docActionBtnText}>🔍 View Fullscreen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.docActionBtn, styles.docChangeBtn]}
                onPress={() => handleImagePick('licenseBack')}
              >
                <Text style={styles.docChangeBtnText}>📷 Change Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.imageUploadButton}
            onPress={() => handleImagePick('licenseBack')}
            activeOpacity={0.7}
          >
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderIcon}>📷</Text>
              <Text style={styles.imagePlaceholderText}>Tap to upload license back</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Vehicle Registration */}
        <Text style={styles.label}>Vehicle Registration Card / Book</Text>
        {registrationUrl ? (
          <View style={styles.docItemContainer}>
            <Image source={{ uri: registrationUrl }} style={styles.docImagePreview} />
            <View style={styles.docActionsRow}>
              <TouchableOpacity
                style={styles.docActionBtn}
                onPress={() => setPreviewImage({ url: registrationUrl, title: 'Vehicle Registration' })}
              >
                <Text style={styles.docActionBtnText}>🔍 View Fullscreen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.docActionBtn, styles.docChangeBtn]}
                onPress={() => handleImagePick('registration')}
              >
                <Text style={styles.docChangeBtnText}>📷 Change Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.imageUploadButton}
            onPress={() => handleImagePick('registration')}
            activeOpacity={0.7}
          >
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderIcon}>📷</Text>
              <Text style={styles.imagePlaceholderText}>Tap to upload registration</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Insurance (Optional) */}
        <Text style={styles.label}>Insurance (Optional)</Text>
        {insuranceUrl ? (
          <View style={styles.docItemContainer}>
            <Image source={{ uri: insuranceUrl }} style={styles.docImagePreview} />
            <View style={styles.docActionsRow}>
              <TouchableOpacity
                style={styles.docActionBtn}
                onPress={() => setPreviewImage({ url: insuranceUrl, title: 'Insurance Document' })}
              >
                <Text style={styles.docActionBtnText}>🔍 View Fullscreen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.docActionBtn, styles.docChangeBtn]}
                onPress={() => handleImagePick('insurance')}
              >
                <Text style={styles.docChangeBtnText}>📷 Change Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.imageUploadButton}
            onPress={() => handleImagePick('insurance')}
            activeOpacity={0.7}
          >
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderIcon}>📷</Text>
              <Text style={styles.imagePlaceholderText}>Tap to upload insurance</Text>
            </View>
          </TouchableOpacity>
        )}
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

      {/* Fullscreen Document Preview Modal */}
      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.previewModalOverlay}>
          <SafeAreaView style={styles.previewModalHeader}>
            <Text style={styles.previewModalTitle}>{previewImage?.title || 'Document Preview'}</Text>
            <TouchableOpacity
              onPress={() => setPreviewImage(null)}
              style={styles.previewCloseBtn}
            >
              <Text style={styles.previewCloseText}>✕</Text>
            </TouchableOpacity>
          </SafeAreaView>
          <View style={styles.previewImageContainer}>
            {previewImage?.url ? (
              <Image
                source={{ uri: previewImage.url }}
                style={styles.previewImageFull}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </ScrollView>
  </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  topHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.light.text,
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
  docItemContainer: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
    overflow: 'hidden',
    marginBottom: 14,
  },
  docImagePreview: {
    width: '100%',
    height: 180,
    backgroundColor: '#E5E7EB',
  },
  docActionsRow: {
    flexDirection: 'row',
    padding: 10,
    gap: 10,
    backgroundColor: Colors.light.surface,
  },
  docActionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.light.primaryGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  docChangeBtn: {
    backgroundColor: '#F3F4F6',
  },
  docChangeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  previewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  previewModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  previewModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
  },
  previewCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCloseText: {
    fontSize: 18,
    color: '#FFF',
    fontWeight: '700',
  },
  previewImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  previewImageFull: {
    width: '100%',
    height: '100%',
  },
});
