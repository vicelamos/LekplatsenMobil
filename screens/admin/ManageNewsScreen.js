import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Switch,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  query,
} from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useTheme } from '../../src/theme';

const TYPER = [
  { value: 'admin', label: 'Nyhet' },
  { value: 'ny_lekplats', label: 'Ny lekplats' },
];

const EMPTY_FORM = {
  titel: '',
  innehall: '',
  bildUrl: '',
  typ: 'admin',
  lekplatsId: '',
  publicerad: false,
};

export default function ManageNewsScreen() {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [nyheter, setNyheter] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchNyheter = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'nyheter'), orderBy('skapadAt', 'desc')));
      setNyheter(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Fel vid hämtning av nyheter:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNyheter(); }, [fetchNyheter]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };

  const openEdit = (nyhet) => {
    setEditingId(nyhet.id);
    setForm({
      titel: nyhet.titel || '',
      innehall: nyhet.innehall || '',
      bildUrl: nyhet.bildUrl || '',
      typ: nyhet.typ || 'admin',
      lekplatsId: nyhet.lekplatsId || '',
      publicerad: nyhet.publicerad || false,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.titel.trim()) {
      Alert.alert('Fält saknas', 'Ange en titel.');
      return;
    }
    setSaving(true);
    try {
      const data = {
        titel: form.titel.trim(),
        innehall: form.innehall.trim(),
        bildUrl: form.bildUrl.trim(),
        typ: form.typ,
        lekplatsId: form.lekplatsId.trim(),
        publicerad: form.publicerad,
      };
      if (editingId) {
        await updateDoc(doc(db, 'nyheter', editingId), data);
      } else {
        await addDoc(collection(db, 'nyheter'), {
          ...data,
          skapadAv: auth.currentUser?.uid || '',
          skapadAt: serverTimestamp(),
        });
      }
      setModalVisible(false);
      fetchNyheter();
    } catch (e) {
      console.error('Fel vid sparande:', e);
      Alert.alert('Fel', 'Kunde inte spara nyheten.');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (nyhet) => {
    try {
      await updateDoc(doc(db, 'nyheter', nyhet.id), { publicerad: !nyhet.publicerad });
      setNyheter(prev => prev.map(n => n.id === nyhet.id ? { ...n, publicerad: !n.publicerad } : n));
    } catch (e) {
      Alert.alert('Fel', 'Kunde inte uppdatera publiceringsstatus.');
    }
  };

  const handleDelete = (nyhet) => {
    Alert.alert('Ta bort nyhet', `Vill du ta bort "${nyhet.titel}"?`, [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Ta bort', style: 'destructive', onPress: async () => {
          try {
            await deleteDoc(doc(db, 'nyheter', nyhet.id));
            setNyheter(prev => prev.filter(n => n.id !== nyhet.id));
          } catch (e) {
            Alert.alert('Fel', 'Kunde inte ta bort nyheten.');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }) => (
    <View style={[styles.newsItem, { backgroundColor: theme.colors.cardBg, borderColor: theme.colors.border }]}>
      <View style={styles.newsItemHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.newsItemTitle, { color: theme.colors.text }]} numberOfLines={1}>
            {item.titel}
          </Text>
          <Text style={[styles.newsItemMeta, { color: theme.colors.textMuted }]}>
            {item.typ === 'ny_lekplats' ? 'Ny lekplats' : 'Nyhet'} •{' '}
            {item.skapadAt?.toDate?.().toLocaleDateString('sv-SE') || '–'}
          </Text>
        </View>
        <View style={[styles.publishBadge, { backgroundColor: item.publicerad ? '#d4edda' : theme.colors.bgSoft }]}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: item.publicerad ? '#155724' : theme.colors.textMuted }}>
            {item.publicerad ? 'Publicerad' : 'Utkast'}
          </Text>
        </View>
      </View>
      {!!item.innehall && (
        <Text style={[styles.newsItemContent, { color: theme.colors.textMuted }]} numberOfLines={2}>
          {item.innehall}
        </Text>
      )}
      <View style={styles.newsItemActions}>
        <TouchableOpacity
          onPress={() => handleTogglePublish(item)}
          style={[styles.actionBtn, { borderColor: theme.colors.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name={item.publicerad ? 'eye-off-outline' : 'eye-outline'} size={16} color={theme.colors.text} />
          <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>
            {item.publicerad ? 'Avpublicera' : 'Publicera'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => openEdit(item)}
          style={[styles.actionBtn, { borderColor: theme.colors.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil-outline" size={16} color={theme.colors.primary} />
          <Text style={[styles.actionBtnText, { color: theme.colors.primary }]}>Redigera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDelete(item)}
          style={[styles.actionBtn, { borderColor: theme.colors.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={16} color="#e53935" />
          <Text style={[styles.actionBtnText, { color: '#e53935' }]}>Ta bort</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.bg }]}>
      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={nyheter}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', color: theme.colors.textMuted, marginTop: 40 }}>
              Inga nyheter ännu.
            </Text>
          }
        />
      )}

      {/* Lägg till-knapp */}
      <TouchableOpacity style={[styles.fab, { backgroundColor: theme.colors.primary }]} onPress={openCreate} activeOpacity={0.8}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Form-modal */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={26} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {editingId ? 'Redigera nyhet' : 'Ny nyhet'}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color={theme.colors.primary} />
                : <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 16 }}>Spara</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 16 }}>
            {/* Typ */}
            <Text style={[styles.label, { color: theme.colors.text }]}>Typ</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              {TYPER.map(t => (
                <TouchableOpacity
                  key={t.value}
                  onPress={() => setForm(f => ({ ...f, typ: t.value }))}
                  style={[
                    styles.typBtn,
                    {
                      backgroundColor: form.typ === t.value ? theme.colors.primary : theme.colors.bgSoft,
                      borderColor: form.typ === t.value ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: form.typ === t.value ? '#fff' : theme.colors.text, fontWeight: '700' }}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Titel */}
            <Text style={[styles.label, { color: theme.colors.text }]}>Titel *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.bgSoft, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={form.titel}
              onChangeText={v => setForm(f => ({ ...f, titel: v }))}
              placeholder="Nyhetens rubrik"
              placeholderTextColor={theme.colors.textMuted}
            />

            {/* Innehåll */}
            <Text style={[styles.label, { color: theme.colors.text }]}>Innehåll</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: theme.colors.bgSoft, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={form.innehall}
              onChangeText={v => setForm(f => ({ ...f, innehall: v }))}
              placeholder="Beskrivande text..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />

            {/* Bild-URL */}
            <Text style={[styles.label, { color: theme.colors.text }]}>Bild-URL (valfri)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.bgSoft, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={form.bildUrl}
              onChangeText={v => setForm(f => ({ ...f, bildUrl: v }))}
              placeholder="https://..."
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              keyboardType="url"
            />
            {!!form.bildUrl && (
              <Image
                source={{ uri: form.bildUrl }}
                style={{ width: '100%', height: 140, borderRadius: 10, marginBottom: 16, backgroundColor: theme.colors.bgSoft }}
                resizeMode="cover"
              />
            )}

            {/* LekplatsId */}
            <Text style={[styles.label, { color: theme.colors.text }]}>Lekplats-ID (valfri)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.bgSoft, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={form.lekplatsId}
              onChangeText={v => setForm(f => ({ ...f, lekplatsId: v }))}
              placeholder="Firestore-dokumentets ID"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
            />

            {/* Publicerad */}
            <View style={[styles.switchRow, { borderTopColor: theme.colors.border }]}>
              <Text style={[styles.label, { color: theme.colors.text, marginBottom: 0 }]}>Publicera direkt</Text>
              <Switch
                value={form.publicerad}
                onValueChange={v => setForm(f => ({ ...f, publicerad: v }))}
                trackColor={{ true: theme.colors.primary }}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    safeArea: { flex: 1 },
    newsItem: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
    },
    newsItemHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 6,
    },
    newsItemTitle: {
      fontSize: 16,
      fontWeight: '700',
    },
    newsItemMeta: {
      fontSize: 12,
      marginTop: 2,
    },
    newsItemContent: {
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 10,
    },
    publishBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    newsItemActions: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      gap: 4,
    },
    actionBtnText: {
      fontSize: 13,
      fontWeight: '600',
    },
    fab: {
      position: 'absolute',
      bottom: 30,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    label: {
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      marginBottom: 16,
    },
    textArea: {
      height: 110,
    },
    typBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 16,
      marginTop: 8,
      borderTopWidth: 1,
    },
  });
