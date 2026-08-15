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

export default function TermsAndConditionsScreen(): React.JSX.Element {
  const navigation = useNavigation();

  const handleEmailPress = () => {
    Linking.openURL(`mailto:${CONTACT_INFO.supportEmail}`).catch(() => {
      Alert.alert('Error', 'Unable to open email client');
    });
  };

  const handleLegalEmailPress = () => {
    Linking.openURL(`mailto:${CONTACT_INFO.legalEmail}`).catch(() => {
      Alert.alert('Error', 'Unable to open email client');
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Terms & Conditions</Text>
        <Text style={styles.heroSubtitle}>SheDrive — Lahore, Pakistan</Text>
        <Text style={styles.heroDate}>Last Updated: July 2026 | Version 1.0</Text>
      </View>

      <Section title="1. Eligibility">
        <Clause text="The SheDrive platform is exclusively available to female residents of Pakistan who are 18 years of age or older. All users must possess a valid Pakistani CNIC. Driver partners must additionally hold a valid Pakistani driving license. By creating an account, you confirm that you meet all eligibility requirements." />
        <Clause text="SheDrive reserves the right to verify eligibility at any time and to refuse, suspend, or terminate service to any user who does not comply with eligibility criteria." />
      </Section>

      <Section title="2. Account Registration & Usage">
        <Clause text="Each user is permitted to maintain only one active account on the SheDrive platform. Account sharing, account selling, or creating multiple accounts is prohibited and will result in permanent suspension." />
        <BulletList items={[
          'You are responsible for all activity conducted through your account',
          'You must keep your login credentials secure and confidential',
          `Notify SheDrive immediately at ${CONTACT_INFO.supportEmail} if you suspect unauthorized access`,
          'SheDrive reserves the right to close or restrict accounts that violate these Terms',
          'Accounts inactive for more than 12 months may be deactivated after prior notice',
        ]} />
      </Section>

      <Section title="3. Driver Partner Obligations">
        <Clause text="Driver partners agree to uphold the following obligations while registered with SheDrive:" />
        <BulletList items={[
          'Maintain a valid driving license and registered vehicle at all times',
          'Keep the vehicle in safe, clean, and roadworthy condition for every ride',
          'Only go online when physically fit and capable of safely operating a vehicle',
          'Follow all traffic laws, highway codes, and road safety rules in Pakistan',
          'Accept rides based on vehicle category matching and proximity',
          'Treat all passengers with professionalism, respect, and courtesy',
          'Never charge a fare higher than the agreed and confirmed amount',
          'Complete mandatory document re-verification when requested by SheDrive Admin',
          'Maintain a minimum driver rating of 3.5 stars — accounts falling below this threshold may be suspended for review',
        ]} />
      </Section>

      <Section title="4. Passenger Obligations">
        <Clause text="Passengers using SheDrive agree to the following conduct obligations:" />
        <BulletList items={[
          'Be at the pickup location at the time of booking confirmation',
          'Communicate any pickup or route changes only through the in-app messaging system',
          'Not ask the driver to violate traffic laws or take unapproved alternative routes',
          'Pay the full confirmed fare upon arrival at destination',
          'Leave the vehicle in the same condition in which it was entered',
          'Not make personal contact with drivers outside of the SheDrive platform',
          'Provide honest, fair, and non-retaliatory ratings after rides',
          'Maintain a minimum passenger rating of 3.0 — passengers falling below this may be restricted from bookings',
        ]} />
      </Section>

      <Section title="5. Fare & Payment Terms">
        <Clause text="Fares on SheDrive are dynamically estimated based on distance (km), vehicle category base fare, per-kilometer rate, per-minute rate, and any applicable minimum fare floor. Passengers may negotiate the final fare within the platform's bidding system before confirming a ride." />
        <Clause text="SheDrive applies a 5% platform commission on every completed ride. Drivers are required to submit their monthly platform fee payments through the SheDrive app by the 4th of each month. Payment instructions and transaction tracking are available in the Driver Payments section." />
        <BulletList items={[
          'All fares shown are in Pakistani Rupees (PKR)',
          'Minimum fares apply based on vehicle category',
          'No additional charges beyond the confirmed fare may be demanded by the driver',
          'Drivers with overdue payments may be suspended from going online until payment is verified',
        ]} />
      </Section>

      <Section title="6. Cancellation Policy">
        <Clause text="Ride cancellations are permitted but must be conducted fairly to respect the time of both passengers and drivers." />
        <BulletList items={[
          'Passengers may cancel a ride for free before the driver accepts',
          'Cancellations made after driver acceptance may result in an account warning if repeated frequently',
          'Drivers who cancel frequently without valid reason will be deprioritized in ride matching',
          `In case of emergency cancellations, users should contact ${CONTACT_INFO.supportEmail}`,
        ]} />
      </Section>

      <Section title="7. Ratings & Reviews Policy">
        <Clause text="SheDrive uses a mutual rating system after every completed ride. Both drivers and passengers rate each other on a scale of 1 to 5 stars. Ratings are anonymous and displayed as running averages." />
        <BulletList items={[
          'You must provide honest and factually accurate ratings',
          'Retaliatory, false, or manipulated ratings violate these Terms and may result in suspension',
          `You may report a rating you believe is inaccurate to ${CONTACT_INFO.supportEmail}`,
          'SheDrive Admin may manually remove ratings found to be fraudulent or retaliatory',
          'Sustained low ratings may trigger an automatic safety review of the account',
        ]} />
      </Section>

      <Section title="8. Misconduct & Fraud">
        <Clause text="The following actions constitute misconduct and will result in immediate account suspension and possible legal referral:" />
        <BulletList items={[
          'Submission of forged or altered CNIC or driving license documents',
          'Verbal or physical harassment or assault of any user',
          'Fraudulent manipulation of GPS location or route data',
          'Creating fake accounts to manipulate ratings or gain unfair advantage',
          'Requesting or facilitating rides for commercial, illegal, or prohibited purposes',
          'Threatening, blackmailing, or coercing other users',
          'Any form of gender discrimination, abuse, or exploitation on the platform',
        ]} />
        <Clause text="SheDrive cooperates fully with Pakistani law enforcement in investigation of criminal complaints." />
      </Section>

      <Section title="9. Intellectual Property">
        <Clause text="All intellectual property associated with SheDrive — including the application, brand name, logo, interface design, software architecture, content, and technology — is exclusively owned by SheDrive Operations Pvt. Ltd. and is protected under applicable Pakistani and international intellectual property law." />
        <BulletList items={[
          'Users may not copy, reproduce, distribute, or create derivative works from SheDrive content',
          'The SheDrive brand name and logo may not be used without prior written permission',
          'Unauthorized reverse engineering of the SheDrive application is strictly prohibited',
          'Feedback and suggestions submitted by users become the property of SheDrive',
        ]} />
      </Section>

      <Section title="10. Limitation of Liability">
        <Clause text="SheDrive operates as a technology marketplace connecting passengers with independent driver partners. SheDrive does not employ drivers, own vehicles, or provide transportation services directly." />
        <Clause text="SheDrive's total liability to any user for any claim arising from use of the platform is limited to PKR 10,000 or the amount of the disputed fare, whichever is lower — except where greater liability is required under applicable law. SheDrive is not liable for indirect, incidental, or consequential damages including lost income, personal injury, or property damage, except where such limitation is not permitted under Pakistani consumer protection law." />
      </Section>

      <Section title="11. Account Termination">
        <Clause text={`Either party may terminate the account relationship at any time. Users may delete their account through the app or by contacting ${CONTACT_INFO.supportEmail}. SheDrive may terminate accounts for violations of these Terms with or without prior notice, depending on the severity of the violation.`} />
        <Clause text="Upon termination, any outstanding dues, disputes, or complaints must still be resolved in accordance with these Terms. Ride history and safety logs may be retained for legal compliance purposes." />
      </Section>

      <Section title="12. Governing Law & Jurisdiction">
        <Clause text="These Terms & Conditions are governed exclusively by the laws of the Islamic Republic of Pakistan. Any disputes arising from or related to these Terms shall be submitted to the exclusive jurisdiction of the competent courts of Lahore, Punjab, Pakistan." />
        <Clause text={`For all legal enquiries, contact us at: ${CONTACT_INFO.legalEmail} | SheDrive Operations Pvt. Ltd., Lahore, Punjab, Pakistan.`} />
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
