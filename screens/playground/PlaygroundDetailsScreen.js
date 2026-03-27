// PlaygroundDetailsScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Share,
  Platform,
  Linking,
  Alert,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Location from 'expo-location';
import { auth, db } from '../../firebase';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp } from 'firebase/firestore';
import { parsePosition, calculateDistance, formatDistance } from '../../utils/geo';
import { trackSponsorEvent } from '../../utils/sponsorAnalytics';

// 🟢 Importera de nya gemensamma delarna
import { CheckInCard } from '../../src/components/CheckInCard';
import { enrichFeed, getPlaygroundImage } from '../../src/services/feedService';

// Tema & UI
import { useTheme, mapStyle } from '../../src/theme';
import { Card, Chip } from '../../src/ui';
import FullscreenImageModal from '../../src/components/FullscreenImageModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const normalizePlayground = (src = {}, fallbackId) => {
  const imageUrl =
    src.bildUrl ||
    src.imageUrl ||
    'https://firebasestorage.googleapis.com/v0/b/lekplatsen-907fb.firebasestorage.app/o/bild%20saknas.png?alt=media&token=3acbfa69-dea8-456b-bbe2-dd95034f773f';

  const name = src.namn || src.name || 'Lekplats';
  const address = src.adress || src.address || '';
  const kommun = src.kommun || '';
  const description = src.beskrivning || src.description || '';
  const utmaningar = Array.isArray(src.utmaningar) ? src.utmaningar : [];
  const equipment = Array.isArray(src.utrustning) ? src.utrustning : [];
  const faciliteter = Array.isArray(src.faciliteter) ? src.faciliteter : [];
  const bilder = Array.isArray(src.bilder) ? src.bilder : (imageUrl && !imageUrl.includes('bild%20saknas') ? [imageUrl] : []);
  const snittbetyg = typeof src.snittbetyg === 'number' ? src.snittbetyg : 0;
  const incheckningarCount =
    typeof src.antalIncheckningar === 'number'
      ? src.antalIncheckningar
      : (typeof src.incheckningarCount === 'number' ? src.incheckningarCount : 0);

  let location = null;
  if (src.position) {
    location = parsePosition(src.position);
  } else if (src?.location?.latitude && src?.location?.longitude) {
    location = { latitude: src.location.latitude, longitude: src.location.longitude };
  } else if (typeof src?.latitude === 'number' && typeof src?.longitude === 'number') {
    location = { latitude: src.latitude, longitude: src.longitude };
  } else if (src?.koordinater?.lat && src?.koordinater?.lng) {
    location = { latitude: src.koordinater.lat, longitude: src.koordinater.lng };
  }

  return {
    id: src.id || fallbackId,
    name,
    address,
    kommun,
    description,
    imageUrl,
    bilder,
    equipment,
    utmaningar,
    faciliteter,
    snittbetyg,
    incheckningarCount,
    location,
    status: src.status || 'publicerad',
    sponsorship: src.sponsorship || null,
  };
};

const mergeNormalized = (localObj, fetchedObj) => {
  if (!localObj) return fetchedObj;
  if (!fetchedObj) return localObj;
  return {
    ...localObj,
    name: fetchedObj.name || localObj.name,
    address: fetchedObj.address || localObj.address,
    kommun: fetchedObj.kommun || localObj.kommun,
    description: fetchedObj.description || localObj.description,
    imageUrl: (() => {
      const isFallback = (u) => !u || u.includes('bild%20saknas');
      if (!isFallback(fetchedObj.imageUrl)) return fetchedObj.imageUrl;
      if (!isFallback(localObj.imageUrl)) return localObj.imageUrl;
      return fetchedObj.imageUrl;
    })(),
    utmaningar: (fetchedObj.utmaningar?.length ? fetchedObj.utmaningar : localObj.utmaningar) || [],
    equipment: (fetchedObj.equipment?.length ? fetchedObj.equipment : localObj.equipment) || [],
    faciliteter: (fetchedObj.faciliteter?.length ? fetchedObj.faciliteter : localObj.faciliteter) || [],
    bilder: (fetchedObj.bilder?.length ? fetchedObj.bilder : localObj.bilder) || [],
    snittbetyg: (fetchedObj.snittbetyg ?? localObj.snittbetyg) ?? 0,
    incheckningarCount: (fetchedObj.incheckningarCount ?? localObj.incheckningarCount) ?? 0,
    location: fetchedObj.location || localObj.location || null,
    status: fetchedObj.status || localObj.status || 'publicerad',
    sponsorship: fetchedObj.sponsorship || localObj.sponsorship || null,
  };
};

