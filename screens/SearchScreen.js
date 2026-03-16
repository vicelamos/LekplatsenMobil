import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ImageBackground,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Callout } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';

import { auth, db } from '../firebase';
import { doc, getDoc, collection, getDocs, query, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

import { useTheme, mapStyle } from '../src/theme';
import { Card as UICard, Chip, Input } from '../src/ui';
import { parsePosition, calculateDistance, formatDistance } from '../utils/geo';
import { useRef } from 'react';

const FALLBACK_IMG = 'https://firebasestorage.googleapis.com/v0/b/lekplatsen-907fb.firebasestorage.app/o/bild%20saknas.png?alt=media&token=3acbfa69-dea8-456b-bbe2-dd95034f773f';

/* ------------------- Hjälpfunktion för data ------------------- */
const toPlaygroundPayload = (src = {}, fallbackId) => {
  let location = null;
  if (src?.position) location = parsePosition(src.position);
  if (!location && src?.location?.latitude) location = { latitude: src.location.latitude, longitude: src.location.longitude };
  
  return {
    id: src.id || fallbackId,
    name: src.namn || src.name || 'Lekplats',
    address: src.adress || src.address || '',
    description: src.beskrivning || src.description || '',
    imageUrl: src.bildUrl || src.imageUrl || '',
    equipment: src.utrustning || src.equipment || [],
    location,
  };
};

/* ------------------- Gridkort för lekplatser ------------------- */
const PlaygroundCard = memo(({ item, isFavorite, onToggleFavorite, userLocation }) => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const imageUrl = item.bildUrl || item.imageUrl || FALLBACK_IMG;
  
  const distance = useMemo(() => {
    if (!userLocation || !item.position) return null;
    const playgroundPos = parsePosition(item.position);
    if (!playgroundPos) return null;
    const dist = calculateDistance(userLocation, playgroundPos);
    return formatDistance(dist);
  }, [userLocation, item.position]);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => {
        const payload = toPlaygroundPayload({ ...item, bildUrl: imageUrl }, item.id);
        navigation.navigate('PlaygroundDetails', { playground: payload, id: payload.id });
      }}
      style={styles.cardContainer}
    >
      <ImageBackground source={{ uri: imageUrl }} style={{ flex: 1 }}>
        <View style={styles.cardOverlay} />
        
        {/* ⭐ SNABB-STJÄRNA (Spara) */}
        <TouchableOpacity 
          onPress={() => onToggleFavorite(item.id)}
          style={styles.favoriteBadge}
        >
          <Ionicons 
            name={isFavorite ? "star" : "star-outline"} 
            size={18} 
            color={isFavorite ? theme.colors.primary : theme.colors.primary} 
          />
        </TouchableOpacity>

        {/* Betyg */}
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={12} color={theme.colors.star} />
          <Text style={styles.ratingText}>{(item.snittbetyg || 0).toFixed(1)}</Text>
        </View>

        <View style={styles.cardTextContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.namn || 'Lekplats'}</Text>
          {!!item.adress && <Text style={styles.cardSubtitle} numberOfLines={1}>{item.adress}</Text>}
          {distance && (
            <View style={[styles.distanceBadge, { backgroundColor: theme.colors.success }]}>
              <Ionicons name="navigate" size={10} color="#fff" />
              <Text style={styles.distanceText}>{distance}</Text>
            </View>
          )}
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
});

