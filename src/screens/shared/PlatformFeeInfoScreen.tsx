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

export default function PlatformFeeInfoScreen(): React.JSX.Element {
  const navigation = useNavigation();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroIcon}>💰</Text>
        <Text style={styles.heroTitle}>5% Platform Fee</Text>
        <Text style={styles.heroSubtitle}>SheDrive Driver Partner Agreement</Text>
        <Text style={styles.heroDate}>Last Updated: July 2026 | Version 1.0</Text>
      </View>

      <Section title="What is the 5% Platform Fee?">
        <Clause text="The 5% platform fee is a small commission charged to driver partners on their total completed ride earnings. This fee enables SheDrive to maintain and improve the platform, ensuring a safe and reliable service for both drivers and passengers." />
        <Clause text="For every PKR 100 you earn from completed rides, PKR 5 goes to the platform as the service fee, and you keep PKR 95. This transparent pricing model ensures drivers retain the majority of their earnings while supporting platform operations." />
      </Section>

      <Section title="Who Does This Fee Apply To?">
        <Clause text="The 5% platform fee applies exclusively to driver partners (female drivers registered on the SheDrive platform). Passengers do not pay any platform fee — they only pay the agreed fare for their ride." />
        <Clause text="All driver partners, regardless of vehicle category or ride volume, are subject to the same 5% commission rate. There are no hidden fees, tiered rates, or additional charges." />
      </Section>

      <Section title="When and How is the Fee Calculated?">
        <Clause text="The platform fee is calculated on the total fare of each completed ride. The calculation is simple:" />
        <View style={styles.exampleBox}>
          <Text style={styles.exampleTitle}>Example Calculation</Text>
          <Text style={styles.exampleText}>Ride Fare: PKR 500</Text>
          <Text style={styles.exampleText}>Platform Fee (5%): PKR 25</Text>
          <Text style={styles.exampleText}>Driver Earnings: PKR 475</Text>
        </View>
        <Clause text="The fee is automatically deducted from your earnings before the amount is credited to your account. You can view your total earnings and platform fee deductions in your monthly payment summary." />
      </Section>

      <Section title="What is the Fee Used For?">
        <Clause text="The platform fee is reinvested into maintaining and improving SheDrive's services. Key areas include:" />
        <BulletList items={[
          'Technology development and app maintenance',
          'GPS tracking and routing infrastructure',
          'Customer support and driver assistance',
          'Safety features and emergency response systems',
          'Marketing and user acquisition',
          'Payment processing and financial operations',
          'Legal compliance and regulatory requirements',
        ]} />
      </Section>

      <Section title="How is the Fee Reflected in Your Earnings?">
        <Clause text="Your driver dashboard displays two key figures:" />
        <BulletList items={[
          'Gross Earnings: Total fare collected from passengers',
          'Net Earnings: Gross Earnings minus 5% platform fee',
        ]} />
        <Clause text="Your monthly payment statement provides a detailed breakdown of all completed rides, fares collected, platform fees deducted, and your final payout amount. This ensures complete transparency in your earnings." />
      </Section>

      <Section title="Transparency and Acknowledgment">
        <Clause text="By accepting the 5% platform fee agreement during registration, you acknowledge that:" />
        <BulletList items={[
          'You understand the 5% commission structure',
          'You agree to the automatic deduction of the fee from your earnings',
          'You will receive detailed monthly payment statements',
          'The fee rate is subject to change with 30-day prior notice',
          'You can review your earnings and fee deductions at any time through the driver dashboard',
        ]} />
        <Clause text="SheDrive is committed to maintaining transparency in all financial matters. If you have questions about your earnings or the platform fee, please contact our support team." />
      </Section>

      <Section title="Fee Rate Changes">
        <Clause text="SheDrive reserves the right to adjust the platform fee rate with 30 days prior written notice to all driver partners. Any change to the fee rate will be communicated via:" />
        <BulletList items={[
          'In-app notification',
          'Email to your registered email address',
          'SMS to your registered phone number',
        ]} />
        <Clause text="Drivers will have the opportunity to review and accept any new fee rate before it becomes effective. If you do not agree to the new rate, you may choose to deactivate your driver account." />
      </Section>

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backBtnText}>← Back to Registration</Text>
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
  exampleBox: {
    backgroundColor: Colors.light.primaryGhost,
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.primary,
  },
  exampleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.primaryDark,
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 14,
    color: Colors.light.text,
    marginBottom: 4,
    fontWeight: '600',
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
