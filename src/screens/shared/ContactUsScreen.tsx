import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import Colors from '../../constants/Colors';
import { CONTACT_INFO, SOCIAL_LINKS } from '../../config/contactConfig';

interface SocialLink {
  name: string;
  icon: string;
  url: string;
  color: string;
}

export default function ContactUsScreen(): React.JSX.Element {
  const handleEmailPress = () => {
    Linking.openURL(`mailto:${CONTACT_INFO.supportEmail}`).catch(() => {
      Alert.alert('Error', 'Unable to open email client');
    });
  };

  const handlePhonePress = () => {
    Linking.openURL(`tel:${CONTACT_INFO.supportPhone}`).catch(() => {
      Alert.alert('Error', 'Unable to make phone call');
    });
  };

  const handleSocialPress = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open link');
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Text style={styles.headerIcon}>📞</Text>
        </View>
        <Text style={styles.headerTitle}>Contact Us</Text>
        <Text style={styles.headerSubtitle}>We're here to help you</Text>
      </View>

      {/* Contact Information */}
      <View style={styles.card}>
        <Text style={styles.cardHeaderTitle}>Get in Touch</Text>

        <TouchableOpacity
          style={styles.contactItem}
          onPress={handleEmailPress}
          activeOpacity={0.7}
        >
          <View style={styles.contactIcon}>
            <Text style={styles.contactIconText}>📧</Text>
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactLabel}>Email Support</Text>
            <Text style={styles.contactValue}>{CONTACT_INFO.supportEmail}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.contactItem}
          onPress={handlePhonePress}
          activeOpacity={0.7}
        >
          <View style={styles.contactIcon}>
            <Text style={styles.contactIconText}>📱</Text>
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactLabel}>Phone Support</Text>
            <Text style={styles.contactValue}>{CONTACT_INFO.supportPhone}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <View style={styles.contactItem}>
          <View style={styles.contactIcon}>
            <Text style={styles.contactIconText}>🏢</Text>
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactLabel}>Office Address</Text>
            <Text style={styles.contactValue}>{CONTACT_INFO.officeAddress}</Text>
          </View>
        </View>
      </View>

      {/* Office Hours */}
      <View style={styles.card}>
        <Text style={styles.cardHeaderTitle}>Office Hours</Text>

        <View style={styles.hoursItem}>
          <Text style={styles.hoursDay}>Monday - Friday</Text>
          <Text style={styles.hoursTime}>{CONTACT_INFO.officeHours.weekdays}</Text>
        </View>
        <View style={styles.hoursItem}>
          <Text style={styles.hoursDay}>Saturday</Text>
          <Text style={styles.hoursTime}>{CONTACT_INFO.officeHours.saturday}</Text>
        </View>
        <View style={styles.hoursItem}>
          <Text style={styles.hoursDay}>Sunday</Text>
          <Text style={[styles.hoursTime, styles.hoursClosed]}>{CONTACT_INFO.officeHours.sunday}</Text>
        </View>
      </View>

      {/* Social Media */}
      <View style={styles.card}>
        <Text style={styles.cardHeaderTitle}>Follow Us</Text>

        <View style={styles.socialGrid}>
          {SOCIAL_LINKS.map((social) => (
            <TouchableOpacity
              key={social.name}
              style={[styles.socialItem, { borderColor: social.color }]}
              onPress={() => handleSocialPress(social.url)}
              activeOpacity={0.7}
            >
              <Text style={styles.socialIcon}>{social.icon}</Text>
              <Text style={styles.socialName}>{social.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Response Time Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>⏱️ Response Time</Text>
        <Text style={styles.infoText}>
          • Email: {CONTACT_INFO.responseTimes.email}
        </Text>
        <Text style={styles.infoText}>
          • Phone: {CONTACT_INFO.responseTimes.phone}
        </Text>
        <Text style={styles.infoText}>
          • Social Media: {CONTACT_INFO.responseTimes.socialMedia}
        </Text>
      </View>

      {/* Emergency Notice */}
      <View style={styles.emergencyCard}>
        <Text style={styles.emergencyTitle}>🚨 Emergency?</Text>
        <Text style={styles.emergencyText}>
          For urgent safety concerns during a ride, use the emergency button in the app or call emergency services (15 in Pakistan).
        </Text>
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
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.light.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  contactIconText: {
    fontSize: 20,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.text,
  },
  chevron: {
    fontSize: 22,
    color: Colors.light.textTertiary,
  },
  hoursItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  hoursDay: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  hoursTime: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  hoursClosed: {
    color: Colors.light.error,
  },
  socialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  socialItem: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: Colors.light.background,
    borderWidth: 2,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  socialIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  socialName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.text,
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
  emergencyCard: {
    backgroundColor: Colors.light.errorLight,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.error,
  },
  emergencyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.error,
    marginBottom: 8,
  },
  emergencyText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
});
