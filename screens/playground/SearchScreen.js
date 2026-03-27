import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ImageBackground,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';

import { auth, db } from '../../firebase';
import { doc, getDoc, collection, getDocs, query } from 'firebase/firestore';

import { useTheme, mapStyle } from '../../src/theme';
import { Card as UICard, Chip, Input } from '../../src/ui';
import { parsePosition, calculateDistance, formatDistance } from '../../utils/geo';
import { enrichPlaygroundsWithImages } from '../../src/services/feedService';
import PlaygroundCard from '../../src/components/PlaygroundCard';
import { useRef } from 'react';

const FALLBACK_IMG = 'https://firebasestorage.googleapis.com/v0/b/lekplatsen-907fb.firebasestorage.app/o/bild%20saknas.png?alt=media&token=3acbfa69-dea8-456b-bbe2-dd95034f773f';

const DISTANCE_OPTIONS = [
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
];

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
    imageUrl: src.resolvedImageUrl || src.bildUrl || src.imageUrl || '',
    equipment: src.utrustning || src.equipment || [],
    location,
  };
};

/* ----------------------------- Header ----------------------------- */
const SearchHeader = memo(({
  searchQuery, setSearchQuery,
  viewMode, setViewMode,
  showFavoritesOnly, setShowFavoritesOnly,
  onOpenFilterSort,
  hasActiveFilters, filteredCount,
  // Aktiva filter för chip-raden
  sortBy,
  minRating, onRemoveMinRating,
  selectedKommun, onRemoveKommun,
  maxDistance, onRemoveMaxDistance,
  selectedEquipment, onRemoveEquipment,
}) => {
  const { theme } = useTheme();

  const activeChips = [];
  if (minRating > 0) activeChips.push({ key: 'rating', label: `⭐ ${minRating}+`, onRemove: onRemoveMinRating });
  if (maxDistance) {
    const opt = DISTANCE_OPTIONS.find(o => o.value === maxDistance);
    activeChips.push({ key: 'distance', label: `📍 ${opt?.label || '?'}`, onRemove: onRemoveMaxDistance });
  }
  if (selectedKommun) activeChips.push({ key: 'kommun', label: selectedKommun, onRemove: onRemoveKommun });
  selectedEquipment.forEach(eq => activeChips.push({ key: `eq-${eq}`, label: eq, onRemove: () => onRemoveEquipment(eq) }));
  if (sortBy && sortBy !== 'none') {
    const sortLabel = sortBy === 'rating' ? 'Betyg ↓' : sortBy === 'distance' ? 'Avstånd ↑' : 'Namn A-Ö';
    activeChips.push({ key: 'sort', label: sortLabel, onRemove: null }); // sort kan ej tas bort via chip
  }

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: theme.colors.text }}>
          {showFavoritesOnly ? 'Sparade favoriter' : 'Alla lekplatser'}
        </Text>
        <Text style={{ fontSize: 14, color: theme.colors.textMuted, fontWeight: '600' }}>
          {filteredCount} st
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10 }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Input
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Sök namn, adress eller utrustning..."
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
          onPress={onOpenFilterSort}
          style={[styles.filterBtn, { backgroundColor: hasActiveFilters ? theme.colors.primary : theme.colors.bgSoft }]}
          activeOpacity={0.7}
        >
          <Ionicons name="options" size={20} color={hasActiveFilters ? theme.colors.primaryTextOn : theme.colors.textMuted} />
          {hasActiveFilters && (
            <View style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.accent }} />
          )}
        </TouchableOpacity>

      </View>

      {/* Aktiva filter-chips */}
      {activeChips.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
          {activeChips.map(chip => (
            <TouchableOpacity
              key={chip.key}
              onPress={chip.onRemove || undefined}
              activeOpacity={chip.onRemove ? 0.7 : 1}
              style={[styles.activeChip, { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary }]}
            >
              <Text style={{ color: theme.colors.primaryStrong || theme.colors.primary, fontWeight: '700', fontSize: 13 }}>
                {chip.label}
              </Text>
              {chip.onRemove && (
                <Ionicons name="close" size={14} color={theme.colors.primaryStrong || theme.colors.primary} style={{ marginLeft: 4 }} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
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

/* ------------------------- Filter & Sorteringsmodal ------------------------- */
const FilterSortModal = memo(({
  visible, onClose,
  sortBy, setSortBy,
  minRating, setMinRating,
  selectedKommun, setSelectedKommun, kommuner,
  maxDistance, setMaxDistance,
  selectedEquipment, setSelectedEquipment, allEquipment,
}) => {
  const { theme } = useTheme();
  const [expandedSection, setExpandedSection] = useState(null);

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

  const toggleEquipment = (eq) => {
    if (selectedEquipment.includes(eq)) {
      setSelectedEquipment(selectedEquipment.filter(e => e !== eq));
    } else {
      setSelectedEquipment([...selectedEquipment, eq]);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <TouchableOpacity style={styles.modalBackdropTouchable} activeOpacity={1} onPress={onClose} />
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
              <TouchableOpacity onPress={() => toggleSection('sort')} style={[styles.sectionHeader, { borderBottomColor: theme.colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="swap-vertical" size={20} color={theme.colors.text} style={{ marginRight: 8 }} />
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Sortera efter</Text>
                  {sortBy !== 'none' && <View style={styles.activeDot(theme)} />}
                </View>
                <Ionicons name={expandedSection === 'sort' ? 'chevron-up' : 'chevron-down'} size={24} color={theme.colors.textMuted} />
              </TouchableOpacity>
              {expandedSection === 'sort' && (
                <View style={{ paddingTop: 8 }}>
                  {sortOptions.map(option => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setSortBy(option.value)}
                      style={[styles.optionButton, { backgroundColor: sortBy === option.value ? theme.colors.primary : theme.colors.bgSoft, borderColor: sortBy === option.value ? theme.colors.primary : theme.colors.border }]}
                    >
                      <Ionicons name={option.icon} size={20} color={sortBy === option.value ? theme.colors.primaryTextOn : theme.colors.textMuted} />
                      <Text style={[styles.optionText, { color: sortBy === option.value ? theme.colors.primaryTextOn : theme.colors.text }]}>{option.label}</Text>
                      {sortBy === option.value && <Ionicons name="checkmark-circle" size={20} color={theme.colors.primaryTextOn} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Betyg */}
            <View style={styles.modalSection}>
              <TouchableOpacity onPress={() => toggleSection('rating')} style={[styles.sectionHeader, { borderBottomColor: theme.colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="star" size={20} color={theme.colors.star} style={{ marginRight: 8 }} />
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Filtrera betyg</Text>
                  {minRating > 0 && <View style={styles.activeDot(theme)} />}
                </View>
                <Ionicons name={expandedSection === 'rating' ? 'chevron-up' : 'chevron-down'} size={24} color={theme.colors.textMuted} />
              </TouchableOpacity>
              {expandedSection === 'rating' && (
                <View style={{ paddingTop: 8 }}>
                  {ratingOptions.map(option => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setMinRating(option.value)}
                      style={[styles.optionButton, { backgroundColor: minRating === option.value ? theme.colors.primary : theme.colors.bgSoft, borderColor: minRating === option.value ? theme.colors.primary : theme.colors.border }]}
                    >
                      <Ionicons name="star" size={20} color={minRating === option.value ? theme.colors.primaryTextOn : theme.colors.star} />
                      <Text style={[styles.optionText, { color: minRating === option.value ? theme.colors.primaryTextOn : theme.colors.text }]}>{option.label}</Text>
                      {minRating === option.value && <Ionicons name="checkmark-circle" size={20} color={theme.colors.primaryTextOn} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Avstånd */}
            <View style={styles.modalSection}>
              <TouchableOpacity onPress={() => toggleSection('distance')} style={[styles.sectionHeader, { borderBottomColor: theme.colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="navigate-outline" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Max avstånd</Text>
                  {maxDistance && <View style={styles.activeDot(theme)} />}
                </View>
                <Ionicons name={expandedSection === 'distance' ? 'chevron-up' : 'chevron-down'} size={24} color={theme.colors.textMuted} />
              </TouchableOpacity>
              {expandedSection === 'distance' && (
                <View style={{ paddingTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setMaxDistance(null)}
                    style={[styles.distanceChip, { backgroundColor: !maxDistance ? theme.colors.primary : theme.colors.bgSoft, borderColor: !maxDistance ? theme.colors.primary : theme.colors.border }]}
                  >
                    <Text style={{ color: !maxDistance ? theme.colors.primaryTextOn : theme.colors.text, fontWeight: '700' }}>Alla</Text>
                  </TouchableOpacity>
                  {DISTANCE_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setMaxDistance(opt.value)}
                      style={[styles.distanceChip, { backgroundColor: maxDistance === opt.value ? theme.colors.primary : theme.colors.bgSoft, borderColor: maxDistance === opt.value ? theme.colors.primary : theme.colors.border }]}
                    >
                      <Text style={{ color: maxDistance === opt.value ? theme.colors.primaryTextOn : theme.colors.text, fontWeight: '700' }}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Utrustning */}
            {allEquipment.length > 0 && (
              <View style={styles.modalSection}>
                <TouchableOpacity onPress={() => toggleSection('equipment')} style={[styles.sectionHeader, { borderBottomColor: theme.colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="seesaw" size={20} color={theme.colors.text} style={{ marginRight: 8 }} />
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Utrustning</Text>
                    {selectedEquipment.length > 0 && <View style={styles.activeDot(theme)} />}
                  </View>
                  <Ionicons name={expandedSection === 'equipment' ? 'chevron-up' : 'chevron-down'} size={24} color={theme.colors.textMuted} />
                </TouchableOpacity>
                {expandedSection === 'equipment' && (
                  <View style={{ paddingTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {allEquipment.map(eq => {
                      const selected = selectedEquipment.includes(eq);
                      return (
                        <TouchableOpacity
                          key={eq}
                          onPress={() => toggleEquipment(eq)}
                          style={[styles.equipChip, { backgroundColor: selected ? theme.colors.primary : theme.colors.bgSoft, borderColor: selected ? theme.colors.primary : theme.colors.border }]}
                        >
                          <Text style={{ color: selected ? theme.colors.primaryTextOn : theme.colors.text, fontWeight: '600', fontSize: 13 }}>{eq}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Kommun */}
            <View style={styles.modalSection}>
              <TouchableOpacity onPress={() => toggleSection('kommun')} style={[styles.sectionHeader, { borderBottomColor: theme.colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="location" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Filtrera kommun</Text>
                  {selectedKommun && <View style={styles.activeDot(theme)} />}
                </View>
                <Ionicons name={expandedSection === 'kommun' ? 'chevron-up' : 'chevron-down'} size={24} color={theme.colors.textMuted} />
              </TouchableOpacity>
              {expandedSection === 'kommun' && (
                <View style={{ paddingTop: 8 }}>
                  <TouchableOpacity
                    onPress={() => setSelectedKommun(null)}
                    style={[styles.optionButton, { backgroundColor: !selectedKommun ? theme.colors.primary : theme.colors.bgSoft, borderColor: !selectedKommun ? theme.colors.primary : theme.colors.border }]}
                  >
                    <Ionicons name="globe" size={20} color={!selectedKommun ? theme.colors.primaryTextOn : theme.colors.textMuted} />
                    <Text style={[styles.optionText, { color: !selectedKommun ? theme.colors.primaryTextOn : theme.colors.text }]}>Alla kommuner</Text>
                    {!selectedKommun && <Ionicons name="checkmark-circle" size={20} color={theme.colors.primaryTextOn} />}
                  </TouchableOpacity>
                  <ScrollView style={{ maxHeight: 200 }}>
                    {kommuner.map(kommun => (
                      <TouchableOpacity
                        key={kommun}
                        onPress={() => setSelectedKommun(kommun)}
                        style={[styles.optionButton, { backgroundColor: selectedKommun === kommun ? theme.colors.primary : theme.colors.bgSoft, borderColor: selectedKommun === kommun ? theme.colors.primary : theme.colors.border }]}
                      >
                        <Ionicons name="location-outline" size={20} color={selectedKommun === kommun ? theme.colors.primaryTextOn : theme.colors.textMuted} />
                        <Text style={[styles.optionText, { color: selectedKommun === kommun ? theme.colors.primaryTextOn : theme.colors.text }]}>{kommun}</Text>
                        {selectedKommun === kommun && <Ionicons name="checkmark-circle" size={20} color={theme.colors.primaryTextOn} />}
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
                setMaxDistance(null);
                setSelectedEquipment([]);
              }}
              style={[styles.resetButton, { backgroundColor: theme.colors.bgSoft, borderColor: theme.colors.border }]}
            >
              <Ionicons name="refresh" size={20} color={theme.colors.textMuted} />
              <Text style={[styles.resetButtonText, { color: theme.colors.textMuted }]}>Rensa alla filter</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: theme.colors.border }]}>
            <TouchableOpacity onPress={onClose} style={[styles.applyButton, { backgroundColor: theme.colors.primary }]}>
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
  const [allPlaygrounds, setAllPlaygrounds] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedPlayground, setSelectedPlayground] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortBy, setSortBy] = useState('none');
  const [minRating, setMinRating] = useState(0);
  const [selectedKommun, setSelectedKommun] = useState(null);
  const [maxDistance, setMaxDistance] = useState(null);
  const [selectedEquipment, setSelectedEquipment] = useState([]);

  const userId = auth.currentUser?.uid;
  const mapRef = useRef(null);

  const kommuner = useMemo(() => {
    return [...new Set(allPlaygrounds.map(p => p.kommun).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'sv'));
  }, [allPlaygrounds]);

  const allEquipment = useMemo(() => {
    const set = new Set();
    allPlaygrounds.forEach(p => (p.utrustning || []).forEach(e => set.add(e)));
    return [...set].sort((a, b) => a.localeCompare(b, 'sv'));
  }, [allPlaygrounds]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
      } catch (e) {
        console.warn('Kunde inte hämta position:', e);
      }
    })();
  }, []);

  useEffect(() => {
    if (userLocation && mapRef.current && viewMode === 'map') {
      mapRef.current.animateToRegion({ ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 1000);
    }
  }, [userLocation, viewMode]);

  const fetchData = async () => {
    try {
      const [snap, sponsorSnap] = await Promise.all([
        getDocs(query(collection(db, 'lekplatser'))),
        getDocs(collection(db, 'sponsors')),
      ]);
      const sponsorMap = {};
      sponsorSnap.docs.forEach(d => { sponsorMap[d.id] = { id: d.id, ...d.data() }; });
      const raw = snap.docs.map(d => {
        const data = d.data();
        const sponsorData = data.sponsorship?.active && data.sponsorship?.sponsorId
          ? sponsorMap[data.sponsorship.sponsorId] || null
          : null;
        return { id: d.id, ...data, sponsorName: sponsorData?.name || null, sponsorData };
      });
      const enriched = await enrichPlaygroundsWithImages(raw);
      setAllPlaygrounds(enriched);

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

  const filtered = useMemo(() => {
    let list = allPlaygrounds.filter(p => p.status !== 'review');

    if (showFavoritesOnly) list = list.filter(p => favoriteIds.includes(p.id));

    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(p =>
        (p.namn || '').toLowerCase().includes(q) ||
        (p.adress || '').toLowerCase().includes(q) ||
        (p.utrustning || []).some(e => e.toLowerCase().includes(q))
      );
    }

    if (minRating > 0) list = list.filter(p => (p.snittbetyg || 0) >= minRating);

    if (selectedKommun) list = list.filter(p => p.kommun === selectedKommun);

    if (selectedEquipment.length > 0) {
      list = list.filter(p =>
        selectedEquipment.every(eq => (p.utrustning || []).includes(eq))
      );
    }

    if (maxDistance && userLocation) {
      list = list.filter(p => {
        const pos = parsePosition(p.position);
        if (!pos) return false;
        return calculateDistance(userLocation, pos) <= maxDistance;
      });
    }

    if (sortBy === 'rating') {
      list = list.sort((a, b) => (b.snittbetyg || 0) - (a.snittbetyg || 0));
    } else if (sortBy === 'distance' && userLocation) {
      list = list.sort((a, b) => {
        const posA = parsePosition(a.position);
        const posB = parsePosition(b.position);
        if (!posA) return 1;
        if (!posB) return -1;
        return calculateDistance(userLocation, posA) - calculateDistance(userLocation, posB);
      });
    } else if (sortBy === 'name') {
      list = list.sort((a, b) => (a.namn || '').localeCompare(b.namn || '', 'sv'));
    }

    return list;
  }, [searchQuery, allPlaygrounds, showFavoritesOnly, favoriteIds, sortBy, minRating, userLocation, selectedKommun, maxDistance, selectedEquipment]);

  useEffect(() => {
    if (selectedKommun && viewMode === 'map' && mapRef.current && filtered.length > 0) {
      const pos = parsePosition(filtered[0].position);
      if (pos) mapRef.current.animateToRegion({ ...pos, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 1000);
    }
  }, [selectedKommun, viewMode, filtered]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" /></View>;

  const hasActiveFilters = sortBy !== 'none' || minRating > 0 || selectedKommun !== null || maxDistance !== null || selectedEquipment.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <SearchHeader
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        viewMode={viewMode} setViewMode={setViewMode}
        showFavoritesOnly={showFavoritesOnly} setShowFavoritesOnly={setShowFavoritesOnly}
        onOpenFilterSort={() => setFilterModalVisible(true)}
        hasActiveFilters={hasActiveFilters}
        filteredCount={filtered.length}
        sortBy={sortBy}
        minRating={minRating} onRemoveMinRating={() => setMinRating(0)}
        selectedKommun={selectedKommun} onRemoveKommun={() => setSelectedKommun(null)}
        maxDistance={maxDistance} onRemoveMaxDistance={() => setMaxDistance(null)}
        selectedEquipment={selectedEquipment} onRemoveEquipment={(eq) => setSelectedEquipment(prev => prev.filter(e => e !== eq))}
      />

      <FilterSortModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        sortBy={sortBy} setSortBy={setSortBy}
        minRating={minRating} setMinRating={setMinRating}
        selectedKommun={selectedKommun} setSelectedKommun={setSelectedKommun} kommuner={kommuner}
        maxDistance={maxDistance} setMaxDistance={setMaxDistance}
        selectedEquipment={selectedEquipment} setSelectedEquipment={setSelectedEquipment} allEquipment={allEquipment}
      />

      {viewMode === 'list' ? (
        <FlatList
          data={filtered}
          numColumns={2}
          renderItem={({ item }) => (
            <PlaygroundCard
              item={item}
              userLocation={userLocation}
              style={{ flex: 0.5, margin: 6, height: 200 }}
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
              const imageUrl = pg.resolvedImageUrl || pg.bildUrl || pg.imageUrl || FALLBACK_IMG;
              const payload = toPlaygroundPayload({ ...pg, bildUrl: imageUrl }, pg.id);
              const isSelected = selectedPlayground?.id === pg.id;
              const isGoldSponsor = pg.sponsorship?.active && pg.sponsorship?.level === 'guld';
              return (
                <Marker
                  key={pg.id}
                  coordinate={parsePosition(pg.position) || { latitude: 0, longitude: 0 }}
                  anchor={{ x: 0.5, y: 1 }}
                  onPress={() => setSelectedPlayground({ ...pg, imageUrl, payload })}
                >
                  <View style={{ alignItems: 'center' }}>
                    {isGoldSponsor && (
                      <View style={{ backgroundColor: 'rgba(140,100,0,0.9)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, marginBottom: 2 }}>
                        <Text style={{ color: '#FFD700', fontSize: 9, fontWeight: '800' }}>★ {pg.sponsorName || 'Sponsor'}</Text>
                      </View>
                    )}
                    <MaterialCommunityIcons
                      name="seesaw"
                      size={isSelected ? 42 : 36}
                      color={isGoldSponsor ? '#FFD700' : mapStyle.markerColor}
                    />
                  </View>
                </Marker>
              );
            })}
          </MapView>

          {selectedPlayground && (
            <View style={styles.playgroundInfoOverlay}>
              <TouchableOpacity
                style={{ position: 'absolute', top: -10, right: -10, zIndex: 1001, backgroundColor: theme.colors.cardBg, borderRadius: 20 }}
                onPress={() => setSelectedPlayground(null)}
              >
                <Ionicons name="close-circle" size={32} color={theme.colors.primary} />
              </TouchableOpacity>

              <View style={{ backgroundColor: theme.colors.cardBg, borderRadius: 20, overflow: 'hidden', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, borderWidth: 3, borderColor: theme.colors.primary }}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    navigation.navigate('PlaygroundDetails', { playground: selectedPlayground.payload, id: selectedPlayground.payload.id });
                    setSelectedPlayground(null);
                  }}
                >
                  <ImageBackground source={{ uri: selectedPlayground.imageUrl }} style={{ width: '100%', height: 160, backgroundColor: theme.colors.bgSoft }} resizeMode="cover">
                    <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' }} />

                    {/* Sponsor-badge uppe till vänster */}
                    {!!selectedPlayground.sponsorName && (
                      <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(140,100,0,0.85)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Ionicons name="star" size={11} color="#FFD700" />
                        <Text style={{ color: '#FFD700', fontSize: 11, fontWeight: '800' }}>{selectedPlayground.sponsorName}</Text>
                      </View>
                    )}

                    {/* Betyg uppe till höger */}
                    <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="star" size={12} color={theme.colors.star} />
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{(selectedPlayground.snittbetyg || 0).toFixed(1)}</Text>
                    </View>

                    {/* Avstånd nere till höger */}
                    {userLocation && selectedPlayground.position && (() => {
                      const pos = parsePosition(selectedPlayground.position);
                      const dist = pos ? formatDistance(calculateDistance(userLocation, pos)) : null;
                      return dist ? (
                        <View style={{ position: 'absolute', bottom: 10, right: 10, backgroundColor: theme.colors.success || '#4caf50', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Ionicons name="navigate" size={10} color="#fff" />
                          <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{dist}</Text>
                        </View>
                      ) : null;
                    })()}
                  </ImageBackground>

                  <View style={{ padding: 14, backgroundColor: theme.colors.cardBg }}>
                    <Text style={{ fontSize: 19, fontWeight: 'bold', color: theme.colors.text, marginBottom: 4 }} numberOfLines={2}>
                      {selectedPlayground.namn || 'Lekplats'}
                    </Text>
                    {!!selectedPlayground.adress && (
                      <Text style={{ fontSize: 14, color: theme.colors.textMuted, marginBottom: 4, lineHeight: 20 }} numberOfLines={1}>
                        {selectedPlayground.adress}
                      </Text>
                    )}
                    {!!selectedPlayground.beskrivning && (
                      <Text style={{ fontSize: 13, color: theme.colors.textMuted, lineHeight: 18 }} numberOfLines={3}>
                        {selectedPlayground.beskrivning}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Knappar */}
                <View style={{ flexDirection: 'row' }}>
                  <TouchableOpacity
                    onPress={() => {
                      navigation.navigate('CheckIn', { playgroundId: selectedPlayground.id });
                      setSelectedPlayground(null);
                    }}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 6, backgroundColor: theme.colors.primarySoft }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="location" size={18} color={theme.colors.primary} />
                    <Text style={{ color: theme.colors.primary, fontWeight: '800', fontSize: 15 }}>Checka in</Text>
                  </TouchableOpacity>
                  <View style={{ width: 1, backgroundColor: theme.colors.border }} />
                  <TouchableOpacity
                    onPress={() => {
                      navigation.navigate('PlaygroundDetails', { playground: selectedPlayground.payload, id: selectedPlayground.payload.id });
                      setSelectedPlayground(null);
                    }}
                    style={[styles.playgroundInfoButton, { flex: 1, backgroundColor: theme.colors.primary }]}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.playgroundInfoButtonText}>Visa mer</Text>
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.primaryTextOn} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modeBtn: { padding: 8, borderRadius: 10 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingBottom: 10 },
  filterBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  mapContainer: { flex: 1 },
  playgroundInfoOverlay: { position: 'absolute', bottom: 20, left: 20, right: 20, zIndex: 1000 },
  playgroundInfoButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  playgroundInfoButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBackdropTouchable: { flex: 1 },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalBody: { padding: 20 },
  modalSection: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingBottom: 12, borderBottomWidth: 1 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold' },
  optionButton: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, gap: 12 },
  optionText: { fontSize: 15, flex: 1, fontWeight: '500' },
  distanceChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  equipChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  resetButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, borderWidth: 1, gap: 8, marginTop: 8 },
  resetButtonText: { fontSize: 15, fontWeight: '600' },
  modalFooter: { padding: 20, borderTopWidth: 1 },
  applyButton: { padding: 16, borderRadius: 12, alignItems: 'center' },
  applyButtonText: { fontSize: 16, fontWeight: 'bold' },
  activeDot: (theme) => ({ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary, marginLeft: 8 }),
});

export default SearchScreen;
