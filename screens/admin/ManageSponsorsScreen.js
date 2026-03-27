// ManageSponsorsScreen.js
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Image, ActivityIndicator, Alert, Modal, ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { File as ExpoFile } from 'expo-file-system';
import { ref, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../../firebase';
import { useTheme } from '../../src/theme';
import { Card } from '../../src/ui';

const LEVELS = [
  { key: 'brons',  label: '🥉 Brons',  desc: 'Pop-up vid incheckning' },
  { key: 'silver', label: '🥈 Silver', desc: '+ Visas på lekplatssidan' },
  { key: 'guld',   label: '🥇 Guld',   desc: '+ Badge i sökresultaten' },
];

export default function ManageSponsorsScreen() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('sponsors'); // 'sponsors' | 'link'

  // Sponsors
  const [sponsors, setSponsors] = useState([]);
  const [loadingSponsors, setLoadingSponsors] = useState(true);

  // Lekplatser (för koppling)
  const [playgrounds, setPlaygrounds] = useState([]);
  const [pgSearch, setPgSearch] = useState('');
  const [loadingPg, setLoadingPg] = useState(true);

  // Modal: skapa/redigera sponsor
  const [sponsorModal, setSponsorModal] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState(null);
  const [form, setForm] = useState({ name: '', website: '', address: '', description: '' });
  const [logoUri, setLogoUri] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Statistik-tab
  const [statsSelectedSponsorId, setStatsSelectedSponsorId] = useState(null);
  const [statsPreset, setStatsPreset] = useState('30d');
  const [statsFromDate, setStatsFromDate] = useState('');
  const [statsToDate, setStatsToDate] = useState('');
  const [statsData, setStatsData] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);

  // Modal: koppla sponsor till lekplats
  const [linkModal, setLinkModal] = useState(false);
  const [selectedPg, setSelectedPg] = useState(null);
  const [selectedSponsor, setSelectedSponsor] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState('brons');
  const [linking, setLinking] = useState(false);

  const fetchData = useCallback(async () => {
    setLoadingSponsors(true);
    setLoadingPg(true);
    try {
      const [sSnap, pgSnap] = await Promise.all([
        getDocs(collection(db, 'sponsors')),
        getDocs(query(collection(db, 'lekplatser'), where('status', '==', 'publicerad'))),
      ]);
      setSponsors(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setPlaygrounds(pgSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Fel vid hämtning:', e);
    } finally {
      setLoadingSponsors(false);
      setLoadingPg(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const getPresetDates = (preset) => {
    const today = new Date();
    const to = today.toISOString().split('T')[0];
    const from = new Date(today);
    if (preset === '7d')   from.setDate(today.getDate() - 6);
    else if (preset === '14d')  from.setDate(today.getDate() - 13);
    else if (preset === '30d')  from.setDate(today.getDate() - 29);
    else if (preset === '90d')  from.setDate(today.getDate() - 89);
    else if (preset === '365d') from.setDate(today.getDate() - 364);
    return { from: from.toISOString().split('T')[0], to };
  };

  const fetchStats = useCallback(async (sponsorId, from, to) => {
    if (!sponsorId || !from || !to) return;
    setStatsLoading(true);
    try {
      const q = query(
        collection(db, 'sponsors', sponsorId, 'stats'),
        where('date', '>=', from),
        where('date', '<=', to),
        orderBy('date', 'desc')
      );
      const snap = await getDocs(q);
      setStatsData(snap.docs.map(d => d.data()));
    } catch (e) {
      console.error('Fel vid hämtning av sponsor-statistik:', e);
      setStatsData([]);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'stats' || !statsSelectedSponsorId) return;
    if (statsPreset !== 'custom') {
      const { from, to } = getPresetDates(statsPreset);
      fetchStats(statsSelectedSponsorId, from, to);
    } else if (statsFromDate && statsToDate) {
      fetchStats(statsSelectedSponsorId, statsFromDate, statsToDate);
    }
  }, [activeTab, statsSelectedSponsorId, statsPreset, statsFromDate, statsToDate, fetchStats]);

  // --- Bilduppladdning ---
  const uploadBase64 = async (storageRef, base64Data) => {
    const bucket = 'lekplatsen-907fb.firebasestorage.app';
    const encodedPath = encodeURIComponent(storageRef.fullPath);
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}`;
    const token = await auth.currentUser?.getIdToken();
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`${xhr.status}`));
      xhr.onerror = () => reject(new Error('XHR error'));
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'image/jpeg');
      xhr.setRequestHeader('X-Goog-Upload-Protocol', 'raw');
      if (token) xhr.setRequestHeader('Authorization', `Firebase ${token}`);
      xhr.send(bytes);
    });
  };

  const pickLogo = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) { Alert.alert('Åtkomst nekad'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (!result.canceled) setLogoUri(result.assets[0].uri);
  };

  const uploadLogo = async (sponsorId) => {
    if (!logoUri) return null;
    setUploading(true);
    try {
      const file = new ExpoFile(logoUri);
      const base64Data = await file.base64();
      const storageRef = ref(storage, `sponsors/${sponsorId}/logo`);
      await uploadBase64(storageRef, base64Data);
      return await getDownloadURL(storageRef);
    } finally {
      setUploading(false);
    }
  };

  // --- Sponsor CRUD ---
  const openNewSponsor = () => {
    setEditingSponsor(null);
    setForm({ name: '', website: '', address: '', description: '' });
    setLogoUri(null);
    setSponsorModal(true);
  };

  const openEditSponsor = (sponsor) => {
    setEditingSponsor(sponsor);
    setForm({ name: sponsor.name || '', website: sponsor.website || '', address: sponsor.address || '', description: sponsor.description || '' });
    setLogoUri(null);
    setSponsorModal(true);
  };

  const saveSponsor = async () => {
    if (!form.name.trim()) { Alert.alert('Fyll i företagsnamn'); return; }
    setSaving(true);
    try {
      if (editingSponsor) {
        let logoUrl = editingSponsor.logoUrl || '';
        if (logoUri) logoUrl = await uploadLogo(editingSponsor.id) || logoUrl;
        await updateDoc(doc(db, 'sponsors', editingSponsor.id), { ...form, logoUrl });
        setSponsors(prev => prev.map(s => s.id === editingSponsor.id ? { ...s, ...form, logoUrl } : s));
      } else {
        const newRef = await addDoc(collection(db, 'sponsors'), {
          ...form, logoUrl: '', createdAt: serverTimestamp(),
        });
        const logoUrl = logoUri ? await uploadLogo(newRef.id) || '' : '';
        if (logoUrl) await updateDoc(doc(db, 'sponsors', newRef.id), { logoUrl });
        setSponsors(prev => [...prev, { id: newRef.id, ...form, logoUrl }]);
      }
      setSponsorModal(false);
    } catch (e) {
      console.error('Fel vid sparande av sponsor:', e);
      Alert.alert('Fel', 'Kunde inte spara sponsorn.');
    } finally {
      setSaving(false);
    }
  };

  const deleteSponsor = (sponsor) => {
    Alert.alert('Ta bort sponsor', `Ta bort "${sponsor.name}"?`, [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Ta bort', style: 'destructive', onPress: async () => {
        await deleteDoc(doc(db, 'sponsors', sponsor.id));
        setSponsors(prev => prev.filter(s => s.id !== sponsor.id));
      }},
    ]);
  };

  // --- Länka sponsor till lekplats ---
  const openLinkModal = (pg) => {
    setSelectedPg(pg);
    const existing = pg.sponsorship;
    setSelectedSponsor(existing?.sponsorId ? sponsors.find(s => s.id === existing.sponsorId) || null : null);
    setSelectedLevel(existing?.level || 'brons');
    setLinkModal(true);
  };

  const saveLink = async () => {
    if (!selectedSponsor) { Alert.alert('Välj en sponsor'); return; }
    setLinking(true);
    try {
      await updateDoc(doc(db, 'lekplatser', selectedPg.id), {
        sponsorship: { sponsorId: selectedSponsor.id, level: selectedLevel, active: true },
      });
      setPlaygrounds(prev => prev.map(pg =>
        pg.id === selectedPg.id
          ? { ...pg, sponsorship: { sponsorId: selectedSponsor.id, level: selectedLevel, active: true } }
          : pg
      ));
      setLinkModal(false);
    } catch (e) {
      Alert.alert('Fel', 'Kunde inte spara kopplingen.');
    } finally {
      setLinking(false);
    }
  };

  const removeLink = async (pg) => {
    Alert.alert('Ta bort koppling', `Ta bort sponsorns koppling till "${pg.namn}"?`, [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Ta bort', style: 'destructive', onPress: async () => {
        await updateDoc(doc(db, 'lekplatser', pg.id), { sponsorship: null });
        setPlaygrounds(prev => prev.map(p => p.id === pg.id ? { ...p, sponsorship: null } : p));
      }},
    ]);
  };

  const filteredPlaygrounds = playgrounds.filter(pg =>
    (pg.namn || '').toLowerCase().includes(pgSearch.toLowerCase())
  );

  const styles = getStyles(theme);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      {/* Tabs */}
      <View style={styles.tabRow}>
        {[{ key: 'sponsors', label: 'Sponsorer' }, { key: 'link', label: 'Koppla' }, { key: 'stats', label: 'Statistik' }].map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setActiveTab(t.key)}
            style={[styles.tab, activeTab === t.key && { borderBottomColor: theme.colors.primary, borderBottomWidth: 3 }]}
          >
            <Text style={[styles.tabText, activeTab === t.key && { color: theme.colors.primary }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* === SPONSORER-VY === */}
      {activeTab === 'sponsors' && (
        <>
          <TouchableOpacity style={styles.addBtn} onPress={openNewSponsor}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 6 }}>Lägg till sponsor</Text>
          </TouchableOpacity>
          {loadingSponsors ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />
          ) : (
            <FlatList
              data={sponsors}
              keyExtractor={s => s.id}
              contentContainerStyle={{ padding: theme.space.md, paddingBottom: 120 }}
              ListEmptyComponent={<Text style={styles.empty}>Inga sponsors ännu.</Text>}
              renderItem={({ item }) => (
                <Card style={{ padding: theme.space.md, marginBottom: theme.space.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {item.logoUrl ? (
                      <Image source={{ uri: item.logoUrl }} style={styles.logo} />
                    ) : (
                      <View style={[styles.logo, { backgroundColor: theme.colors.bgSoft, alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="business-outline" size={22} color={theme.colors.textMuted} />
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontWeight: '700', color: theme.colors.text, fontSize: 15 }}>{item.name}</Text>
                      {item.website ? <Text style={{ color: theme.colors.primary, fontSize: 12 }}>{item.website}</Text> : null}
                      {item.description ? <Text style={{ color: theme.colors.textMuted, fontSize: 12 }} numberOfLines={2}>{item.description}</Text> : null}
                    </View>
                    <TouchableOpacity onPress={() => openEditSponsor(item)} style={{ padding: 6 }}>
                      <Ionicons name="pencil-outline" size={20} color={theme.colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteSponsor(item)} style={{ padding: 6 }}>
                      <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
                    </TouchableOpacity>
                  </View>
                </Card>
              )}
            />
          )}
        </>
      )}

      {/* === KOPPLA-VY === */}
      {activeTab === 'link' && (
        <>
          <TextInput
            style={styles.searchInput}
            placeholder="Sök lekplats..."
            placeholderTextColor={theme.colors.textMuted}
            value={pgSearch}
            onChangeText={setPgSearch}
          />
          {loadingPg ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />
          ) : (
            <FlatList
              data={filteredPlaygrounds}
              keyExtractor={pg => pg.id}
              contentContainerStyle={{ padding: theme.space.md, paddingBottom: 120 }}
              ListEmptyComponent={<Text style={styles.empty}>Inga lekplatser hittades.</Text>}
              renderItem={({ item }) => {
                const sp = item.sponsorship;
                const sponsorName = sp?.active ? sponsors.find(s => s.id === sp.sponsorId)?.name : null;
                return (
                  <Card style={{ padding: theme.space.md, marginBottom: theme.space.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', color: theme.colors.text }}>{item.namn}</Text>
                        {sponsorName ? (
                          <Text style={{ color: theme.colors.primary, fontSize: 12, marginTop: 2 }}>
                            {LEVELS.find(l => l.key === sp.level)?.label} · {sponsorName}
                          </Text>
                        ) : (
                          <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>Ingen sponsor</Text>
                        )}
                      </View>
                      <TouchableOpacity onPress={() => openLinkModal(item)} style={styles.linkBtn}>
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
                          {sponsorName ? 'Ändra' : 'Koppla'}
                        </Text>
                      </TouchableOpacity>
                      {sponsorName && (
                        <TouchableOpacity onPress={() => removeLink(item)} style={{ padding: 6, marginLeft: 4 }}>
                          <Ionicons name="close-circle-outline" size={20} color={theme.colors.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </Card>
                );
              }}
            />
          )}
        </>
      )}

      {/* === STATISTIK-VY === */}
      {activeTab === 'stats' && (() => {
        const statsTotals = statsData.reduce(
          (acc, d) => ({
            badgeImpressions: acc.badgeImpressions + (d.badgeImpressions || 0),
            popupOpens:       acc.popupOpens       + (d.popupOpens       || 0),
            hittaHitClicks:   acc.hittaHitClicks   + (d.hittaHitClicks   || 0),
            websiteClicks:    acc.websiteClicks     + (d.websiteClicks    || 0),
          }),
          { badgeImpressions: 0, popupOpens: 0, hittaHitClicks: 0, websiteClicks: 0 }
        );
        const PRESETS = [
          { key: '7d',   label: '7 dagar' },
          { key: '14d',  label: '14 dagar' },
          { key: '30d',  label: '30 dagar' },
          { key: '90d',  label: '3 mån' },
          { key: '365d', label: '1 år' },
          { key: 'custom', label: 'Eget' },
        ];
        return (
          <ScrollView contentContainerStyle={{ padding: theme.space.md, paddingBottom: 120 }}>
            {/* Välj sponsor */}
            <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginBottom: 6, fontWeight: '700', textTransform: 'uppercase' }}>Välj sponsor</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {sponsors.map(s => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setStatsSelectedSponsorId(s.id)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
                    backgroundColor: statsSelectedSponsorId === s.id ? theme.colors.primary : theme.colors.bgSoft,
                  }}
                >
                  <Text style={{ color: statsSelectedSponsorId === s.id ? '#fff' : theme.colors.text, fontWeight: '600', fontSize: 13 }}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Välj period */}
            <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginBottom: 6, fontWeight: '700', textTransform: 'uppercase' }}>Period</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {PRESETS.map(p => (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => setStatsPreset(p.key)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
                    backgroundColor: statsPreset === p.key ? theme.colors.primary : theme.colors.bgSoft,
                  }}
                >
                  <Text style={{ color: statsPreset === p.key ? '#fff' : theme.colors.text, fontWeight: '600', fontSize: 13 }}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Eget datumintervall */}
            {statsPreset === 'custom' && (
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                <TextInput
                  style={[styles.input, { flex: 1, color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.inputBg || theme.colors.bg }]}
                  placeholder="Från (ÅÅÅÅ-MM-DD)"
                  placeholderTextColor={theme.colors.textMuted}
                  value={statsFromDate}
                  onChangeText={setStatsFromDate}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, { flex: 1, color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.inputBg || theme.colors.bg }]}
                  placeholder="Till (ÅÅÅÅ-MM-DD)"
                  placeholderTextColor={theme.colors.textMuted}
                  value={statsToDate}
                  onChangeText={setStatsToDate}
                  keyboardType="numeric"
                />
              </View>
            )}

            {!statsSelectedSponsorId ? (
              <Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 32 }}>Välj en sponsor ovan för att se statistik.</Text>
            ) : statsLoading ? (
              <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 32 }} />
            ) : (
              <>
                {/* Summering för perioden */}
                <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginBottom: 8, fontWeight: '700', textTransform: 'uppercase' }}>Totalt för perioden</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                  {[
                    { label: 'Badgevisningar', value: statsTotals.badgeImpressions, icon: 'star-outline' },
                    { label: 'Popups',         value: statsTotals.popupOpens,       icon: 'information-circle-outline' },
                    { label: 'Hitta hit',      value: statsTotals.hittaHitClicks,   icon: 'navigate-outline' },
                    { label: 'Hemsida',        value: statsTotals.websiteClicks,    icon: 'globe-outline' },
                  ].map(m => (
                    <View key={m.label} style={{ flex: 1, minWidth: '45%', backgroundColor: theme.colors.bgSoft, borderRadius: 14, padding: 14, alignItems: 'center' }}>
                      <Ionicons name={m.icon} size={22} color={theme.colors.primary} />
                      <Text style={{ fontSize: 26, fontWeight: '800', color: theme.colors.text, marginTop: 4 }}>{m.value}</Text>
                      <Text style={{ fontSize: 11, color: theme.colors.textMuted, textAlign: 'center' }}>{m.label}</Text>
                    </View>
                  ))}
                </View>

                {/* Per-dag lista */}
                <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginBottom: 8, fontWeight: '700', textTransform: 'uppercase' }}>Per dag</Text>
                {statsData.length === 0 ? (
                  <Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 16 }}>Ingen data för vald period.</Text>
                ) : (
                  statsData.map(d => (
                    <View key={d.date} style={{ backgroundColor: theme.colors.bgSoft, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                      <Text style={{ fontWeight: '700', color: theme.colors.text, marginBottom: 6 }}>{d.date}</Text>
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}><Text style={{ fontWeight: '700', color: theme.colors.text }}>{d.badgeImpressions || 0}</Text> badge</Text>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}><Text style={{ fontWeight: '700', color: theme.colors.text }}>{d.popupOpens || 0}</Text> popup</Text>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}><Text style={{ fontWeight: '700', color: theme.colors.text }}>{d.hittaHitClicks || 0}</Text> hitta hit</Text>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}><Text style={{ fontWeight: '700', color: theme.colors.text }}>{d.websiteClicks || 0}</Text> webb</Text>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}
          </ScrollView>
        );
      })()}

      {/* === MODAL: Skapa/Redigera sponsor === */}
      <Modal visible={sponsorModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {editingSponsor ? 'Redigera sponsor' : 'Ny sponsor'}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity style={styles.logoPicker} onPress={pickLogo}>
                {logoUri || editingSponsor?.logoUrl ? (
                  <Image source={{ uri: logoUri || editingSponsor?.logoUrl }} style={styles.logoPreview} />
                ) : (
                  <Ionicons name="image-outline" size={32} color={theme.colors.textMuted} />
                )}
                <Text style={{ color: theme.colors.primary, marginTop: 6, fontSize: 13 }}>Välj logotyp</Text>
              </TouchableOpacity>
              {['name', 'website', 'address', 'description'].map(field => (
                <TextInput
                  key={field}
                  style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.inputBg || theme.colors.bg }]}
                  placeholder={
                    field === 'name' ? 'Företagsnamn *' :
                    field === 'website' ? 'Webbplats (https://...)' :
                    field === 'address' ? 'Besöksadress' :
                    'Kort beskrivning'
                  }
                  placeholderTextColor={theme.colors.textMuted}
                  value={form[field]}
                  onChangeText={v => setForm(p => ({ ...p, [field]: v }))}
                  multiline={field === 'description'}
                  autoCapitalize={field === 'website' ? 'none' : 'sentences'}
                />
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: theme.colors.bgSoft }]} onPress={() => setSponsorModal(false)}>
                <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: theme.colors.primary, flex: 2 }]} onPress={saveSponsor} disabled={saving || uploading}>
                {(saving || uploading) ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Spara</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* === MODAL: Koppla sponsor till lekplats === */}
      <Modal visible={linkModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Koppla sponsor till{'\n'}{selectedPg?.namn}
            </Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginBottom: 8 }}>Välj sponsor</Text>
            <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
              {sponsors.map(s => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setSelectedSponsor(s)}
                  style={[styles.selectRow, selectedSponsor?.id === s.id && { backgroundColor: theme.colors.primarySoft }]}
                >
                  {s.logoUrl ? <Image source={{ uri: s.logoUrl }} style={{ width: 28, height: 28, borderRadius: 4, marginRight: 8 }} /> : null}
                  <Text style={{ color: theme.colors.text, fontWeight: '600' }}>{s.name}</Text>
                  {selectedSponsor?.id === s.id && <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginTop: 12, marginBottom: 8 }}>Välj nivå</Text>
            {LEVELS.map(l => (
              <TouchableOpacity
                key={l.key}
                onPress={() => setSelectedLevel(l.key)}
                style={[styles.selectRow, selectedLevel === l.key && { backgroundColor: theme.colors.primarySoft }]}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '600', flex: 1 }}>{l.label}</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{l.desc}</Text>
                {selectedLevel === l.key && <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} style={{ marginLeft: 8 }} />}
              </TouchableOpacity>
            ))}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: theme.colors.bgSoft }]} onPress={() => setLinkModal(false)}>
                <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: theme.colors.primary, flex: 2 }]} onPress={saveLink} disabled={linking}>
                {linking ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Spara koppling</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (theme) => StyleSheet.create({
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: theme.space.sm, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabText: { fontWeight: '700', fontSize: 13, color: theme.colors.textMuted },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: theme.space.md, height: 44, borderRadius: theme.radius.md, backgroundColor: theme.colors.primary },
  logo: { width: 48, height: 48, borderRadius: 8 },
  empty: { textAlign: 'center', color: theme.colors.textMuted, marginTop: 40 },
  searchInput: { margin: theme.space.md, height: 44, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: theme.space.md, color: theme.colors.text, backgroundColor: theme.colors.inputBg || theme.colors.card },
  linkBtn: { paddingHorizontal: 14, height: 32, borderRadius: theme.radius.md, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  logoPicker: { alignItems: 'center', justifyContent: 'center', height: 100, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, marginBottom: 12, borderStyle: 'dashed' },
  logoPreview: { width: 80, height: 80, borderRadius: 8 },
  input: { height: 48, borderWidth: 1, borderRadius: theme.radius.md, paddingHorizontal: 14, marginBottom: 10, fontSize: 15 },
  modalBtn: { flex: 1, height: 46, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  selectRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: theme.radius.md, marginBottom: 4 },
});
