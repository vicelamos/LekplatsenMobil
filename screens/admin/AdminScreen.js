import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../src/theme';
import { Card } from '../../src/ui';

const MENU_ITEMS = [
  {
    key: 'news',
    label: 'Hantera nyheter',
    description: 'Skapa och publicera nyheter i flödet',
    icon: 'megaphone-outline',
    screen: 'ManageNews',
  },
  {
    key: 'sponsors',
    label: 'Hantera sponsorer',
    description: 'Lägg till och koppla sponsorer till lekplatser',
    icon: 'ribbon-outline',
    screen: 'ManageSponsors',
  },
  {
    key: 'drafts',
    label: 'Granska förslag',
    description: 'Granska och godkänn inkomna lekplatsförslag',
    icon: 'shield-checkmark-outline',
    screen: 'ReviewDrafts',
  },
  {
    key: 'addPlayground',
    label: 'Lägg till lekplats',
    description: 'Lägg till en ny lekplats i databasen',
    icon: 'add-circle-outline',
    screen: 'AddPlayground',
  },
];

export default function AdminScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const styles = getStyles(theme);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
          <Ionicons name="shield" size={32} color={theme.colors.primary} style={{ marginBottom: 6 }} />
          <Text style={styles.title}>Administration</Text>
          <Text style={styles.subtitle}>Hantera innehåll och inställningar</Text>
        </View>

        <Card style={styles.menuCard}>
          {MENU_ITEMS.map((item, index) => (
            <React.Fragment key={item.key}>
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => navigation.navigate(item.screen)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, { backgroundColor: theme.colors.primarySoft }]}>
                  <Ionicons name={item.icon} size={22} color={theme.colors.primary} />
                </View>
                <View style={styles.menuTextContainer}>
                  <Text style={[styles.menuLabel, { color: theme.colors.text }]}>{item.label}</Text>
                  <Text style={[styles.menuDescription, { color: theme.colors.textMuted }]}>{item.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
              {index < MENU_ITEMS.length - 1 && (
                <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
              )}
            </React.Fragment>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    header: {
      alignItems: 'center',
      paddingTop: theme.space.xl,
      paddingBottom: theme.space.lg,
      paddingHorizontal: theme.space.lg,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.textMuted,
      marginTop: 4,
    },
    menuCard: {
      marginHorizontal: theme.space.lg,
      padding: 0,
      overflow: 'hidden',
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 16,
      gap: 14,
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    menuTextContainer: {
      flex: 1,
    },
    menuLabel: {
      fontSize: 16,
      fontWeight: '700',
    },
    menuDescription: {
      fontSize: 13,
      marginTop: 2,
    },
    separator: {
      height: 1,
      marginLeft: 74,
    },
  });
