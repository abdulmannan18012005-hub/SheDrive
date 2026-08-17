import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Colors from '../../constants/Colors';
import { CONTACT_INFO } from '../../config/contactConfig';

export default function AboutUsScreen(): React.JSX.Element {
  const navigation = useNavigation();

  const handleEmailPress = () => {
    Linking.openURL(`mailto:${CONTACT_INFO.supportEmail}`).catch(() => {
      Alert.alert('Error', 'Unable to open email client');
    });
  };

  const handlePhonePress = () => {
    Linking.openURL(`tel:${CONTACT_INFO.emergencyHotline}`).catch(() => {
      Alert.alert('Error', 'Unable to make phone call');
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Hero Banner */}
      <View style={styles.hero}>
        <Text style={styles.heroIcon}>🚗</Text>
        <Text style={styles.heroTitle}>About SheDrive</Text>
        <Text style={styles.heroSubtitle}>Pakistan's First Women-Only Ride-Hailing Platform</Text>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>🇵🇰 Proudly Serving Lahore</Text>
        </View>
      </View>

      {/* What is SheDrive */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What is SheDrive?</Text>
        <Text style={styles.bodyText}>
          SheDrive is Pakistan's first dedicated women-only ride-hailing platform, purpose-built to provide safe, 
          comfortable, and dignified transportation for women across Lahore. Launched to address the long-standing 
          safety concerns faced by women commuters in Pakistan, SheDrive connects female passengers exclusively 
          with verified female drivers — creating a trusted community on wheels.
        </Text>
        <Text style={styles.bodyText}>
          Our platform was designed with one core belief: every woman deserves the freedom to travel safely, 
          at any time of day, without fear or compromise. Whether you are a student, a working professional, 
          a homemaker, or a visitor — SheDrive is your reliable travel companion in Lahore.
        </Text>
      </View>

      {/* How Passengers Use SheDrive */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🛣️ For Passengers — How It Works</Text>
        <View style={styles.stepList}>
          {[
            { step: '1', title: 'Register & Verify', desc: 'Create your account with your Pakistani mobile number and CNIC for identity verification. Your information is securely encrypted.' },
            { step: '2', title: 'Book Your Ride', desc: 'Open SheDrive, enter your pickup location and destination. Our system instantly calculates the estimated route, distance, and fare.' },
            { step: '3', title: 'Negotiate the Fare', desc: 'SheDrive uses a unique fare bidding system. You can accept the driver\'s proposed fare or counter-offer for a price you\'re comfortable with.' },
            { step: '4', title: 'Ride Safely', desc: 'Your verified female driver arrives at your location. Track the ride in real time on the map. Your route and driver details are visible throughout the journey.' },
            { step: '5', title: 'Complete & Rate', desc: 'Once you reach your destination, rate your experience and provide feedback to help maintain SheDrive\'s high quality standards.' },
          ].map(({ step, title, desc }) => (
            <View key={step} style={styles.step}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{step}</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>{title}</Text>
                <Text style={styles.stepDesc}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* How Drivers Earn */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💰 For Drivers — Earn with SheDrive</Text>
        <Text style={styles.bodyText}>
          SheDrive empowers Pakistani women to become financially independent by driving on their own schedule. 
          As a SheDrive driver partner, you earn income by completing rides in your city while contributing 
          to the safety of your community.
        </Text>
        <View style={styles.benefitList}>
          {[
            '✅ Drive on your own schedule — full flexibility',
            '✅ Earn competitive fares set through a transparent bidding system',
            '✅ Receive 95% of every fare you complete (platform retains only 5%)',
            '✅ Build a verified professional profile with ratings and reviews',
            '✅ Access ride history and earnings reports through your profile',
            '✅ Enjoy a safe work environment — all passengers are verified women',
          ].map((benefit, index) => (
            <Text key={index} style={styles.benefitItem}>{benefit}</Text>
          ))}
        </View>
      </View>

      {/* Safety Features */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🛡️ Safety Features</Text>
        <Text style={styles.bodyText}>
          Safety is not a feature at SheDrive — it is the foundation. Every aspect of our platform 
          has been designed with your security in mind:
        </Text>
        <View style={styles.featureGrid}>
          {[
            { icon: '🚨', title: 'SOS Emergency Button', desc: 'One-tap emergency alert with GPS location shared instantly' },
            { icon: '📍', title: 'Live GPS Tracking', desc: 'Real-time tracking visible to passengers throughout the journey' },
            { icon: '📞', title: 'Emergency Hotline', desc: '24/7 SheDrive safety helpline: +92 42 111 743 374' },
            { icon: '🪪', title: 'CNIC Verification', desc: 'All drivers and passengers verified with original CNIC documents' },
            { icon: '📷', title: 'Live Selfie Check', desc: 'Drivers submit live selfies to confirm identity before approval' },
            { icon: '⭐', title: 'Community Ratings', desc: 'Every ride includes mutual rating — maintaining accountability' },
          ].map(({ icon, title, desc }) => (
            <View key={title} style={styles.featureCard}>
              <Text style={styles.featureCardIcon}>{icon}</Text>
              <Text style={styles.featureCardTitle}>{title}</Text>
              <Text style={styles.featureCardDesc}>{desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Driver Verification Process */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>✅ Driver Verification Process</Text>
        <Text style={styles.bodyText}>
          No driver is allowed to go online on SheDrive without passing our strict multi-step verification 
          process. This ensures only trusted, qualified female drivers join our fleet:
        </Text>
        {[
          'Submit a Pakistani National Identity Card (CNIC) — front and back',
          'Provide valid Driving License — front and back',
          'Submit a live verification selfie for facial identity matching',
          'Register your vehicle with make, model, year, license plate, and color',
          'SheDrive Admin reviews all documents within 24–72 hours',
          'Once approved, driver account is activated and can start accepting rides',
        ].map((step, index) => (
          <View key={index} style={styles.verificationStep}>
            <Text style={styles.verificationNumber}>{index + 1}</Text>
            <Text style={styles.verificationText}>{step}</Text>
          </View>
        ))}
      </View>

      {/* Mission & Vision */}
      <View style={[styles.section, styles.missionSection]}>
        <Text style={styles.sectionTitle}>🎯 Our Mission & Vision</Text>
        <View style={styles.missionCard}>
          <Text style={styles.missionLabel}>OUR MISSION</Text>
          <Text style={styles.missionText}>
            "To provide every woman in Pakistan with safe, dignified, and affordable transportation — 
            empowering passengers to travel freely and drivers to earn independently, one ride at a time."
          </Text>
        </View>
        <View style={[styles.missionCard, styles.visionCard]}>
          <Text style={styles.missionLabel}>OUR VISION</Text>
          <Text style={styles.missionText}>
            "To become the most trusted women-only transportation platform in South Asia — building a 
            future where no woman is ever afraid to step outside because of transportation insecurity."
          </Text>
        </View>
      </View>

      {/* Customer Support */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📞 Customer Support</Text>
        <Text style={styles.bodyText}>
          Our dedicated support team is available to help passengers and drivers with any concerns, 
          complaints, or feedback.
        </Text>
        <View style={styles.contactCard}>
          <TouchableOpacity onPress={handlePhonePress} activeOpacity={0.7}>
            <Text style={styles.contactRow}>📞 Helpline: {CONTACT_INFO.emergencyHotline}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleEmailPress} activeOpacity={0.7}>
            <Text style={styles.contactRow}>📧 Email: {CONTACT_INFO.supportEmail}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Linking.openURL(CONTACT_INFO.websiteUrl).catch(() => {
                Alert.alert('Error', 'Unable to open official website.');
              });
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.contactRow, { color: Colors.light.primary, fontWeight: '700' }]}>
              🌐 Official Website: {CONTACT_INFO.websiteUrl}
            </Text>
          </TouchableOpacity>
          <Text style={styles.contactRow}>🕐 Hours: Mon–Sat, 9:00 AM – 9:00 PM PKT</Text>
          <Text style={styles.contactRow}>📍 Office: {CONTACT_INFO.officeAddress}</Text>
          <Text style={styles.contactRow}>🚨 Emergency SOS: Available 24/7 in-app</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backBtnText}>← Back to Settings</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { paddingBottom: 40 },
  hero: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: Colors.light.primary,
  },
  heroIcon: { fontSize: 56, marginBottom: 12 },
  heroTitle: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 8, textAlign: 'center' },
  heroSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.88)', textAlign: 'center', marginBottom: 16 },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  heroBadgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  section: {
    backgroundColor: Colors.light.surface,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.light.divider,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 16,
  },
  bodyText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    lineHeight: 24,
    marginBottom: 14,
  },
  stepList: { gap: 16 },
  step: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  stepBadgeText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: '700', color: Colors.light.text, marginBottom: 4 },
  stepDesc: { fontSize: 14, color: Colors.light.textSecondary, lineHeight: 21 },
  benefitList: { gap: 10 },
  benefitItem: { fontSize: 14, color: Colors.light.textSecondary, lineHeight: 22 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  featureCard: {
    width: '47%',
    backgroundColor: Colors.light.primaryGhost,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  featureCardIcon: { fontSize: 24 },
  featureCardTitle: { fontSize: 13, fontWeight: '700', color: Colors.light.text },
  featureCardDesc: { fontSize: 12, color: Colors.light.textSecondary, lineHeight: 18 },
  verificationStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 12,
  },
  verificationNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.primaryGhost,
    textAlign: 'center',
    lineHeight: 28,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.primary,
    flexShrink: 0,
  },
  verificationText: { flex: 1, fontSize: 14, color: Colors.light.textSecondary, lineHeight: 22, paddingTop: 3 },
  missionSection: {},
  missionCard: {
    backgroundColor: Colors.light.primaryGhost,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  visionCard: {
    backgroundColor: '#FFF3E0',
    marginBottom: 0,
  },
  missionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.light.primary,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  missionText: {
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  contactCard: {
    backgroundColor: Colors.light.primaryGhost,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  contactRow: { fontSize: 14, color: Colors.light.text, fontWeight: '500' },
  backBtn: {
    margin: 20,
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.primary,
  },
  backBtnText: { color: Colors.light.primary, fontWeight: '700', fontSize: 15 },
});
