import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

// 🟢 Importera gemensamma komponenter och services
import { CheckInCard } from '../../src/components/CheckInCard';
import NewsCard from '../../src/components/NewsCard';
import { enrichFeed, enrichPlaygroundsWithImages } from '../../src/services/feedService';
import PlaygroundCard from '../../src/components/PlaygroundCard';

import { auth, db } from '../../firebase';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
} from 'firebase/firestore';

// Tema & UI
import { useTheme } from '../../src/theme';
import { parsePosition, calculateDistance, formatDistance } from '../../utils/geo';

/* -------------------------------------------------------------------------- */
/* Hjälpfunktioner                                                            */
/* -------------------------------------------------------------------------- */

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const NEAR_DISTANCE_METERS = 15000; // 15 km

/* -------------------------------------------------------------------------- */
/* Filter & Sorteringsmodal                                                   */
/* -------------------------------------------------------------------------- */

const HomeFilterModal = ({ visible, onClose, feedFilter, setFeedFilter, nearbyOnly, setNearbyOnly, hasLocation }) => {
  const { theme } = useTheme();
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const visaOptions = [
    { value: 'alla', label: 'Alla', icon: 'people' },
    { value: 'vanner', label: 'Bara vänner', icon: 'person-add' },
    { value: 'egna', label: 'Bara mina', icon: 'person' },
  ];

  const platsOptions = [
    { value: false, label: 'Alla platser', icon: 'globe', disabled: false },
    { value: true, label: `Nära mig (${formatDistance(NEAR_DISTANCE_METERS)})`, icon: 'navigate', disabled: !hasLocation },
  ];

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={hmStyles.modalBackdrop}>
        <TouchableOpacity style={hmStyles.modalBackdropTouchable} activeOpacity={1} onPress={onClose} />
        <View style={[hmStyles.modalContent, { backgroundColor: theme.colors.cardBg }]}>
          <View style={[hmStyles.modalHeader, { borderBottomColor: theme.colors.border }]}>
            <Text style={[hmStyles.modalTitle, { color: theme.colors.text }]}>Filter</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={hmStyles.modalBody}>
            {/* Visa */}
            <View style={hmStyles.modalSection}>
              <TouchableOpacity
                onPress={() => toggleSection('visa')}
                style={[hmStyles.sectionHeader, { borderBottomColor: theme.colors.border }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="people" size={20} color={theme.colors.text} style={{ marginRight: 8 }} />
                  <Text style={[hmStyles.sectionTitle, { color: theme.colors.text }]}>Visa</Text>
                  {feedFilter !== 'alla' && (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary, marginLeft: 8 }} />
                  )}
                </View>
                <Ionicons name={expandedSection === 'visa' ? 'chevron-up' : 'chevron-down'} size={24} color={theme.colors.textMuted} />
              </TouchableOpacity>
              {expandedSection === 'visa' && (
                <View style={{ paddingTop: 8 }}>
                  {visaOptions.map(option => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setFeedFilter(option.value)}
                      style={[
                        hmStyles.optionButton,
                        {
                          backgroundColor: feedFilter === option.value ? theme.colors.primary : theme.colors.bgSoft,
                          borderColor: feedFilter === option.value ? theme.colors.primary : theme.colors.border,
                        }
                      ]}
                    >
                      <Ionicons name={option.icon} size={20} color={feedFilter === option.value ? theme.colors.primaryTextOn : theme.colors.textMuted} />
                      <Text style={[hmStyles.optionText, { color: feedFilter === option.value ? theme.colors.primaryTextOn : theme.colors.text }]}>
                        {option.label}
                      </Text>
                      {feedFilter === option.value && (
                        <Ionicons name="checkmark-circle" size={20} color={theme.colors.primaryTextOn} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Plats */}
            <View style={hmStyles.modalSection}>
              <TouchableOpacity
                onPress={() => toggleSection('plats')}
                style={[hmStyles.sectionHeader, { borderBottomColor: theme.colors.border }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="location" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
                  <Text style={[hmStyles.sectionTitle, { color: theme.colors.text }]}>Plats</Text>
                  {nearbyOnly && (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary, marginLeft: 8 }} />
                  )}
                </View>
                <Ionicons name={expandedSection === 'plats' ? 'chevron-up' : 'chevron-down'} size={24} color={theme.colors.textMuted} />
              </TouchableOpacity>
              {expandedSection === 'plats' && (
                <View style={{ paddingTop: 8 }}>
                  {platsOptions.map((option, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => !option.disabled && setNearbyOnly(option.value)}
                      style={[
                        hmStyles.optionButton,
                        {
                          backgroundColor: nearbyOnly === option.value ? theme.colors.primary : theme.colors.bgSoft,
                          borderColor: nearbyOnly === option.value ? theme.colors.primary : theme.colors.border,
                          opacity: option.disabled ? 0.4 : 1,
                        }
                      ]}
                    >
                      <Ionicons name={option.icon} size={20} color={nearbyOnly === option.value ? theme.colors.primaryTextOn : theme.colors.textMuted} />
                      <Text style={[hmStyles.optionText, { color: nearbyOnly === option.value ? theme.colors.primaryTextOn : theme.colors.text }]}>
                        {option.label}
                      </Text>
                      {nearbyOnly === option.value && (
                        <Ionicons name="checkmark-circle" size={20} color={theme.colors.primaryTextOn} />
                      )}
                    </TouchableOpacity>
                  ))}
                  {!hasLocation && (
                    <Text style={{ fontSize: 12, color: theme.colors.textMuted, marginTop: 4, marginLeft: 4 }}>
                      Platsbehörighet saknas
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Rensa alla filter */}
            <TouchableOpacity
              onPress={() => { setFeedFilter('alla'); setNearbyOnly(false); }}
              style={[hmStyles.resetButton, { backgroundColor: theme.colors.bgSoft, borderColor: theme.colors.border }]}
            >
              <Ionicons name="refresh" size={20} color={theme.colors.textMuted} />
              <Text style={[hmStyles.resetButtonText, { color: theme.colors.textMuted }]}>Rensa alla filter</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={[hmStyles.modalFooter, { borderTopColor: theme.colors.border }]}>
            <TouchableOpacity onPress={onClose} style={[hmStyles.applyButton, { backgroundColor: theme.colors.primary }]}>
              <Text style={[hmStyles.applyButtonText, { color: theme.colors.primaryTextOn }]}>Tillämpa</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const hmStyles = StyleSheet.create({
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBackdropTouchable: { flex: 1 },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalBody: { padding: 20 },
  modalSection: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingBottom: 12, borderBottomWidth: 1, marginBottom: 0 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold' },
  optionButton: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, gap: 12 },
  optionText: { fontSize: 15, flex: 1, fontWeight: '500' },
  resetButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, borderWidth: 1, gap: 8, marginTop: 8 },
  resetButtonText: { fontSize: 15, fontWeight: '600' },
  modalFooter: { padding: 20, borderTopWidth: 1 },
  applyButton: { padding: 16, borderRadius: 12, alignItems: 'center' },
  applyButtonText: { fontSize: 16, fontWeight: 'bold' },
});

/* -------------------------------------------------------------------------- */
/* Huvudkomponenten: Hem                                                      */
/* -------------------------------------------------------------------------- */

export default function HomeScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [discoverPlaygrounds, setDiscoverPlaygrounds] = useState([]);
  const [checkInFeed, setCheckInFeed] = useState([]);
  const [newsFeed, setNewsFeed] = useState([]);
  const [userLocation, setUserLocation] = useState(null);

  // Infinite scroll-state
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  // Filterstate för flödet
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [feedFilter, setFeedFilter] = useState('alla'); // 'alla' | 'vanner' | 'egna'
  const [nearbyOnly, setNearbyOnly] = useState(false);

  const userId = auth.currentUser?.uid;

  // Hämta användarens position
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (e) {
        console.warn('Kunde inte hämta position:', e);
      }
    })();
  }, []);

  const fetchHomeScreenData = async () => {
    if (!userId) return;
    setLoading(true);
    setHasMore(true);

    try {
      const userSnap = await getDoc(doc(db, 'users', userId));
      if (!userSnap.exists()) throw new Error('Användaren finns inte.');
      const currentUserData = userSnap.data();
      setUserData(currentUserData);

      const friendIds = currentUserData.friends || [];

      // Hämta lekplatser, sponsors och nyheter parallellt
      const [pgSnapshot, sponsorSnap, nyhetSnap] = await Promise.all([
        getDocs(collection(db, 'lekplatser')),
        getDocs(collection(db, 'sponsors')),
        getDocs(query(collection(db, 'nyheter'), where('publicerad', '==', true), orderBy('skapadAt', 'desc'), limit(20))),
      ]);

      setNewsFeed(nyhetSnap.docs.map(d => ({ id: d.id, type: 'news', ...d.data() })));
      const sponsorMap = {};
      sponsorSnap.docs.forEach(d => { sponsorMap[d.id] = { id: d.id, ...d.data() }; });
      const allPlaygrounds = pgSnapshot.docs
        .map((d) => {
          const data = d.data();
          const sponsorData = data.sponsorship?.active && data.sponsorship?.sponsorId
            ? sponsorMap[data.sponsorship.sponsorId] || null
            : null;
          return { id: d.id, ...data, sponsorName: sponsorData?.name || null, sponsorData };
        })
        .filter((p) => p.status !== 'review');

      let discoverList = [];
      if (userLocation) {
        const playgroundsWithDistance = allPlaygrounds
          .map(p => {
            const pos = parsePosition(p.position);
            if (!pos) return null;
            const distance = calculateDistance(userLocation, pos);
            return { ...p, distance };
          })
          .filter(p => p !== null && p.distance !== null);

        playgroundsWithDistance.sort((a, b) => a.distance - b.distance);
        discoverList = playgroundsWithDistance.slice(0, 5);
      } else {
        discoverList = allPlaygrounds.slice(0, 5);
      }

      // 🟢 Berika lekplatser med bild från incheckningar om egen bild saknas
      const enrichedDiscover = await enrichPlaygroundsWithImages(discoverList);
      setDiscoverPlaygrounds(enrichedDiscover);

      const userAndFriendsIds = [...friendIds, userId];
      if (userAndFriendsIds.length === 0) {
        setCheckInFeed([]);
        setHasMore(false);
        setLoading(false);
        return;
      }

      const idChunks = chunk(userAndFriendsIds, 10);
      const pageSize = 10;
      const allResults = [];
      let lastDocForPaging = null;

      for (const ids of idChunks) {
        const q1 = query(
          collection(db, 'incheckningar'),
          where('userId', 'in', ids),
          orderBy('timestamp', 'desc'),
          limit(pageSize)
        );
        const snap = await getDocs(q1);
        if (snap.docs.length > 0) {
          lastDocForPaging = snap.docs[snap.docs.length - 1];
          snap.docs.forEach((d) => allResults.push({ id: d.id, ...d.data() }));
        }
      }

      allResults.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
      const page = allResults.slice(0, pageSize);

      setLastVisible(lastDocForPaging);
      setHasMore(page.length === pageSize);

      const finalFeed = await enrichFeed(page);
      setCheckInFeed(finalFeed);
    } catch (error) {
      console.error('Fel vid hämtning av Hemskärmsdata:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMoreCheckIns = async () => {
    if (loadingMore || !hasMore || !lastVisible) return;
    setLoadingMore(true);
    try {
      const friendIds = userData?.friends || [];
      const userAndFriendsIds = [...friendIds, userId];
      const idChunks = chunk(userAndFriendsIds, 10);
      const pageSize = 10;
      const allResults = [];
      let newLastDoc = null;

      for (const ids of idChunks) {
        const qNext = query(
          collection(db, 'incheckningar'),
          where('userId', 'in', ids),
          orderBy('timestamp', 'desc'),
          startAfter(lastVisible),
          limit(pageSize)
        );
        const snap = await getDocs(qNext);
        if (snap.docs.length) {
          newLastDoc = snap.docs[snap.docs.length - 1];
          snap.docs.forEach((d) => allResults.push({ id: d.id, ...d.data() }));
        }
      }

      allResults.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
      const page = allResults.slice(0, pageSize);

      if (newLastDoc) setLastVisible(newLastDoc);
      setHasMore(page.length === pageSize);

      const newFinalFeed = await enrichFeed(page);
      setCheckInFeed((prev) => [...prev, ...newFinalFeed]);
    } catch (error) {
      console.error('Fel vid hämtning av mer data:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchHomeScreenData();
    }, [userId, userLocation])
  );

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const getGreeting = (fornamn, now = new Date()) => {
    const hour = now.getHours();
    const day = now.getDay();
    const n = fornamn ? `, ${fornamn}` : '';

    if (day === 0) return pick([
      'Härligt med söndag – dags att upptäcka en ny lekplats?',
      'Söndagskänsla! Perfekt dag för ett lekplatsäventyr.',
      'Vila eller lek? Vi röstar på lek!',
    ]);
    if (day === 6) return pick([
      'Lördag – perfekt dag för ett lekplatsäventyr!',
      'Äntligen lördag – dags att ge barnen en minnesvärd dag!',
      'Helgstämning! Vilken lekplats utforskar ni idag?',
    ]);
    if (hour >= 6 && hour < 11) return pick([
      `God morgon${n}!`,
      `Morgonen är här${n} – dags att planera dagens äventyr!`,
      `Uppvaknat${n}? En lekplats väntar!`,
      `Hoppas du sover gott${n} – nu är det dags att leka!`,
    ]);
    if (hour >= 11 && hour < 14) return pick([
      `God middag${n}!`,
      `Mitt på dagen${n} – energi nog för en lekplatsrunda?`,
      `Lunchtid${n}! Eftermiddagen är perfekt för lek.`,
    ]);
    if (hour >= 14 && hour < 18) return pick([
      `God eftermiddag${n}!`,
      `Eftermiddagen är här${n} – dags att hitta närmaste sandlåda?`,
      `Klättring, gunga eller rutschkana${n}? Välj din favorit!`,
      `Perfekt eftermiddagsväder för lek${n}!`,
    ]);
    if (hour >= 18 && hour < 22) return pick([
      `God kväll${n}!`,
      `Kvällsdags${n} – hann ni besöka en lekplats idag?`,
      `En lugn kväll${n}? Kolla in vad som hände runt om idag.`,
    ]);
    return pick([
      `Sent ute${n}?`,
      `Nattugglorna är vakna${n}!`,
      `Sova eller scrolla${n}? Vi hejar på lek!`,
    ]);
  };

  const hasActiveFilters = feedFilter !== 'alla' || nearbyOnly;

  const filteredFeed = React.useMemo(() => {
    let checkins = checkInFeed;

    if (feedFilter === 'vanner') checkins = checkins.filter((item) => item.incheckning.userId !== userId);
    else if (feedFilter === 'egna') checkins = checkins.filter((item) => item.incheckning.userId === userId);

    if (nearbyOnly && userLocation) {
      checkins = checkins.filter((item) => {
        const pos = parsePosition(item.lekplats?.position);
        if (!pos) return false;
        const dist = calculateDistance(userLocation, pos);
        return dist !== null && dist <= NEAR_DISTANCE_METERS;
      });
    }

    // Tagga incheckningar med type och slå ihop med nyheter, sortera på datum
    const taggedCheckins = checkins.map(item => ({ ...item, type: 'checkin' }));
    const combined = [...taggedCheckins, ...newsFeed];
    combined.sort((a, b) => {
      const aMs = a.type === 'news'
        ? (a.skapadAt?.toMillis?.() || 0)
        : (a.incheckning?.timestamp?.toMillis?.() || 0);
      const bMs = b.type === 'news'
        ? (b.skapadAt?.toMillis?.() || 0)
        : (b.incheckning?.timestamp?.toMillis?.() || 0);
      return bMs - aMs;
    });

    return combined;
  }, [checkInFeed, newsFeed, feedFilter, nearbyOnly, userId, userLocation]);

  const Header = () => {
    const displayName = userData?.smeknamn || 'Hej!';
    const profileUrl = userData?.profilbildUrl;
    const fallbackInitial = (displayName || 'A').trim().charAt(0).toUpperCase();
    const fallbackUrl = `https://ui-avatars.com/api/?name=${fallbackInitial}&background=e0e0e0&color=777`;

    return (
      <View style={{ paddingHorizontal: theme.space.xl, paddingTop: theme.space.lg, paddingBottom: theme.space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.space.md }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profil')}
            activeOpacity={0.8}
            style={[styles.avatarContainer, { backgroundColor: theme.colors.bgSoft }]}
          >
            <Image source={{ uri: profileUrl || fallbackUrl }} style={{ width: '100%', height: '100%' }} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.textMuted }}>{getGreeting(userData?.fornamn)}</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Lekplatser nära dig</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: theme.space.xl }}>
          {discoverPlaygrounds.map((item) => (
            <PlaygroundCard
              key={item.id}
              item={item}
              userLocation={userLocation}
              style={{ width: 260, height: 160, marginRight: 12 }}
            />
          ))}
        </ScrollView>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.space.lg, marginBottom: 8 }}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 0 }]}>Senaste äventyren</Text>
          <TouchableOpacity
            onPress={() => setFilterModalVisible(true)}
            style={[styles.filterBtn, { backgroundColor: hasActiveFilters ? theme.colors.primary : theme.colors.bgSoft }]}
            activeOpacity={0.7}
          >
            <Ionicons name="options" size={20} color={hasActiveFilters ? theme.colors.primaryTextOn : theme.colors.textMuted} />
            {hasActiveFilters && (
              <View style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.accent }} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading && checkInFeed.length === 0) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.colors.bg }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <HomeFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        feedFilter={feedFilter}
        setFeedFilter={setFeedFilter}
        nearbyOnly={nearbyOnly}
        setNearbyOnly={setNearbyOnly}
        hasLocation={!!userLocation}
      />
      <FlatList
        data={filteredFeed}
        keyExtractor={(item) => item.type === 'news' ? `news-${item.id}` : item.id}
        ListHeaderComponent={<Header />}
        renderItem={({ item }) => {
          if (item.type === 'news') {
            return <NewsCard item={item} />;
          }
          return (
            <CheckInCard
              item={{
                ...item.incheckning,
                id: item.id,
                userSmeknamn: item.user?.smeknamn || item.incheckning.userSmeknamn,
                profilbildUrl: item.user?.profilbildUrl,
                bildUrl: item.incheckning.bildUrl || item.incheckning.bild,
              }}
              playgroundName={item.lekplats?.namn}
              onPressComments={() =>
                navigation.navigate('Comments', {
                  checkInId: item.id,
                  checkInComment: item.incheckning.kommentar || '',
                })
              }
            />
          );
        }}
        ListEmptyComponent={() => {
          if (loading) return null;
          let message = 'Inga inchecknningar att visa ännu.';
          if (feedFilter === 'vanner')
            message = 'Inga vänners inchecknningar.\nLägg till vänner för att se deras äventyr!';
          else if (feedFilter === 'egna')
            message = 'Du har inga inchecknningar ännu.\nCheckna in på en lekplats!';
          else if (nearbyOnly)
            message = !userLocation
              ? 'Platsbehörighet saknas.\nAktivera plats för att filtrera nära lekplatser.'
              : `Inga inchecknningar inom ${formatDistance(NEAR_DISTANCE_METERS)} just nu.`;
          return (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyStateText, { color: theme.colors.textMuted }]}>{message}</Text>
            </View>
          );
        }}
        onEndReached={fetchMoreCheckIns}
        onEndReachedThreshold={0.5}
        ListFooterComponent={() => loadingMore ? <ActivityIndicator style={{ marginVertical: 20 }} /> : null}
        contentContainerStyle={{ paddingBottom: theme.space.xl * 2 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  filterBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  discoverBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  discoverBadgeText: { color: '#fff', marginLeft: 4, fontWeight: '700', fontSize: 12 },
  distanceBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceBadgeText: { color: '#fff', marginLeft: 4, fontWeight: '700', fontSize: 12 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  emptyStateText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
