import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Colors from '../../constants/Colors';

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

export default function UserAgreementScreen(): React.JSX.Element {
  const navigation = useNavigation();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>User Agreement</Text>
        <Text style={styles.heroSubtitle}>SheDrive Platform — Lahore, Pakistan</Text>
        <Text style={styles.heroDate}>Effective Date: July 2026 | Version 1.0</Text>
      </View>

      <Section title="1. Introduction & Acceptance">
        <Clause text="This User Agreement ('Agreement') is a legally binding contract between you ('User') and SheDrive Operations Pvt. Ltd. ('SheDrive', 'we', 'our', or 'us'). By registering, accessing, or using the SheDrive mobile application, website, or any related service, you acknowledge that you have read, understood, and agree to be bound by the terms of this Agreement." />
        <Clause text="If you do not agree to these terms, you must immediately discontinue use of the SheDrive platform. This Agreement applies equally to passengers and driver partners unless specifically stated otherwise." />
      </Section>

      <Section title="2. Eligibility Requirements">
        <Clause text="To use the SheDrive platform, you must meet the following minimum requirements:" />
        <BulletList items={[
          'You must be a female, aged 18 years or older, resident of Pakistan',
          'You must possess a valid Pakistani CNIC (Computerized National Identity Card)',
          'Drivers must hold a valid Pakistani driving license issued by the relevant provincial authority',
          'You must provide accurate, truthful, and current registration information',
          'You must provide accurate registration details including a valid phone number',
          'Providing an email address enables password recovery — without it, lost passwords cannot be reset',
          'You must not have been previously banned or suspended from the SheDrive platform',
        ]} />
      </Section>

      <Section title="3. User Responsibilities (Both Passengers & Drivers)">
        <Clause text="All users of the SheDrive platform are required to:" />
        <BulletList items={[
          'Provide true, accurate, and complete information during registration and thereafter',
          'Keep your account credentials (phone number, password) strictly confidential',
          'Not share your account with any other person',
          'Maintain updated contact information including phone number',
          'Use the platform in full compliance with all applicable Pakistani laws and regulations',
          'Not use the platform for any unlawful, harmful, fraudulent, or abusive purpose',
          'Report safety concerns or violations immediately to SheDrive Support',
          'Treat all other users, drivers, and passengers with respect and dignity',
          'Maintain appropriate hygiene and conduct during rides',
          'Not record audio or video of the other party without mutual consent',
        ]} />
      </Section>

      <Section title="4. Passenger Responsibilities">
        <Clause text="As a SheDrive passenger, you specifically agree to:" />
        <BulletList items={[
          'Only request rides for yourself or on behalf of another verified female user',
          'Be present at your stated pickup location at the confirmed time',
          'Not engage in verbal abuse, harassment, or threatening behavior toward drivers',
          'Pay the agreed fare in full upon completion of the ride',
          'Not consume food, beverages, or any prohibited substances inside the vehicle',
          'Respect the vehicle — you are financially liable for any damage caused',
          'Cancel rides responsibly — repeated unnecessary cancellations may result in suspension',
          'Provide honest ratings and reviews after every completed ride',
        ]} />
      </Section>

      <Section title="5. Driver Partner Responsibilities">
        <Clause text="As a SheDrive driver partner, you specifically agree to:" />
        <BulletList items={[
          'Maintain a valid Pakistani driving license throughout your time on the platform',
          'Keep your vehicle roadworthy, registered, and insured under applicable Pakistani law',
          'Complete all identity and document verification steps before going online',
          'Only go online and accept rides when you are fit, alert, and legally licensed to drive',
          'Follow all traffic laws, road regulations, and traffic signals at all times',
          'Never use a mobile phone while driving — only use hands-free technology',
          'Not accept a ride for a location you cannot physically reach',
          'Not engage in verbal abuse, harassment, discrimination, or any threatening conduct',
          'Maintain vehicle cleanliness and a professional appearance during rides',
          'Provide accurate GPS-guided navigation to the destination',
          'Never ask for the passenger\'s personal contact information outside the app',
        ]} />
      </Section>

      <Section title="6. Acceptable Use & Prohibited Activities">
        <Clause text="The following activities are strictly prohibited on the SheDrive platform. Violation of any of the following may result in immediate account suspension and potential legal action:" />
        <BulletList items={[
          'Registering using forged, altered, or fraudulent identity documents',
          'Sharing your account credentials or vehicle with any unauthorized person',
          'Using the platform to facilitate illegal transportation or criminal activity',
          'Harassing, threatening, or abusing other users in any form',
          'Soliciting or exchanging personal contact information outside the platform',
          'Rating or reviewing another user dishonestly or maliciously',
          'Manipulating the fare bidding system in bad faith',
          'Operating a vehicle under the influence of alcohol or controlled substances',
          'Carrying weapons, contraband, or illegal items during a SheDrive ride',
          'Attempting to reverse engineer, clone, or misuse the SheDrive application',
          'Circumventing SheDrive\'s commission system or making off-platform payments',
        ]} />
      </Section>

      <Section title="7. Payments & Fare Policy">
        <Clause text="SheDrive operates a transparent fare bidding system. The initial fare estimate is calculated based on distance, ride category, and current platform base rates. Passengers and drivers may negotiate the final fare within the app before a ride is confirmed." />
        <Clause text="SheDrive charges a 7% platform commission on every completed ride. This commission covers platform maintenance, safety infrastructure, payment processing, and 24/7 support. Driver partners retain 93% of all fare income." />
        <Clause text="All payments are currently conducted as cash transactions directly between passenger and driver upon ride completion. SheDrive is not responsible for payment disputes arising from off-platform transactions." />
      </Section>

      <Section title="8. Cancellations & No-Shows">
        <Clause text="Both passengers and drivers may cancel a ride before it begins. However, users who repeatedly cancel accepted rides may face temporary restrictions on their account." />
        <Clause text="If a passenger fails to appear at the pickup location within a reasonable time after the driver has arrived and waited, the driver may cancel the ride without penalty. Repeated passenger no-shows may result in a warning or account suspension." />
        <Clause text="Drivers who cancel an accepted ride without sufficient reason or repeatedly fail to show may face account warnings, reduced ride priority, or suspension." />
      </Section>

      <Section title="9. Disputes & Complaint Resolution">
        <Clause text="SheDrive provides an in-app complaint and dispute resolution mechanism. All complaints are reviewed by the SheDrive administration team within 3–7 business days." />
        <Clause text="For urgent safety incidents, please use the SOS emergency button within the app or call the SheDrive Safety Hotline at +92 42 111 743 374 immediately." />
        <Clause text="SheDrive's decision in dispute resolution matters is final, subject to applicable Pakistani consumer protection law. Users dissatisfied with an outcome may appeal the decision in writing to support@shedrive.pk within 14 days." />
      </Section>

      <Section title="10. Account Suspension & Termination">
        <Clause text="SheDrive reserves the right to suspend or permanently terminate any account that:" />
        <BulletList items={[
          'Violates any provision of this User Agreement',
          'Engages in fraudulent, abusive, or dishonest conduct',
          'Receives sustained low ratings indicating poor conduct',
          'Is found to have submitted false or fraudulent identity documents',
          'Has been flagged for safety violations by other users or SheDrive staff',
        ]} />
        <Clause text="Suspended drivers will see their account blocked and will receive notification via SMS and email. Suspended passengers will be restricted from booking rides. Account holders may submit an appeal to support@shedrive.pk." />
      </Section>

      <Section title="11. Legal Responsibilities & Liability">
        <Clause text="SheDrive provides a technology platform connecting passengers and driver partners. SheDrive is not a transportation provider, employer, or agent of any driver. Drivers operate as independent contractors and are solely responsible for compliance with all applicable laws including traffic regulations, vehicle licensing, and taxation." />
        <Clause text="SheDrive's liability to users is limited to the maximum extent permitted under Pakistani law. SheDrive shall not be held liable for personal injury, property damage, or any direct, indirect, consequential, or incidental damages arising from the use of its platform beyond what is required under applicable law." />
        <Clause text="SheDrive strongly recommends that all driver partners maintain adequate vehicle insurance. SheDrive is not liable for uninsured accident damages." />
      </Section>

      <Section title="12. Amendments">
        <Clause text="SheDrive reserves the right to update or amend this Agreement at any time. Users will be notified of material changes via push notification or SMS. Continued use of the platform after notification of changes constitutes acceptance of the revised Agreement." />
      </Section>

      <Section title="13. Governing Law">
        <Clause text="This Agreement is governed by and construed in accordance with the laws of the Islamic Republic of Pakistan. Any disputes arising from this Agreement shall be subject to the jurisdiction of the courts of Lahore, Punjab, Pakistan." />
        <Clause text="For questions about this Agreement, contact us at: support@shedrive.pk or +92 42 111 743 374." />
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
    lineHeight: 24,
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
