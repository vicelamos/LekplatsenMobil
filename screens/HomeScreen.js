import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Alert,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

// 🟢 Importera gemensamma komponenter och services
import { CheckInCard } from '../src/components/CheckInCard';
import { enrichFeed, enrichPlaygroundsWithImages } from '../src/services/feedService';

import { auth, db } from '../firebase';
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
import { useTheme } from '../src/theme';
import { Card, Chip } from '../src/ui';
import { parsePosition, calculateDistance, formatDistance } from '../utils/geo';

/* -------------------------------------------------------------------------- */
/* Hjälpfunktioner                                                            */
/* -------------------------------------------------------------------------- */

const toPlaygroundPayload = (src = {}, fallbackId) => {
  let location = null;
  if (src?.location?.latitude && src?.location?.longitude) {
    location = { latitude: src.location.latitude, longitude: src.location.longitude };
  } else if (typeof src?.latitude === 'number' && typeof src?.longitude === 'number') {
    location = { latitude: src.latitude, longitude: src.longitude };
  } else if (src?.koordinater?.lat && src?.koordinater?.lng) {
    location = { latitude: src.koordinater.lat, longitude: src.koordinater.lng };
  }

  return {
    id: src.id || fallbackId,
    name: src.namn || src.name || 'Lekplats',
    address: src.adress || src.address || '',
    description: src.beskrivning || src.description || '',
    imageUrl: src.resolvedImageUrl || src.bildUrl || src.imageUrl || '',
    equipment: src.utrustning || src.equipment || [],
    location,
  };
};

const navigateToPlaygroundDetails = (navigation, params) => {
  const parent = navigation.getParent?.();
  (parent || navigation).navigate('PlaygroundDetails', params);
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/* -------------------------------------------------------------------------- */
/* Komponent: Lekplatser nära dig (Karusell högst upp)                      */
/* -------------------------------------------------------------------------- */

const DiscoverCard = memo(({ item, userLocation }) => {
  const navigation = useNavigation();
  const { theme } = useTheme();

  // Använd resolvedImageUrl om tillgänglig, annars bildUrl/imageUrl
  const imageUrl =
    item.resolvedImageUrl ||
    item.bildUrl ||
    item.imageUrl ||
    'https://firebasestorage.googleapis.com/v0/b/lekplatsen-907fb.firebasestorage.app/o/bild%20saknas.png?alt=media&token=3acbfa69-dea8-456b-bbe2-dd95034f773f';

  const distance = useMemo(() => {
    if (!userLocation || !item.position) return null;
    const playgroundPos = parsePosition(item.position);
    if (!playgroundPos) return null;
    const dist = calculateDistance(userLocation, playgroundPos);
    return formatDistance(dist);
  }, [userLocation, item.position]);

  const onPress = () => {
    const payload = toPlaygroundPayload({ ...item, bildUrl: imageUrl }, item.id);
    navigateToPlaygroundDetails(navigation, { playground: payload, id: payload.id });
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={{
        width: 260,
        height: 160,
        marginRight: theme.space.md,
        borderRadius: theme.radius.xl,
        overflow: 'hidden',
        ...theme.shadow.card,
      }}
    >
      <ImageBackground source={{ uri: imageUrl }} style={{ flex: 1 }}>
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' }} />
        <View style={styles.discoverBadge}>
          <Ionicons name="star" size={14} color={theme.colors.star} />
          <Text style={styles.discoverBadgeText}>
            {(item.snittbetyg || 0).toFixed(1)}
          </Text>
        </View>
        {distance && (
          <View style={[styles.distanceBadge, { backgroundColor: theme.colors.success }]}>
            <Ionicons name="navigate" size={12} color="#fff" />
            <Text style={styles.distanceBadgeText}>{distance}</Text>
          </View>
        )}
        <View style={{ position: 'absolute', left: 14, bottom: 14, right: 14 }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }} numberOfLines={1}>
            {item.namn || 'Lekplats'}
          </Text>
          {!!item.adress && (
            <Text style={{ color: '#fff', opacity: 0.85 }} numberOfLines={1}>
              {item.adress}
            </Text>
          )}
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
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
  const [userLocation, setUserLocation] = useState(null);

  // Infinite scroll-state
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);

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

      // Hämta lekplatser och sortera efter avstånd
      const pgSnapshot = await getDocs(collection(db, 'lekplatser'));
      const allPlaygrounds = pgSnapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
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

  const Header = () => {
    const displayName = userData?.smeknamn || 'Hej!';
    const profileUrl = userData?.profilbildUrl;
    const fallbackInitial = (displayName || 'A').trim().charAt(0).toUpperCase();
    const fallbackUrl = `https://ui-avatars.com/api/?name=${fallbackInitial}&background=e0e0e0&color=777`;

    return (
      <View style={{ paddingHorizontal: theme.space.xl, paddingTop: theme.space.lg, paddingBottom: theme.space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.space.md }}>
          <View style={[styles.avatarContainer, { backgroundColor: theme.colors.bgSoft }]}>
            <Image source={{ uri: profileUrl || fallbackUrl }} style={{ width: '100%', height: '100%' }} />
          </View>
          <View>
            <Text style={{ color: theme.colors.text, fontWeight: '800', fontSize: 18 }}>{displayName}</Text>
            <Text style={{ color: theme.colors.textMuted }}>Dags för lek?</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Lekplatser nära dig</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: theme.space.xl }}>
          {discoverPlaygrounds.map((item) => <DiscoverCard key={item.id} item={item} userLocation={userLocation} />)}
        </ScrollView>

        <Text style={[styles.sectionTitle, { marginTop: theme.space.lg, color: theme.colors.text }]}>Senaste äventyren</Text>
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
      <FlatList
        data={checkInFeed}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<Header />}
        renderItem={({ item }) => (
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
        )}
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
});