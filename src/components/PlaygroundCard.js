import React, { memo, useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ImageBackground, StyleSheet, Modal, Image, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { parsePosition, calculateDistance, formatDistance } from '../../utils/geo';
import { trackSponsorEvent } from '../../utils/sponsorAnalytics';

const FALLBACK_IMG =
  'https://firebasestorage.googleapis.com/v0/b/lekplatsen-907fb.firebasestorage.app/o/bild%20saknas.png?alt=media&token=3acbfa69-dea8-456b-bbe2-dd95034f773f';

/**
 * Delat lekplatskort som används i söklistan och "Lekplatser nära dig".
 * Kontrollera storleken via `style`-prop (t.ex. { flex: 0.5, height: 200 }).
 */
const PlaygroundCard = memo(({ item, userLocation, style }) => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [sponsorModalVisible, setSponsorModalVisible] = useState(false);

  const imageUrl = item.resolvedImageUrl || item.bildUrl || item.imageUrl || FALLBACK_IMG;

  const distance = useMemo(() => {
    if (!userLocation || !item.position) return null;
    const pos = parsePosition(item.position);
    if (!pos) return null;
    return formatDistance(calculateDistance(userLocation, pos));
  }, [userLocation, item.position]);

  const onPress = () => {
    const payload = {
      id: item.id,
      name: item.namn || item.name || 'Lekplats',
      address: item.adress || item.address || '',
      description: item.beskrivning || item.description || '',
      imageUrl,
      equipment: item.utrustning || item.equipment || [],
      location: item.position ? parsePosition(item.position) : null,
    };
    const parent = navigation.getParent?.();
    (parent || navigation).navigate('PlaygroundDetails', { playground: payload, id: payload.id });
  };

  const isGoldSponsor = item.sponsorship?.active && item.sponsorship?.level === 'guld';
  const sponsor = item.sponsorData;

  // Spåra badge-visning
  useEffect(() => {
    if (isGoldSponsor && sponsor?.id) {
      trackSponsorEvent(sponsor.id, 'badgeImpressions');
    }
  }, [isGoldSponsor, sponsor?.id]);

  return (
    <>
      <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.card, style]}>
        <ImageBackground source={{ uri: imageUrl }} style={{ flex: 1 }}>
          <View style={styles.overlay} />

          {/* Sponsor-badge uppe till vänster */}
          {isGoldSponsor && (
            <TouchableOpacity
              style={styles.sponsorBadge}
              onPress={(e) => { e.stopPropagation?.(); setSponsorModalVisible(true); trackSponsorEvent(sponsor?.id, 'popupOpens'); }}
              activeOpacity={0.8}
            >
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.sponsorBadgeText}>{item.sponsorName || 'Sponsor'}</Text>
            </TouchableOpacity>
          )}

          {/* Betyg uppe till höger */}
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={12} color={theme.colors.star} />
            <Text style={styles.ratingText}>{(item.snittbetyg || 0).toFixed(1)}</Text>
          </View>

          {/* Namn och adress nere till vänster */}
          <View style={styles.textContent}>
            <Text style={styles.title} numberOfLines={1}>{item.namn || 'Lekplats'}</Text>
            {!!item.adress && <Text style={styles.subtitle} numberOfLines={1}>{item.adress}</Text>}
            {distance && (
              <View style={[styles.distanceBadge, { backgroundColor: theme.colors.success }]}>
                <Ionicons name="navigate" size={10} color="#fff" />
                <Text style={styles.distanceText}>{distance}</Text>
              </View>
            )}
          </View>
        </ImageBackground>
      </TouchableOpacity>

      {/* Sponsor-popup */}
      {sponsor && (
        <Modal visible={sponsorModalVisible} transparent animationType="fade">
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
            activeOpacity={1}
            onPress={() => setSponsorModalVisible(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={{ backgroundColor: theme.colors.cardBg, borderRadius: 24, padding: 28, width: '100%', alignItems: 'center', borderWidth: 3, borderColor: theme.colors.primary }}
              onPress={() => {}}
            >
              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text, textAlign: 'center', marginBottom: 4 }}>
                {item.namn || item.name || 'Lekplats'}
              </Text>
              <Text style={{ fontSize: 12, color: theme.colors.textMuted, marginBottom: 16, letterSpacing: 1, textTransform: 'uppercase' }}>
                Sponsrad av
              </Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: theme.colors.text, textAlign: 'center', marginBottom: 16 }}>
                {sponsor.name}
              </Text>
              {sponsor.logoUrl ? (
                <Image source={{ uri: sponsor.logoUrl }} style={{ width: 220, height: 120, borderRadius: 14, marginBottom: 16 }} resizeMode="contain" />
              ) : null}
              {sponsor.description ? (
                <Text style={{ color: theme.colors.textMuted, textAlign: 'center', fontSize: 14, marginBottom: 12 }}>
                  {sponsor.description}
                </Text>
              ) : null}
              {sponsor.address ? (
                <TouchableOpacity
                  onPress={() => { trackSponsorEvent(sponsor.id, 'hittaHitClicks'); Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(sponsor.address)}`); }}
                  style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <Ionicons name="navigate-outline" size={18} color={theme.colors.primary} />
                  <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 16 }}>Hitta hit</Text>
                </TouchableOpacity>
              ) : null}
              {sponsor.website ? (
                <TouchableOpacity
                  onPress={() => {
                    const url = sponsor.website.startsWith('http') ? sponsor.website : `https://${sponsor.website}`;
                    trackSponsorEvent(sponsor.id, 'websiteClicks');
                    Linking.openURL(url);
                  }}
                  style={{ marginBottom: 12 }}
                >
                  <Text style={{ color: theme.colors.link, fontSize: 13, textDecorationLine: 'underline' }}>
                    {sponsor.website}
                  </Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={() => setSponsorModalVisible(false)}
                style={{ height: 50, width: '100%', borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}
              >
                <Text style={{ color: theme.colors.primaryTextOn, fontWeight: '800', fontSize: 16 }}>Stäng</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 3,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  sponsorBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(140,100,0,0.85)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sponsorBadgeText: { color: '#FFD700', fontSize: 10, fontWeight: '800' },
  ratingBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: { color: '#fff', fontSize: 11, fontWeight: 'bold', marginLeft: 3 },
  textContent: { position: 'absolute', bottom: 12, left: 12, right: 12 },
  title: { color: '#fff', fontWeight: '800', fontSize: 15 },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },
  distanceBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  distanceText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
});

export default PlaygroundCard;
