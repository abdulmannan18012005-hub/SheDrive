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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Clause({ text }: { text: string }) {
  return <Text style={styles.clause}>{text}</Text>;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View style={styles.bulletList}>
      {items.map((item, idx) => (
        <Text key={idx} style={styles.bulletItem}>• {item}</Text>
      ))}
    </View>
  );
}

export default function PrivacyPolicyScreen(): React.JSX.Element {
  const navigation = useNavigation();

  const handlePrivacyEmailPress = () => {
    Linking.openURL(`mailto:${CONTACT_INFO.privacyEmail}`).catch(() => {
      Alert.alert('Error', 'Unable to open email client');
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroIcon}>🔒</Text>
        <Text style={styles.heroTitle}>Privacy Policy</Text>
        <Text style={styles.heroSubtitle}>SheDrive — Lahore, Pakistan</Text>
        <Text style={styles.heroDate}>Last Updated: July 2026 | Version 1.0</Text>
      </View>

      <Section title="1. Introduction">
        <Clause text="SheDrive Operations Pvt. Ltd. ('SheDrive', 'we', 'our', 'us') is committed to protecting the privacy and personal information of all users — passengers and driver partners — on the SheDrive platform. This Privacy Policy explains what data we collect, why we collect it, how it is used, how it is stored, and what rights you have regarding your personal information." />
        <Clause text="By registering and using the SheDrive platform, you consent to the collection, use, and storage of your personal data as described in this Privacy Policy. This policy complies with the Prevention of Electronic Crimes Act, 2016 (PECA) and applicable data protection standards in Pakistan." />
      </Section>

      <Section title="2. Information We Collect">
        <Clause text="SheDrive collects the following categories of information:" />
        <Text style={styles.subHeading}>2.1 Personal Identity Information</Text>
        <BulletList items={[
          'Full legal name (as per CNIC)',
          'Pakistani CNIC number and CNIC front and back images',
          'Pakistani mobile phone number',
          'Email address (if provided)',
          'Date of birth (from CNIC verification)',
          'Profile photograph / verification selfie',
          'For drivers: Driving License number, front and back images, and vehicle registration details',
        ]} />
        <Text style={[styles.subHeading, { marginTop: 12 }]}>2.2 Location Information</Text>
        <BulletList items={[
          'Real-time GPS location during active rides (passengers and drivers)',
          'Pickup and dropoff coordinates for every ride request',
          'Route data and travel history for completed rides',
          'Approximate location when app is backgrounded (drivers only, while online)',
        ]} />
        <Text style={[styles.subHeading, { marginTop: 12 }]}>2.3 Device & Technical Information</Text>
        <BulletList items={[
          'Device type, model, and operating system version',
          'App version and crash logs',
          'Network connection type (Wi-Fi / mobile data)',
          'Push notification token for ride alerts',
          'IP address (logged for security purposes)',
        ]} />
        <Text style={[styles.subHeading, { marginTop: 12 }]}>2.4 Transaction & Ride Information</Text>
        <BulletList items={[
          'Ride history including origin, destination, fare, and status',
          'Ratings and reviews given and received',
          'SOS emergency incident logs',
          'Complaint and dispute records',
          'Driver earnings records',
        ]} />
      </Section>

      <Section title="3. How We Collect Your Data">
        <Clause text="We collect information in the following ways:" />
        <BulletList items={[
          'Directly from you during registration, profile setup, or ride booking',
          'Automatically via the app (GPS, device sensors, app usage logs)',
          'Through your camera when you take verification selfies or upload documents',
          'Via third-party services used in the platform (Cloudinary for image storage, Supabase for database, Firebase for real-time messaging)',
        ]} />
      </Section>

      <Section title="4. Camera & Photo Access">
        <Clause text="SheDrive requests access to your device camera and photo gallery for the following specific purposes:" />
        <BulletList items={[
          'To capture your live verification selfie during driver registration (confirms identity match with CNIC)',
          'To upload CNIC front and back photos during registration',
          'To upload Driving License front and back photos (drivers only)',
          'To upload vehicle photos (drivers only)',
        ]} />
        <Clause text="Camera access is requested only when you explicitly initiate a photo upload action. SheDrive does not capture images in the background or without your knowledge. You can revoke camera permissions at any time through your Android device settings. Note that revoking permissions may restrict your ability to complete document uploads." />
      </Section>

      <Section title="5. CNIC & Document Storage">
        <Clause text="Identity documents (CNIC images, Driving License images, and verification selfies) uploaded through SheDrive are processed and stored as follows:" />
        <BulletList items={[
          'Documents are uploaded to Cloudinary — a secure, encrypted cloud media storage service',
          'Cloudinary stores document images on ISO 27001-certified servers with AES-256 encryption at rest',
          'Document URLs are stored in SheDrive\'s Supabase PostgreSQL database, secured behind authentication',
          'Documents are accessible only to SheDrive Admin for verification purposes',
          'Documents are never shared with third parties or other users',
          'Once verification is completed and the account is approved, raw document images are accessible only to authorized admin staff',
        ]} />
        <Clause text="SheDrive takes CNIC and personal document security extremely seriously. Admin access to documents is logged and audited. Unauthorized internal access to user documents results in termination and potential legal action." />
      </Section>

      <Section title="6. Location Data Usage">
        <Clause text="Location data is central to the SheDrive service. Here is exactly how we use your location:" />
        <BulletList items={[
          'To show your position on the map and identify nearby drivers',
          'To calculate accurate route distances and fare estimates',
          'To track active rides in real time for safety and navigation',
          'To share your location with your matched driver or passenger during an active ride',
          'To enable the SOS emergency feature, which broadcasts your GPS coordinates to our safety team',
          'Drivers: background location is accessed only while you are online on the platform',
        ]} />
        <Clause text="We do not sell, share, or monetize your location data with any third-party advertiser or data broker. Location history is retained for 90 days for dispute resolution and safety purposes, then automatically purged." />
      </Section>

      <Section title="7. How We Store Your Data">
        <Clause text="SheDrive uses the following infrastructure to store your data securely:" />
        <BulletList items={[
          'Supabase PostgreSQL — encrypted relational database hosted on AWS infrastructure (Singapore region)',
          'Cloudinary — encrypted media storage for all document and image uploads',
          'Firebase — used for real-time messaging, ride status updates, and push notifications',
          'All databases are protected behind authenticated API access with JWT token-based authorization',
          'All data transmission between the app and server is encrypted using HTTPS/TLS 1.3',
          'Database backups are conducted automatically and stored for 30 days',
        ]} />
      </Section>

      <Section title="8. Third-Party Services">
        <Clause text="SheDrive integrates the following third-party services to deliver its platform. Each service operates under its own privacy policy:" />
        <BulletList items={[
          'Supabase (database hosting) — supabase.com/privacy',
          'Cloudinary (media storage) — cloudinary.com/privacy',
          'Google Firebase (real-time updates & notifications) — firebase.google.com/support/privacy',
          'OpenStreetMap / CartoDB (map tiles) — openstreetmap.org/privacy',
          'OSRM (routing engine) — project-osrm.org (open source, no personal data shared)',
        ]} />
        <Clause text="We do not share your personal identity information (name, CNIC, phone number, email) with any third party without your explicit consent or a lawful Pakistani court/government order." />
      </Section>

      <Section title="9. Cookies & Tracking">
        <Clause text="The SheDrive mobile application does not use browser cookies. However, the SheDrive Admin Portal (web interface) uses session-based JWT tokens stored in browser localStorage to maintain admin login sessions. These tokens do not track browsing activity outside of the SheDrive admin interface and expire automatically." />
        <Clause text="The app may use anonymous crash reporting and performance monitoring to identify and fix technical issues. These analytics do not include personally identifiable information." />
      </Section>

      <Section title="10. Security Measures">
        <Clause text="SheDrive implements the following security controls to protect your personal data:" />
        <BulletList items={[
          'Bcrypt password hashing — passwords are never stored in plaintext',
          'JWT (JSON Web Token) based API authentication with expiry controls',
          'HTTPS/TLS encryption for all API communications',
          'Role-based access control — only authorized admin can access user documents',
          'Audit logs — all admin actions on user data are recorded and timestamped',
          'AES-256 encryption at rest for database and media storage',
          'Email-based secure password reset via Supabase Auth',
          'CNIC and document verification required for all accounts',
        ]} />
        <Clause text="Despite these measures, no digital system is 100% immune to breaches. In the event of a data breach affecting your personal information, SheDrive will notify affected users via SMS within 72 hours of discovery." />
      </Section>

      <Section title="11. Your Rights">
        <Clause text="As a SheDrive user, you have the following rights regarding your personal data:" />
        <BulletList items={[
          'Right to Access — Request a copy of all personal data held about you',
          'Right to Correction — Request correction of any inaccurate personal data',
          'Right to Deletion — Request deletion of your account and associated personal data',
          'Right to Restriction — Request that we stop processing your data for certain purposes',
          'Right to Portability — Request your ride history data in a portable format (CSV/JSON)',
          'Right to Withdraw Consent — Withdraw consent for data processing at any time',
          'Right to Lodge a Complaint — Contact the Pakistan Telecommunication Authority (PTA) for regulatory complaints',
        ]} />
        <Clause text={`To exercise any of these rights, email us at: ${CONTACT_INFO.privacyEmail} with your registered mobile number and request details. We will respond within 14 business days.`} />
      </Section>

      <Section title="12. Data Deletion Policy">
        <Clause text="If you request account deletion:" />
        <BulletList items={[
          'Your account will be deactivated immediately upon request',
          'Personal identity data (name, phone, email) will be anonymized within 30 days',
          'CNIC and document images will be permanently deleted from Cloudinary within 30 days',
          'Ride history anonymized — origin/destination coordinates replaced with approximate zones',
          'Safety incident logs and audit records may be retained for up to 2 years for legal compliance',
          'Financial transaction records may be retained for 5 years as required by Pakistani tax law',
        ]} />
        <Clause text={`To request account deletion, go to Settings → Account → Delete Account in the app, or email ${CONTACT_INFO.privacyEmail}.`} />
      </Section>

      <Section title="13. Children's Privacy">
        <Clause text="SheDrive does not knowingly collect personal data from individuals under 18 years of age. The platform is restricted to adult women only. If we become aware that a user under 18 has registered, the account will be immediately suspended and associated data deleted." />
      </Section>

      <Section title="14. Changes to This Policy">
        <Clause text="SheDrive may update this Privacy Policy from time to time. When we make material changes, we will notify users via in-app push notification and SMS. The updated policy will be published in the app under Settings → Privacy Policy. Your continued use of SheDrive after notification of changes constitutes acceptance of the revised Privacy Policy." />
      </Section>

      <Section title="15. Contact Us">
        <Clause text="For any questions, concerns, or requests related to this Privacy Policy or your personal data, please contact SheDrive's Data Protection Officer:" />
        <View style={styles.contactCard}>
          <TouchableOpacity onPress={handlePrivacyEmailPress} activeOpacity={0.7}>
            <Text style={styles.contactRow}>📧 Privacy Officer: {CONTACT_INFO.privacyEmail}</Text>
          </TouchableOpacity>
          <Text style={styles.contactRow}>📞 Helpline: {CONTACT_INFO.emergencyHotline}</Text>
          <Text style={styles.contactRow}>📍 SheDrive Operations Pvt. Ltd., {CONTACT_INFO.officeAddress}</Text>
          <Text style={styles.contactRow}>🕐 Response Time: {CONTACT_INFO.responseTimes.legal}</Text>
        </View>
      </Section>

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
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  heroIcon: { fontSize: 42, marginBottom: 8 },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 6, textAlign: 'center' },
  heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginBottom: 6, textAlign: 'center' },
  heroDate: { fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  section: {
    backgroundColor: Colors.light.surface,
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.light.divider,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.primary,
    marginBottom: 12,
  },
  subHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
    marginTop: 4,
  },
  clause: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletList: { gap: 8, marginTop: 4, marginBottom: 4 },
  bulletItem: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 22,
    paddingLeft: 4,
  },
  contactCard: {
    backgroundColor: Colors.light.primaryGhost,
    borderRadius: 12,
    padding: 16,
    gap: 10,
    marginTop: 8,
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
