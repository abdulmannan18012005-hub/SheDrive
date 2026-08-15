import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Colors from '../../constants/Colors';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const FAQS: FAQ[] = [
  {
    id: '1',
    category: 'Getting Started',
    question: 'How do I register as a passenger?',
    answer: 'Download the SheDrive app, tap "Sign Up", enter your details, and complete the verification process. Once verified, you can start booking rides.',
  },
  {
    id: '2',
    category: 'Getting Started',
    question: 'How do I register as a driver?',
    answer: 'Download the app, select "Register as Driver", fill in your personal information, vehicle details, and upload required documents (CNIC, driving license, vehicle registration). Our team will review and approve your application.',
  },
  {
    id: '3',
    category: 'Booking Rides',
    question: 'How do I book a ride?',
    answer: 'Enter your pickup and destination locations on the home screen, select your preferred vehicle type, and confirm your booking. You\'ll be matched with a nearby driver.',
  },
  {
    id: '4',
    category: 'Booking Rides',
    question: 'Can I schedule a ride in advance?',
    answer: 'Currently, SheDrive offers on-demand rides only. You can book a ride whenever you need one, and we\'ll match you with the nearest available driver.',
  },
  {
    id: '5',
    category: 'Payments',
    question: 'What payment methods are available?',
    answer: 'We accept cash payments directly to the driver. We are working on adding digital payment options including credit/debit cards and mobile wallets in the future.',
  },
  {
    id: '6',
    category: 'Payments',
    question: 'How is the fare calculated?',
    answer: 'Fares are calculated based on distance, time, and vehicle type. You\'ll see an estimated fare before confirming your booking. The final fare may vary slightly based on actual route and traffic.',
  },
  {
    id: '7',
    category: 'Safety',
    question: 'How does SheDrive ensure passenger safety?',
    answer: 'All drivers undergo thorough background checks and verification. We provide real-time ride tracking, share your trip details with emergency contacts, and have an in-app emergency button for immediate assistance.',
  },
  {
    id: '8',
    category: 'Safety',
    question: 'What should I do if I feel unsafe during a ride?',
    answer: 'Use the emergency button in the app to contact our support team immediately. You can also share your live location with trusted contacts. If in immediate danger, call emergency services (15 in Pakistan).',
  },
  {
    id: '9',
    category: 'Driver',
    question: 'How do I become a verified driver?',
    answer: 'Complete your registration with accurate information, upload clear photos of your documents, and maintain a good rating. Our team reviews all applications within 24-48 hours.',
  },
  {
    id: '10',
    category: 'Driver',
    question: 'What are the requirements to be a SheDrive driver?',
    answer: 'You must be a female driver with a valid driving license, own or have access to a registered vehicle, and pass our background verification process. Female passengers only - this is our core safety feature.',
  },
  {
    id: '11',
    category: 'Account',
    question: 'How do I change my phone number?',
    answer: 'Go to Profile > Edit Profile to update your phone number. You may need to verify the new number via OTP.',
  },
  {
    id: '12',
    category: 'Account',
    question: 'Can I delete my account?',
    answer: 'Yes, go to Settings > Delete Account. Please note that account deletion is permanent and cannot be undone. Your data will be permanently deleted within 30 days.',
  },
];

const CATEGORIES = ['All', ...Array.from(new Set(FAQS.map(faq => faq.category)))];

export default function HelpSupportScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const [selectedCategory, setSelectedCategory] = React.useState('All');
  const [expandedFAQ, setExpandedFAQ] = React.useState<string | null>(null);

  const filteredFAQs = selectedCategory === 'All' 
    ? FAQS 
    : FAQS.filter(faq => faq.category === selectedCategory);

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const handleContactSupport = () => {
    (navigation as any).navigate('ContactUs');
  };

  const handleReportProblem = () => {
    (navigation as any).navigate('ReportProblem');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Text style={styles.headerIcon}>❓</Text>
        </View>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <Text style={styles.headerSubtitle}>Find answers to common questions</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsContainer}>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={handleContactSupport}
          activeOpacity={0.7}
        >
          <View style={styles.quickActionIcon}>
            <Text style={styles.quickActionIconText}>📧</Text>
          </View>
          <Text style={styles.quickActionText}>Contact Us</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={handleReportProblem}
          activeOpacity={0.7}
        >
          <View style={styles.quickActionIcon}>
            <Text style={styles.quickActionIconText}>🐛</Text>
          </View>
          <Text style={styles.quickActionText}>Report Problem</Text>
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      <View style={styles.categoryContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryChip,
                selectedCategory === category && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(category)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === category && styles.categoryChipTextActive,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* FAQ List */}
      <View style={styles.card}>
        <Text style={styles.cardHeaderTitle}>Frequently Asked Questions</Text>

        {filteredFAQs.map((faq) => (
          <View key={faq.id} style={styles.faqItem}>
            <TouchableOpacity
              style={styles.faqQuestion}
              onPress={() => toggleFAQ(faq.id)}
              activeOpacity={0.7}
            >
              <View style={styles.faqQuestionLeft}>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{faq.category}</Text>
                </View>
                <Text style={styles.faqQuestionText}>{faq.question}</Text>
              </View>
              <Text style={[styles.chevron, expandedFAQ === faq.id && styles.chevronRotated]}>
                {expandedFAQ === faq.id ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>
            {expandedFAQ === faq.id && (
              <View style={styles.faqAnswer}>
                <Text style={styles.faqAnswerText}>{faq.answer}</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Additional Help */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Still need help?</Text>
        <Text style={styles.infoText}>
          If you couldn't find the answer to your question, please contact our support team. We're here to help you 24/7.
        </Text>
        <TouchableOpacity
          style={styles.contactButton}
          onPress={handleContactSupport}
          activeOpacity={0.7}
        >
          <Text style={styles.contactButtonText}>Contact Support Team</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  quickActionButton: {
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.light.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
  },
  quickActionIconText: {
    fontSize: 24,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
  },
  categoryContainer: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  categoryScroll: {
    flexDirection: 'row',
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  card: {
    backgroundColor: Colors.light.surface,
    marginTop: 16,
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
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 14,
  },
  faqQuestionLeft: {
    flex: 1,
    marginRight: 12,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.light.primaryGhost,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.primary,
    textTransform: 'uppercase',
  },
  faqQuestionText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
    lineHeight: 20,
  },
  chevron: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  chevronRotated: {
    transform: [{ rotate: '90deg' }],
  },
  faqAnswer: {
    paddingVertical: 12,
    paddingBottom: 16,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  faqAnswerText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 22,
  },
  infoCard: {
    backgroundColor: Colors.light.primaryGhost,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.primaryDark,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  contactButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