/* -------------------------------------------------------------------------- */
/* Små UI-komponenter                                                         */
/* -------------------------------------------------------------------------- */

const SectionHeader = ({ title, right }) => {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.space.xs }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.text }}>{title}</Text>
      {right || null}
    </View>
  );
};

const TagList = ({ data, iconName, emptyText }) => {
  const { theme } = useTheme();
  if (!Array.isArray(data) || data.length === 0) {
    return <Text style={{ color: theme.colors.textMuted, fontStyle: 'italic' }}>{emptyText}</Text>;
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {data.map((t, idx) => (
        <View key={`${iconName}-${t}-${idx}`} style={{ marginRight: theme.space.xs, marginBottom: theme.space.xs }}>
          <Chip
            label={t}
            beforeIcon={<Ionicons name={iconName} size={14} color={theme.colors.link} />}
          />
        </View>
      ))}
    </View>
  );
};

const Accordion = ({ title, children, defaultOpen = false }) => {
  const { theme } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card style={{ marginHorizontal: theme.space.lg, marginTop: theme.space.sm, padding: 0 }}>
      <TouchableOpacity
        onPress={() => setOpen((o) => !o)}
        activeOpacity={0.8}
        style={{
          paddingHorizontal: theme.space.md,
          paddingVertical: theme.space.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ fontWeight: '800', color: theme.colors.text }}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.text} />
      </TouchableOpacity>
      {open ? (
        <View style={{ paddingHorizontal: theme.space.md, paddingBottom: theme.space.md }}>
          {children}
        </View>
      ) : null}
    </Card>
  );
};

/* -------------------------------------------------------------------------- */
/* Huvudskärmen                                                               */
/* -------------------------------------------------------------------------- */