/* ----------------------------- Header ----------------------------- */
const SearchHeader = memo(({ searchQuery, setSearchQuery, viewMode, setViewMode, isAdmin, navigation, showFavoritesOnly, setShowFavoritesOnly, onOpenFilterSort, sortBy, hasActiveFilters }) => {
  const { theme } = useTheme();
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
      <Text style={{ fontSize: 22, fontWeight: '900', color: theme.colors.text }}>
        {showFavoritesOnly ? 'Sparade favoriter' : 'Alla lekplatser'}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10 }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Input
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Sök namn eller adress..."
            containerStyle={{ backgroundColor: theme.colors.cardBg, borderRadius: 15, height: 70, borderWidth: 1, borderColor: theme.colors.border }}
          />
        </View>
        <View style={{ gap: 6 }}>
          <TouchableOpacity onPress={() => setViewMode('list')} style={[styles.modeBtn, { backgroundColor: viewMode === 'list' ? theme.colors.primary : theme.colors.bgSoft }]}>
            <Ionicons name="list" size={18} color={viewMode === 'list' ? theme.colors.primaryTextOn : theme.colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setViewMode('map')} style={[styles.modeBtn, { backgroundColor: viewMode === 'map' ? theme.colors.primary : theme.colors.bgSoft }]}>
            <Ionicons name="map" size={18} color={viewMode === 'map' ? theme.colors.primaryTextOn : theme.colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity 
            onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
            style={[styles.filterBtn, { backgroundColor: showFavoritesOnly ? theme.colors.accent : theme.colors.bgSoft }]}
        >
          <Ionicons name={showFavoritesOnly ? "star" : "star-outline"} size={20} color={showFavoritesOnly ? theme.colors.primaryTextOn : theme.colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity 
            onPress={() => {
              console.log('Filter button pressed!');
              onOpenFilterSort();
            }}
            style={[styles.filterBtn, { backgroundColor: hasActiveFilters ? theme.colors.primary : theme.colors.bgSoft }]}
            activeOpacity={0.7}
        >
          <Ionicons name="options" size={20} color={hasActiveFilters ? theme.colors.primaryTextOn : theme.colors.textMuted} />
          {hasActiveFilters && (
            <View style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.accent }} />
          )}
        </TouchableOpacity>

        {isAdmin && (
          <TouchableOpacity onPress={() => navigation.navigate('ReviewDrafts')} style={{ backgroundColor: theme.colors.text, width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="shield-checkmark" size={16} color={theme.colors.cardBg} />
          </TouchableOpacity>
        )}
      </View>

      {sortBy && sortBy !== 'none' && (
        <View style={{ paddingVertical: 6 }}>
          <Text style={{ fontSize: 13, color: theme.colors.textMuted }}>
            Sorterat efter: <Text style={{ fontWeight: 'bold', color: theme.colors.text }}>
              {sortBy === 'rating' ? 'Betyg (högst först)' : sortBy === 'distance' ? 'Avstånd (närmast först)' : 'Namn (A-Ö)'}
            </Text>
          </Text>
        </View>
      )}
    </View>
  );
});

/* ----------------------------- Footer ----------------------------- */
const AddPlaygroundFooter = memo(({ navigation }) => {
  const { theme } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 30, paddingHorizontal: 20 }}>
      <Text style={{ fontSize: 16, color: theme.colors.textMuted, textAlign: 'center', marginBottom: 16, fontWeight: '500' }}>
        Saknas en lekplats? Lägg till den här!
      </Text>
      <TouchableOpacity 
        onPress={() => navigation.navigate('AddPlayground')} 
        style={[{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 25, gap: 8, ...theme.shadow.card }, { backgroundColor: theme.colors.primary }]}
      >
        <Ionicons name="add-circle-outline" size={24} color={theme.colors.primaryTextOn} />
        <Text style={{ color: theme.colors.primaryTextOn, fontWeight: 'bold', fontSize: 16 }}>Lägg till lekplats</Text>
      </TouchableOpacity>
    </View>
  );
});

