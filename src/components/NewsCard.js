import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { Card } from '../ui';
import { useNavigation } from '@react-navigation/native';

export const NewsCard = ({ item }) => {
  const { theme } = useTheme();
  const navigation = useNavigation();

  const date = item.skapadAt?.toDate
    ? item.skapadAt.toDate().toLocaleDateString('sv-SE')
    : '';

  const isNyLekplats = item.typ === 'ny_lekplats';

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.cardBg, borderColor: theme.colors.border }]}>
      {/* Badge */}
      <View style={[styles.badge, { backgroundColor: isNyLekplats ? theme.colors.primary : theme.colors.accent }]}>
        <Ionicons
          name={isNyLekplats ? 'location' : 'megaphone'}
          size={12}
          color="#fff"
          style={{ marginRight: 4 }}
        />
        <Text style={styles.badgeText}>{isNyLekplats ? 'Ny lekplats' : 'Nyhet'}</Text>
      </View>

      {/* Titel */}
      <Text style={[styles.titel, { color: theme.colors.text }]}>{item.titel}</Text>

      {/* Innehåll */}
      {!!item.innehall && (
        <Text style={[styles.innehall, { color: theme.colors.textMuted }]} numberOfLines={4}>
          {item.innehall}
        </Text>
      )}

      {/* Bild */}
      {!!item.bildUrl && (
        <Image
          source={{ uri: item.bildUrl }}
          style={[styles.bild, { backgroundColor: theme.colors.bgSoft }]}
          resizeMode="cover"
        />
      )}

      {/* Footer */}
      <View style={styles.footer}>
        {date ? (
          <Text style={[styles.datum, { color: theme.colors.textMuted }]}>{date}</Text>
        ) : (
          <View />
        )}
        {!!item.lekplatsId && (
          <TouchableOpacity
            onPress={() => navigation.navigate('PlaygroundDetails', { id: item.lekplatsId })}
            activeOpacity={0.7}
            style={[styles.lekplatsBtn, { backgroundColor: theme.colors.primarySoft }]}
          >
            <Ionicons name="arrow-forward" size={14} color={theme.colors.primary} style={{ marginRight: 4 }} />
            <Text style={[styles.lekplatsBtnText, { color: theme.colors.primary }]}>Visa lekplats</Text>
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    borderWidth: 1,
    borderRadius: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  titel: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  innehall: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  bild: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 10,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  datum: {
    fontSize: 12,
  },
  lekplatsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  lekplatsBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

export default NewsCard;