export default function PlaygroundDetailsScreen({ route, navigation }) {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const { playground: initialPg, id: playgroundId } = route.params || {};
  const [playground, setPlayground] = useState(
    initialPg ? normalizePlayground(initialPg, initialPg?.id) : null
  );

  const [isFavorite, setIsFavorite] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sponsor, setSponsor] = useState(null); // null = ingen sponsor
  const [sponsorPopup, setSponsorPopup] = useState(false);
  const [checkIns, setCheckIns] = useState([]);
  const [loadingCheckins, setLoadingCheckins] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [sendingSuggestion, setSendingSuggestion] = useState(false);

  const userId = auth.currentUser?.uid;

  const images = useMemo(() => {
    const allImages = [];
    if (playground?.imageUrl && !playground.imageUrl.includes('bild%20saknas')) {
      allImages.push(playground.imageUrl);
    }
    checkIns.forEach((checkIn) => {
      if (checkIn.imageUrl) {
        allImages.push(checkIn.imageUrl);
      }
    });
    return allImages;
  }, [playground?.imageUrl, checkIns]);

  const renderCarouselItem = ({ item }) => (
    <View style={styles.slide}>
      <Image source={{ uri: item }} style={styles.image} />
    </View>
  );

  // 1. Kolla favorit-status i Firebase
  useEffect(() => {
    const checkFav = async () => {
      if (!userId || !playground?.id) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          setIsFavorite(userDoc.data().favorites?.includes(playground.id));
        }
      } catch (e) {
        console.warn("Kunde inte hämta favoritstatus", e);
      }
    };
    checkFav();
  }, [playground?.id, userId]);

  // 2. Funktion för att spara till Firebase
  const handleToggleFavorite = async () => {
    if (!userId || !playground?.id) return;
    const userRef = doc(db, 'users', userId);
    const newStatus = !isFavorite;
    setIsFavorite(newStatus); // Snabb UI-uppdatering

    try {
      await updateDoc(userRef, {
        favorites: newStatus ? arrayUnion(playground.id) : arrayRemove(playground.id)
      });
    } catch (e) {
      setIsFavorite(!newStatus); // Revertera om det misslyckas
      Alert.alert('Fel', 'Kunde inte uppdatera favoriter.');
    }
  };

  const galleryImages = useMemo(() => {
    if (!playground) return [];
    const images = [];
    // Lägg till lekplatsens egna bilder (bilder-array tar prioritet)
    if (playground.bilder?.length > 0) {
      playground.bilder.forEach(url => { if (url && !images.includes(url)) images.push(url); });
    } else {
      const isMissing = !playground.imageUrl || playground.imageUrl.includes('bild%20saknas');
      if (!isMissing) images.push(playground.imageUrl);
    }
    // Lägg till bilder från incheckningar
    checkIns.forEach(ci => {
      const img = ci.incheckning?.bildUrl || ci.incheckning?.bild;
      if (img && !images.includes(img)) images.push(img);
    });
    if (images.length === 0) {
      images.push('https://firebasestorage.googleapis.com/v0/b/lekplatsen-907fb.firebasestorage.app/o/bild%20saknas.png?alt=media&token=3acbfa69-dea8-456b-bbe2-dd95034f773f');
    }
    return images;
  }, [playground, checkIns]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!playgroundId) return;
      try {
        const snap = await getDoc(doc(db, 'lekplatser', playgroundId));
        if (!snap.exists()) {
          Alert.alert('Hittades inte', 'Lekplatsen finns inte längre.');
          navigation.goBack?.();
          return;
        }
        const fresh = normalizePlayground({ id: snap.id, ...snap.data() }, playgroundId);
        if (!cancelled) {
          setPlayground((prev) => mergeNormalized(prev, fresh));
        }
      } catch (e) {
        console.warn('Kunde inte hämta lekplats:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [playgroundId, navigation]);

  useEffect(() => {
    (async () => {
      if (userId) {
        const up = await getDoc(doc(db, 'users', userId));
        setIsAdmin(!!up.exists() && !!up.data()?.isAdmin);
      }
    })();
  }, [userId]);

  // Hämta fallback-bild från incheckningar om lekplatsen saknar egen bild
useEffect(() => {
  if (!playground) return;
  const ownImage = playground.imageUrl || '';
  const isMissing = !ownImage || ownImage.includes('bild%20saknas');
  if (!isMissing) return; // har redan en bra bild, inget att göra

  getPlaygroundImage({ id: playground.id, bildUrl: playground.imageUrl })
    .then((resolvedUrl) => {
      if (resolvedUrl && !resolvedUrl.includes('bild%20saknas')) {
        setPlayground((prev) => prev ? { ...prev, imageUrl: resolvedUrl } : prev);
      }
    })
    .catch(() => {});
}, [playground?.id]);

  // Hämta användarens position och beräkna avstånd
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

  // Beräkna avstånd när vi har både användarposition och lekplatsposition
  useEffect(() => {
    if (userLocation && playground?.location) {
      const dist = calculateDistance(userLocation, playground.location);
      setDistance(formatDistance(dist));
    }
  }, [userLocation, playground?.location]);

  useEffect(() => {
    navigation.setOptions({ title: playground?.name ?? 'Lekplats' });
  }, [navigation, playground?.name]);

  // Hämta sponsor för silver/guld
  useEffect(() => {
    const sp = playground?.sponsorship;
    if (!sp?.active || !sp?.sponsorId) { setSponsor(null); return; }
    if (sp.level !== 'silver' && sp.level !== 'guld') { setSponsor(null); return; }
    getDoc(doc(db, 'sponsors', sp.sponsorId))
      .then(snap => setSponsor(snap.exists() ? { id: snap.id, ...snap.data() } : null))
      .catch(() => setSponsor(null));
  }, [playground?.sponsorship]);

  useEffect(() => {
    const load = async () => {
      const pid = playground?.id ?? playgroundId;
      if (!pid) return;
      setLoadingCheckins(true);
      try {
        const q = query(
          collection(db, 'incheckningar'),
          where('lekplatsId', '==', pid),
          orderBy('timestamp', 'desc'),
          limit(15)
        );
        const snap = await getDocs(q);
        const rawItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const enrichedItems = await enrichFeed(rawItems);
        setCheckIns(enrichedItems);
      } catch (e) {
        console.warn('Kunde inte hämta incheckningar:', e);
      } finally {
        setLoadingCheckins(false);
      }
    };
    load();
  }, [playground?.id, playgroundId]);

  const openInMaps = () => {
    const lat = playground?.location?.latitude;
    const lng = playground?.location?.longitude;
    const name = playground?.name ?? 'Lekplats';
    if (!lat || !lng) return;
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`,
      android: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
    });
    Linking.openURL(url);
  };

  const sharePlayground = async () => {
    try {
      const name = playground?.name ?? 'Lekplats';
      const address = playground?.address ?? '';
      await Share.share({
        message: `${name}${address ? `, ${address}` : ''}`,
      });
    } catch {
      Alert.alert('Fel', 'Kunde inte dela.');
    }
  };

  const submitSuggestion = async () => {
    if (!suggestionText.trim()) {
      Alert.alert('Tomt förslag', 'Skriv vad du vill ändra eller rapportera.');
      return;
    }
    try {
      setSendingSuggestion(true);
      await addDoc(collection(db, 'andringsforslag'), {
        lekplatsId: playground.id,
        lekplatsNamn: playground.name,
        userId,
        message: suggestionText.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setSuggestionText('');
      setShowSuggestModal(false);
      Alert.alert('Tack!', 'Ditt förslag har skickats till en administratör.');
    } catch (e) {
      console.error('Kunde inte skicka förslag:', e);
      Alert.alert('Fel', 'Kunde inte skicka förslaget. Försök igen.');
    } finally {
      setSendingSuggestion(false);
    }
  };

  const region = useMemo(() => {
    const lat = playground?.location?.latitude;
    const lng = playground?.location?.longitude;
    if (!lat || !lng) return null;
    return { latitude: lat, longitude: lng, latitudeDelta: 0.005, longitudeDelta: 0.005 };
  }, [playground?.location]);

  if (!playground) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.bg }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <FullscreenImageModal
        visible={!!fullscreenImage}
        imageUrl={fullscreenImage}
        onClose={() => setFullscreenImage(null)}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: theme.space.xl * 2 }}>
        
        <View style={styles.carouselContainer}>
  <View style={{ width: SCREEN_WIDTH, alignItems: 'center', position: 'relative' }}>
    <FlatList
      data={galleryImages}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item, index) => `img-${index}`}
      renderItem={({ item }) => (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setFullscreenImage(item)}
          style={{ width: SCREEN_WIDTH, alignItems: 'center' }}
        >
          <Image
            source={{ uri: item }}
            style={{
              width: '92%',
              height: 220,
              borderRadius: theme.radius.xl,
              backgroundColor: theme.colors.bgSoft,
            }}
            resizeMode="cover"
          />
        </TouchableOpacity>
      )}
    />

    {/* ⭐ STJÄRNAN - Svävar i hörnet på bilden precis som på söksidan */}
    <TouchableOpacity 
      onPress={handleToggleFavorite} 
      style={{
        position: 'absolute',
        top: 15,
        right: '8%', // Justerat för att hamna snyggt på den 92% breda bilden
        backgroundColor: 'rgba(0,0,0,0.5)', // Mörk cirkel för att stjärnan ska synas mot ljusa bilder
        borderRadius: 25,
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 4,
      }}
    >
      <Ionicons 
        name={isFavorite ? "star" : "star-outline"} 
        size={26} 
        color={isFavorite ? theme.colors.primary : theme.colors.primary} 
      />
    </TouchableOpacity>
  </View>
</View>

        <View style={{ alignItems: 'center', marginTop: theme.space.sm }}>
  <Text style={{ fontSize: 22, fontWeight: '800', color: theme.colors.text }}>
    {playground.name}
  </Text>
</View>

        {isAdmin && (
          <TouchableOpacity
            style={styles.adminBtn}
            onPress={() => navigation.navigate('AddPlayground', { id: playground.id })}
          >
            <Ionicons name="create-outline" color={theme.colors.primaryTextOn} size={16} />
            <Text style={{ color: theme.colors.primaryTextOn, fontWeight: '700' }}>Redigera lekplats</Text>
          </TouchableOpacity>
        )}

        <Card style={{ marginHorizontal: theme.space.lg, marginTop: theme.space.sm, padding: theme.space.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="star" size={18} color={theme.colors.star} />
              <Text style={{ color: theme.colors.text, marginLeft: 6, fontWeight: '700' }}>
                {Number(playground.snittbetyg || 0).toFixed(1)} / 5.0
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="people-outline" size={18} color={theme.colors.text} />
              <Text style={{ color: theme.colors.text, marginLeft: 6 }}>
                {playground.incheckningarCount || 0} besök
              </Text>
            </View>
          </View>

          <View style={{ marginTop: theme.space.sm }}>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }} onPress={openInMaps}>
              <Ionicons name="location-outline" size={18} color={theme.colors.text} />
              <Text style={{ color: theme.colors.link, marginLeft: 6, textDecorationLine: 'underline', flex: 1 }}>
                {playground.address || 'Visa på karta'}
              </Text>
            </TouchableOpacity>
            {distance && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.space.xs }}>
                <Ionicons name="navigate-outline" size={18} color={theme.colors.primary} />
                <Text style={{ color: theme.colors.text, marginLeft: 6, fontWeight: '600' }}>
                  {distance} härifrån
                </Text>
              </View>
            )}
          </View>

          {playground.description ? (
            <View style={{ marginTop: theme.space.sm }}>
              <Text style={{ color: theme.colors.text, lineHeight: 20 }}>
                {playground.description}
              </Text>
            </View>
          ) : null}
          
          {sponsor && (
            <TouchableOpacity
              onPress={() => { setSponsorPopup(true); trackSponsorEvent(sponsor.id, 'popupOpens'); }}
              activeOpacity={0.7}
              style={{
                marginTop: theme.space.sm,
                paddingTop: theme.space.sm,
                borderTopWidth: 1,
                borderTopColor: theme.colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space.sm,
              }}
            >
              <Text style={{ fontSize: 12, color: theme.colors.textMuted }}>I samarbete med</Text>
              {sponsor.logoUrl ? (
                <Image
                  source={{ uri: sponsor.logoUrl }}
                  style={{ height: 28, width: 80, borderRadius: theme.radius.sm }}
                  resizeMode="contain"
                />
              ) : (
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.text }}>{sponsor.name}</Text>
              )}
            </TouchableOpacity>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: theme.space.sm }}>
            <Text style={{ color: theme.colors.textMuted }}>{playground.kommun}</Text>
          </View>
        </Card>

        <Accordion title="Utmaningar">
          <TagList data={playground.utmaningar} iconName="trophy-outline" emptyText="Inga utmaningar tillagda." />
        </Accordion>

        <Accordion title="Utrustning">
          <TagList data={playground.equipment} iconName="construct-outline" emptyText="Ingen utrustning angiven." />
        </Accordion>

        <Accordion title="Faciliteter">
          <TagList data={playground.faciliteter} iconName="cafe-outline" emptyText="Inga faciliteter angivna." />
        </Accordion>

        {region && (
          <Card style={{ marginHorizontal: theme.space.lg, marginTop: theme.space.sm, padding: 0, overflow: 'hidden' }}>
            <View style={mapStyle.containerStyle}>
              <MapView 
                style={{ height: 160, width: '100%' }} 
                initialRegion={region} 
                customMapStyle={mapStyle.customMapStyle}
                scrollEnabled={false} 
                zoomEnabled={false}
              >
                <Marker coordinate={{ latitude: region.latitude, longitude: region.longitude }} anchor={{ x: 0.5, y: 1 }}>
                  <MaterialCommunityIcons name="seesaw" size={36} color={mapStyle.markerColor} />
                </Marker>
              </MapView>
            </View>
          </Card>
        )}

        {/* Föreslå ändring – efter kartan */}
        {userId && !isAdmin && playground?.status !== 'review' && (
          <TouchableOpacity
            onPress={() => setShowSuggestModal(true)}
            style={{ marginHorizontal: theme.space.lg, marginTop: theme.space.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 }}
          >
            <Ionicons name="create-outline" size={16} color={theme.colors.textMuted} />
            <Text style={{ color: theme.colors.textMuted, fontWeight: '600', fontSize: 13 }}>Föreslå ändring</Text>
          </TouchableOpacity>
        )}

        {/* SEKTION: INCHECKNINGAR */}
        <View style={{ marginHorizontal: theme.space.lg, marginTop: theme.space.md }}>
          <SectionHeader title="Senaste besökarna" />
          {loadingCheckins ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : checkIns.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted, fontStyle: 'italic' }}>Bli den första att checka in här!</Text>
          ) : (
            <View>
              {checkIns.map((ci) => (
                <CheckInCard
                  key={ci.id}
                  item={{
                    ...ci.incheckning,
                    id: ci.id,
                    userSmeknamn: ci.user?.smeknamn || ci.incheckning.userSmeknamn,
                    profilbildUrl: ci.user?.profilbildUrl,
                    bildUrl: ci.incheckning.bildUrl || ci.incheckning.bild,
                  }}
                  onPressComments={() =>
                    navigation.navigate('Comments', {
                      checkInId: ci.id,
                      checkInComment: ci.incheckning.kommentar || '',
                    })
                  }
                />
              ))}
            </View>
          )}
        </View>

        {/* Nedre knappar (Dela) */}
        <View style={{ marginHorizontal: theme.space.lg, marginTop: theme.space.md, flexDirection: 'row', gap: theme.space.sm }}>
          <TouchableOpacity onPress={sharePlayground} style={styles.actionButton}>
            <Ionicons name="share-social-outline" size={18} color={theme.colors.text} />
            <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Dela</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* MODAL: Föreslå ändring */}
      <Modal visible={showSuggestModal} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.cardBg }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.space.md }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text }}>Föreslå ändring</Text>
                <TouchableOpacity onPress={() => { setShowSuggestModal(false); setSuggestionText(''); }}>
                  <Ionicons name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
              <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginBottom: theme.space.sm }}>
                Beskriv vad som är fel eller bör ändras på "{playground?.name}". En administratör kommer att granska ditt förslag.
              </Text>
              <TextInput
                style={[styles.suggestionInput, { borderColor: theme.colors.border, backgroundColor: theme.colors.inputBg || theme.colors.bgSoft, color: theme.colors.text }]}
                value={suggestionText}
                onChangeText={setSuggestionText}
                placeholder="T.ex. Fel adress, saknad utrustning, felaktig bild…"
                placeholderTextColor={theme.colors.textMuted}
                multiline
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={{ color: theme.colors.textMuted, fontSize: 11, textAlign: 'right', marginTop: 4 }}>
                {suggestionText.length}/500
              </Text>
              <TouchableOpacity
                onPress={submitSuggestion}
                disabled={sendingSuggestion}
                style={[styles.submitBtn, { backgroundColor: theme.colors.primary, opacity: sendingSuggestion ? 0.7 : 1 }]}
              >
                {sendingSuggestion ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Skicka förslag</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Sponsor-popup */}
      {sponsor && (
        <Modal visible={sponsorPopup} transparent animationType="fade">
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
            activeOpacity={1}
            onPress={() => setSponsorPopup(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}
              style={{ backgroundColor: theme.colors.cardBg, borderRadius: 24, padding: 28, width: '100%', alignItems: 'center', borderWidth: 3, borderColor: theme.colors.primary }}
            >
              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text, textAlign: 'center', marginBottom: 4 }}>
                {playground.name}
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
                onPress={() => setSponsorPopup(false)}
                style={{ height: 50, width: '100%', borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}
              >
                <Text style={{ color: theme.colors.primaryTextOn, fontWeight: '800', fontSize: 16 }}>Stäng</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      <View style={[styles.fixedFooter, { backgroundColor: theme.colors.bg }]}>
        <TouchableOpacity
          onPress={() => navigation.navigate('CheckIn', { playgroundId: playground.id })}
          style={[styles.primaryCta, { backgroundColor: playground?.status === 'review' ? theme.colors.textMuted : theme.colors.primary }]}
          disabled={playground?.status === 'review'}
        >
          <Ionicons name="location" size={20} color={theme.colors.primaryTextOn} style={{ marginRight: 8 }} />
          <Text style={{ color: theme.colors.primaryTextOn, fontWeight: '800', fontSize: 16 }}>
            {playground?.status === 'review' ? 'Väntar på granskning' : 'Checka in'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    carouselContainer: { marginTop: theme.space.md },
    adminBtn: {
      alignSelf: 'center',
      marginTop: theme.space.sm,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.space.md,
      paddingVertical: 10,
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    actionButton: {
      flex: 1,
      backgroundColor: theme.colors.cardBg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 12,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    fixedFooter: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 20,
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    primaryCta: {
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      padding: theme.space.lg,
      paddingBottom: Platform.OS === 'ios' ? 40 : theme.space.xl,
    },
    suggestionInput: {
      borderWidth: 1,
      borderRadius: theme.radius.md,
      padding: theme.space.md,
      minHeight: 120,
      fontSize: 15,
    },
    submitBtn: {
      marginTop: theme.space.md,
      height: 48,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });