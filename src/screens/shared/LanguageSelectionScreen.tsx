import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Colors from '../../constants/Colors';

export default function LanguageSelectionScreen(): React.JSX.Element {
  const navigation = useNavigation();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Text style={styles.headerIcon}>🌐</Text>
        </View>
        <Text style={styles.headerTitle}>System Language</Text>
        <Text style={styles.headerSubtitle}>
          SheDrive is currently configured to operate in English.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Active Language</Text>
        <View style={styles.languageRowActive}>
          <View style={styles.languageLeft}>
            <Text style={styles.flag}>🇬🇧</Text>
            <View>
              <Text style={styles.languageName}>English (Official)</Text>
              <Text style={styles.languageSub}>Primary App &amp; System Language</Text>
            </View>
          </View>
          <View style={styles.checkBadge}>
            <Text style={styles.checkText}>✓ Active</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Text style={styles.backBtnText}>Return to Settings</Text>
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
    paddingVertical: 28,
    paddingHorizontal: 20,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.light.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
  },
  headerIcon: { fontSize: 32 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.light.text, marginBottom: 4 },
  headerSubtitle: { fontSize: 13, color: Colors.light.textSecondary, textAlign: 'center', lineHeight: 18 },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 20,
    margin: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Colors.light.text, marginBottom: 14 },
  languageRowActive: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: Colors.light.primaryGhost,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    marginBottom: 20,
  },
  languageLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flag: { fontSize: 28 },
  languageName: { fontSize: 16, fontWeight: '800', color: Colors.light.text },
  languageSub: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },
  checkBadge: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  checkText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  backBtn: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  backBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