/* ------------------------- Kartstil ------------------------- */
const customMapStyle = [
  {
    "featureType": "poi",
    "elementType": "labels",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "poi.business",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "transit",
    "elementType": "labels.icon",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#a2daf7" }]
  },
  {
    "featureType": "landscape.natural",
    "elementType": "geometry.fill",
    "stylers": [{ "color": "#e8f5e9" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#ffffff" }]
  }
];

/* ------------------------- Filter & Sorteringsmodal ------------------------- */
const FilterSortModal = memo(({ visible, onClose, sortBy, setSortBy, minRating, setMinRating, selectedKommun, setSelectedKommun, kommuner }) => {
  const { theme } = useTheme();
  const [expandedSection, setExpandedSection] = useState(null); // 'sort', 'rating', 'kommun'
  
  console.log('FilterSortModal render, visible:', visible);
  
  const sortOptions = [
    { value: 'none', label: 'Standard', icon: 'remove' },
    { value: 'rating', label: 'Betyg (högst först)', icon: 'star' },
    { value: 'distance', label: 'Avstånd (närmast först)', icon: 'navigate' },
    { value: 'name', label: 'Namn (A-Ö)', icon: 'text' },
  ];

  const ratingOptions = [
    { value: 0, label: 'Alla betyg' },
    { value: 3, label: '3+ stjärnor' },
    { value: 4, label: '4+ stjärnor' },
    { value: 4.5, label: '4.5+ stjärnor' },
  ];

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <TouchableOpacity 
          style={styles.modalBackdropTouchable} 
          activeOpacity={1} 
          onPress={onClose}
        />
        <View style={[styles.modalContent, { backgroundColor: theme.colors.cardBg }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Filter & Sortering</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Sortering */}
            <View style={styles.modalSection}>
              <TouchableOpacity 
                onPress={() => toggleSection('sort')}
                style={[styles.sectionHeader, { borderBottomColor: theme.colors.border }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="swap-vertical" size={20} color={theme.colors.text} style={{ marginRight: 8 }} />
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    Sortera efter
                  </Text>
                  {sortBy !== 'none' && (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary, marginLeft: 8 }} />
                  )}
                </View>
                <Ionicons 
                  name={expandedSection === 'sort' ? 'chevron-up' : 'chevron-down'} 
                  size={24} 
                  color={theme.colors.textMuted} 
                />
              </TouchableOpacity>
              {expandedSection === 'sort' && (
                <View style={{ paddingTop: 8 }}>
                  {sortOptions.map(option => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setSortBy(option.value)}
                      style={[
                        styles.optionButton,
                        { 
                          backgroundColor: sortBy === option.value ? theme.colors.primary : theme.colors.bgSoft,
                          borderColor: sortBy === option.value ? theme.colors.primary : theme.colors.border,
                        }
                      ]}
                    >
                      <Ionicons 
                        name={option.icon} 
                        size={20} 
                        color={sortBy === option.value ? theme.colors.primaryTextOn : theme.colors.textMuted} 
                      />
                      <Text style={[
                        styles.optionText,
                        { color: sortBy === option.value ? theme.colors.primaryTextOn : theme.colors.text }
                      ]}>
                        {option.label}
                      </Text>
                      {sortBy === option.value && (
                        <Ionicons name="checkmark-circle" size={20} color={theme.colors.primaryTextOn} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Filtrera efter betyg */}
            <View style={styles.modalSection}>
              <TouchableOpacity 
                onPress={() => toggleSection('rating')}
                style={[styles.sectionHeader, { borderBottomColor: theme.colors.border }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="star" size={20} color={theme.colors.star} style={{ marginRight: 8 }} />
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    Filtrera betyg
                  </Text>
                  {minRating > 0 && (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary, marginLeft: 8 }} />
                  )}
                </View>
                <Ionicons 
                  name={expandedSection === 'rating' ? 'chevron-up' : 'chevron-down'} 
                  size={24} 
                  color={theme.colors.textMuted} 
                />
              </TouchableOpacity>
              {expandedSection === 'rating' && (
                <View style={{ paddingTop: 8 }}>
                  {ratingOptions.map(option => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setMinRating(option.value)}
                      style={[
                        styles.optionButton,
                        { 
                          backgroundColor: minRating === option.value ? theme.colors.primary : theme.colors.bgSoft,
                          borderColor: minRating === option.value ? theme.colors.primary : theme.colors.border,
                        }
                      ]}
                    >
                      <Ionicons 
                        name="star" 
                        size={20} 
                        color={minRating === option.value ? theme.colors.primaryTextOn : theme.colors.star} 
                      />
                      <Text style={[
                        styles.optionText,
                        { color: minRating === option.value ? theme.colors.primaryTextOn : theme.colors.text }
                      ]}>
                        {option.label}
                      </Text>
                      {minRating === option.value && (
                        <Ionicons name="checkmark-circle" size={20} color={theme.colors.primaryTextOn} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Filtrera efter kommun */}
            <View style={styles.modalSection}>
              <TouchableOpacity 
                onPress={() => toggleSection('kommun')}
                style={[styles.sectionHeader, { borderBottomColor: theme.colors.border }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="location" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    Filtrera kommun
                  </Text>
                  {selectedKommun && (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary, marginLeft: 8 }} />
                  )}
                </View>
                <Ionicons 
                  name={expandedSection === 'kommun' ? 'chevron-up' : 'chevron-down'} 
                  size={24} 
                  color={theme.colors.textMuted} 
                />
              </TouchableOpacity>
              {expandedSection === 'kommun' && (
                <View style={{ paddingTop: 8 }}>
                  <TouchableOpacity
                    onPress={() => setSelectedKommun(null)}
                    style={[
                      styles.optionButton,
                      { 
                        backgroundColor: !selectedKommun ? theme.colors.primary : theme.colors.bgSoft,
                        borderColor: !selectedKommun ? theme.colors.primary : theme.colors.border,
                      }
                    ]}
                  >
                    <Ionicons 
                      name="globe" 
                      size={20} 
                      color={!selectedKommun ? theme.colors.primaryTextOn : theme.colors.textMuted} 
                    />
                    <Text style={[
                      styles.optionText,
                      { color: !selectedKommun ? theme.colors.primaryTextOn : theme.colors.text }
                    ]}>
                      Alla kommuner
                    </Text>
                    {!selectedKommun && (
                      <Ionicons name="checkmark-circle" size={20} color={theme.colors.primaryTextOn} />
                    )}
                  </TouchableOpacity>
                  <ScrollView style={{ maxHeight: 200 }}>
                    {kommuner.map(kommun => (
                      <TouchableOpacity
                        key={kommun}
                        onPress={() => setSelectedKommun(kommun)}
                        style={[
                          styles.optionButton,
                          { 
                            backgroundColor: selectedKommun === kommun ? theme.colors.primary : theme.colors.bgSoft,
                            borderColor: selectedKommun === kommun ? theme.colors.primary : theme.colors.border,
                          }
                        ]}
                      >
                        <Ionicons 
                          name="location-outline" 
                          size={20} 
                          color={selectedKommun === kommun ? theme.colors.primaryTextOn : theme.colors.textMuted} 
                        />
                        <Text style={[
                          styles.optionText,
                          { color: selectedKommun === kommun ? theme.colors.primaryTextOn : theme.colors.text }
                        ]}>
                          {kommun}
                        </Text>
                        {selectedKommun === kommun && (
                          <Ionicons name="checkmark-circle" size={20} color={theme.colors.primaryTextOn} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Rensa alla filter */}
            <TouchableOpacity 
              onPress={() => {
                setSortBy('none');
                setMinRating(0);
                setSelectedKommun(null);
              }}
              style={[styles.resetButton, { backgroundColor: theme.colors.bgSoft, borderColor: theme.colors.border }]}
            >
              <Ionicons name="refresh" size={20} color={theme.colors.textMuted} />
              <Text style={[styles.resetButtonText, { color: theme.colors.textMuted }]}>Rensa alla filter</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: theme.colors.border }]}>
            <TouchableOpacity 
              onPress={onClose}
              style={[styles.applyButton, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={[styles.applyButtonText, { color: theme.colors.primaryTextOn }]}>Tillämpa</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});

/* ------------------------- Huvudkomponent ------------------------- */
function SearchScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allPlaygrounds, setAllPlaygrounds] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedPlayground, setSelectedPlayground] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortBy, setSortBy] = useState('none'); // 'none', 'rating', 'distance', 'name'
  const [minRating, setMinRating] = useState(0);
  const [selectedKommun, setSelectedKommun] = useState(null);

  const userId = auth.currentUser?.uid;
  const mapRef = useRef(null);

  // Hämta unika kommuner från alla lekplatser
  const kommuner = useMemo(() => {
    const uniqueKommuner = [...new Set(allPlaygrounds
      .map(p => p.kommun)
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'sv'));
    return uniqueKommuner;
  }, [allPlaygrounds]);

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

  useEffect(() => {
    if (userLocation && mapRef.current && viewMode === 'map') {
      mapRef.current.animateToRegion(
        {
          ...userLocation,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        1000,
      );
    }
  }, [userLocation, viewMode]);

  const fetchData = async () => {
    try {
      const q = query(collection(db, 'lekplatser'));
      const snap = await getDocs(q);
      setAllPlaygrounds(snap.docs.map(d => ({ id: d.id, ...d.data() })));

      if (userId) {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          setFavoriteIds(userDoc.data()?.favorites || []);
          setIsAdmin(!!userDoc.data()?.isAdmin);
        }
      }
    } catch (e) { console.error(e); }
  };

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchData().then(() => setLoading(false));
  }, [userId]));

  const toggleFavorite = async (id) => {
    if (!userId) return;
    const userRef = doc(db, 'users', userId);
    const isFav = favoriteIds.includes(id);
    
    setFavoriteIds(prev => isFav ? prev.filter(fid => fid !== id) : [...prev, id]);

    try {
      await updateDoc(userRef, {
        favorites: isFav ? arrayRemove(id) : arrayUnion(id)
      });
    } catch (e) { fetchData(); }
  };

  const filtered = useMemo(() => {
    let list = allPlaygrounds.filter(p => p.status !== 'review');
    
    // Favoritfilter
    if (showFavoritesOnly) list = list.filter(p => favoriteIds.includes(p.id));
    
    // Sökfilter
    const q = searchQuery.toLowerCase().trim();
    if (q) list = list.filter(p => (p.namn || '').toLowerCase().includes(q) || (p.adress || '').toLowerCase().includes(q));
    
    // Betygfilter
    if (minRating > 0) {
      list = list.filter(p => (p.snittbetyg || 0) >= minRating);
    }
    
    // Kommunfilter
    if (selectedKommun) {
      list = list.filter(p => p.kommun === selectedKommun);
    }
    
    // Sortering
    if (sortBy === 'rating') {
      list = list.sort((a, b) => (b.snittbetyg || 0) - (a.snittbetyg || 0));
    } else if (sortBy === 'distance' && userLocation) {
      list = list.sort((a, b) => {
        const posA = parsePosition(a.position);
        const posB = parsePosition(b.position);
        if (!posA) return 1;
        if (!posB) return -1;
        const distA = calculateDistance(userLocation, posA);
        const distB = calculateDistance(userLocation, posB);
        return distA - distB;
      });
    } else if (sortBy === 'name') {
      list = list.sort((a, b) => (a.namn || '').localeCompare(b.namn || '', 'sv'));
    }
    
    return list;
  }, [searchQuery, allPlaygrounds, showFavoritesOnly, favoriteIds, sortBy, minRating, userLocation, selectedKommun]);

  // Zooma till kommun när den väljs och kartvyn är aktiv
  useEffect(() => {
    if (selectedKommun && viewMode === 'map' && mapRef.current && filtered.length > 0) {
      const firstInKommun = filtered[0];
      const pos = parsePosition(firstInKommun.position);
      if (pos) {
        mapRef.current.animateToRegion(
          {
            ...pos,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          },
          1000,
        );
      }
    }
  }, [selectedKommun, viewMode, filtered]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" /></View>;

  const hasActiveFilters = sortBy !== 'none' || minRating > 0 || selectedKommun !== null;
  
  console.log('Filter modal visible:', filterModalVisible);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <SearchHeader 
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        viewMode={viewMode} setViewMode={setViewMode}
        isAdmin={isAdmin} navigation={navigation}
        showFavoritesOnly={showFavoritesOnly} setShowFavoritesOnly={setShowFavoritesOnly}
        onOpenFilterSort={() => {
          console.log('Opening filter modal...');
          setFilterModalVisible(true);
        }}
        sortBy={sortBy}
        hasActiveFilters={hasActiveFilters}
      />

      <FilterSortModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        sortBy={sortBy}
        setSortBy={setSortBy}
        minRating={minRating}
        setMinRating={setMinRating}
        selectedKommun={selectedKommun}
        setSelectedKommun={setSelectedKommun}
        kommuner={kommuner}
      />
      
      {viewMode === 'list' ? (
        <FlatList
          data={filtered}
          numColumns={2}
          renderItem={({ item }) => (
            <PlaygroundCard 
                item={item} 
                isFavorite={favoriteIds.includes(item.id)} 
                onToggleFavorite={toggleFavorite}
                userLocation={userLocation}
            />
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: theme.space.xl * 2, paddingHorizontal: 6 }}
          ListFooterComponent={<AddPlaygroundFooter navigation={navigation} />}
        />
      ) : (
        <View style={{ flex: 1, padding: 16 }}>
          <MapView 
            ref={mapRef}
            style={[styles.mapContainer, mapStyle.containerStyle]}
            customMapStyle={mapStyle.customMapStyle}
            initialRegion={userLocation 
              ? { ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }
              : { latitude: 57.72, longitude: 12.94, latitudeDelta: 0.05, longitudeDelta: 0.05 }
            }
            showsUserLocation={true}
            showsMyLocationButton={true}
          >
            {filtered.map(pg => {
              const imageUrl = pg.bildUrl || pg.imageUrl || FALLBACK_IMG;
              const payload = toPlaygroundPayload({ ...pg, bildUrl: imageUrl }, pg.id);
              const isSelected = selectedPlayground?.id === pg.id;
              
              return (
                <Marker 
                  key={pg.id} 
                  coordinate={parsePosition(pg.position) || {latitude:0, longitude:0}}
                  anchor={{ x: 0.5, y: 1 }}
                  onPress={() => setSelectedPlayground({ ...pg, imageUrl, payload })}
                >
                  <MaterialCommunityIcons 
                    name="seesaw" 
                    size={isSelected ? 42 : 36} 
                    color={mapStyle.markerColor} 
                  />
                </Marker>
              );
            })}
          </MapView>

          {selectedPlayground && (
            <View style={styles.playgroundInfoOverlay}>
              <TouchableOpacity 
                style={{
                  position: 'absolute',
                  top: -10,
                  right: -10,
                  zIndex: 1001,
                  backgroundColor: theme.colors.cardBg,
                  borderRadius: 20,
                }}
                onPress={() => setSelectedPlayground(null)}
              >
                <Ionicons name="close-circle" size={32} color={theme.colors.primary} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                activeOpacity={0.9}
                onPress={() => {
                  navigation.navigate('PlaygroundDetails', { 
                    playground: selectedPlayground.payload, 
                    id: selectedPlayground.payload.id 
                  });
                  setSelectedPlayground(null);
                }}
                style={[{
                  backgroundColor: theme.colors.cardBg,
                  borderRadius: 20,
                  overflow: 'hidden',
                  elevation: 10,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 10,
                  borderWidth: 3,
                }, { borderColor: theme.colors.primary }]}
              >
                <Image 
                  source={{ uri: selectedPlayground.imageUrl }} 
                  style={{ width: '100%', height: 180, backgroundColor: theme.colors.bgSoft }}
                  resizeMode="cover"
                />
                <View style={{ padding: 16, backgroundColor: theme.colors.cardBg }}>
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.colors.text, marginBottom: 8 }} numberOfLines={2}>
                    {selectedPlayground.namn || 'Lekplats'}
                  </Text>
                  {!!selectedPlayground.adress && (
                    <Text style={{ fontSize: 15, color: theme.colors.textMuted, marginBottom: 10, lineHeight: 20 }} numberOfLines={2}>
                      {selectedPlayground.adress}
                    </Text>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="star" size={18} color={theme.colors.star} />
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.text }}>
                      {(selectedPlayground.snittbetyg || 0).toFixed(1)}
                    </Text>
                  </View>
                </View>
                <View style={[styles.playgroundInfoButton, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.playgroundInfoButtonText}>Gå till lekplats</Text>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.primaryTextOn} />
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

// Static styles that don't need theme
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cardContainer: { flex: 0.5, margin: 6, height: 200, borderRadius: 20, overflow: 'hidden', elevation: 3 },
  cardOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },
  favoriteBadge: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 15, width: 30, height: 30, justifyContent: 'center', alignItems: 'center' },
  ratingBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3, flexDirection: 'row', alignItems: 'center' },
  ratingText: { color: '#fff', fontSize: 11, fontWeight: 'bold', marginLeft: 3 },
  cardTextContent: { position: 'absolute', bottom: 12, left: 12, right: 12 },
  cardTitle: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  cardSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },
  distanceBadge: { position: 'absolute', bottom: 0, right: 0, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 },
  distanceText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  modeBtn: { padding: 8, borderRadius: 10 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingBottom: 10 },
  filterBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  mapContainer: { flex: 1 },
  playgroundInfoOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  playgroundInfoButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8
  },
  playgroundInfoButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdropTouchable: {
    flex: 1,
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 20,
  },
  modalSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    gap: 12,
  },
  optionText: {
    fontSize: 15,
    flex: 1,
    fontWeight: '500',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginTop: 8,
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
  },
  applyButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SearchScreen;