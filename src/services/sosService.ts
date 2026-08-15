import * as SMS from 'expo-sms';
import { Alert, Platform, Linking } from 'react-native';

export interface EmergencyContact {
  name: string;
  phone: string;
}

export interface SOSLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

class SOSService {
  private static instance: SOSService;
  private readonly EMERGENCY_HOTLINE = '15'; // Pakistan emergency number
  private readonly DEFAULT_MESSAGE = 'SOS! I need help immediately. My location: ';

  private constructor() {}

  static getInstance(): SOSService {
    if (!SOSService.instance) {
      SOSService.instance = new SOSService();
    }
    return SOSService.instance;
  }

  /**
   * Check if SMS is available on the device
   */
  async isSMSAvailable(): Promise<boolean> {
    try {
      const isAvailable = await SMS.isAvailableAsync();
      return isAvailable;
    } catch (error) {
      console.error('Error checking SMS availability:', error);
      return false;
    }
  }

  /**
   * Send SOS SMS to emergency contacts
   * @param contacts Array of emergency contacts
   * @param location Current location coordinates
   * @param customMessage Optional custom message
   */
  async sendSOSSMS(
    contacts: EmergencyContact[],
    location: SOSLocation,
    customMessage?: string
  ): Promise<boolean> {
    try {
      const isAvailable = await this.isSMSAvailable();
      if (!isAvailable) {
        Alert.alert(
          'SMS Not Available',
          'SMS is not available on this device. Please use the emergency hotline instead.'
        );
        return false;
      }

      if (contacts.length === 0) {
        Alert.alert(
          'No Emergency Contacts',
          'Please add emergency contacts in your profile settings.'
        );
        return false;
      }

      const locationText = location.address 
        ? `${location.address} (${location.latitude}, ${location.longitude})`
        : `${location.latitude}, ${location.longitude}`;

      const message = customMessage 
        ? `${customMessage} ${locationText}`
        : `${this.DEFAULT_MESSAGE}${locationText}`;

      const { result } = await SMS.sendSMSAsync(
        contacts.map(c => c.phone),
        message
      );

      return result === 'sent';
    } catch (error) {
      console.error('Error sending SOS SMS:', error);
      Alert.alert(
        'SMS Failed',
        'Failed to send SOS message. Please call emergency services directly.'
      );
      return false;
    }
  }

  /**
   * Call emergency hotline
   */
  async callEmergencyHotline(): Promise<void> {
    try {
      const phoneNumber = this.EMERGENCY_HOTLINE;
      const url = `tel:${phoneNumber}`;
      
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          'Cannot Make Call',
          'Unable to open the phone dialer. Please manually dial ' + phoneNumber
        );
      }
    } catch (error) {
      console.error('Error calling emergency hotline:', error);
      Alert.alert(
        'Call Failed',
        'Unable to call emergency services. Please manually dial 15.'
      );
    }
  }

  /**
   * Trigger full SOS protocol (SMS + Call)
   * @param contacts Emergency contacts
   * @param location Current location
   * @param customMessage Optional custom message
   */
  async triggerSOS(
    contacts: EmergencyContact[],
    location: SOSLocation,
    customMessage?: string
  ): Promise<{ smsSent: boolean; callInitiated: boolean }> {
    // Send SMS first
    const smsSent = await this.sendSOSSMS(contacts, location, customMessage);

    // Then initiate call
    await this.callEmergencyHotline();

    return { smsSent, callInitiated: true };
  }

  /**
   * Format location for SMS message
   * @param location Location coordinates
   * @returns Formatted location string
   */
  formatLocationForSMS(location: SOSLocation): string {
    if (location.address) {
      return `${location.address} (Lat: ${location.latitude.toFixed(6)}, Lon: ${location.longitude.toFixed(6)})`;
    }
    return `Lat: ${location.latitude.toFixed(6)}, Lon: ${location.longitude.toFixed(6)}`;
  }

  /**
   * Get Google Maps link for location
   * @param location Location coordinates
   * @returns Google Maps URL
   */
  getGoogleMapsLink(location: SOSLocation): string {
    return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
  }

  /**
   * Share location via system share sheet
   * @param location Location coordinates
   */
  async shareLocation(location: SOSLocation): Promise<void> {
    try {
      const url = this.getGoogleMapsLink(location);
      const canOpen = await Linking.canOpenURL(url);
      
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Cannot Share', 'Unable to share location.');
      }
    } catch (error) {
      console.error('Error sharing location:', error);
      Alert.alert('Share Failed', 'Unable to share location.');
    }
  }

  /**
   * Show SOS confirmation dialog
   * @param contacts Emergency contacts
   * @param location Current location
   * @param onConfirm Callback when confirmed
   */
  showSOSConfirmation(
    contacts: EmergencyContact[],
    location: SOSLocation,
    onConfirm: () => void
  ): void {
    const contactCount = contacts.length;
    const locationText = this.formatLocationForSMS(location);

    Alert.alert(
      '🚨 EMERGENCY SOS',
      `This will:\n\n• Send SMS to ${contactCount} emergency contact${contactCount !== 1 ? 's' : ''}\n• Call emergency hotline (15)\n\nLocation: ${locationText}\n\nAre you sure you want to proceed?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'SEND SOS',
          style: 'destructive',
          onPress: onConfirm,
        },
      ],
      { cancelable: true }
    );
  }
}

export default SOSService.getInstance();
