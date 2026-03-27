import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useTheme } from '../../src/theme';
import { Card } from '../../src/ui';

function ReviewDraftsScreen({ navigation }) {
  const { theme } = useTheme();
  const [drafts, setDrafts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('drafts');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [draftSnap, suggestSnap] = await Promise.all([
        getDocs(query(collection(db, 'lekplatser'), where('status', '==', 'review'))),
        getDocs(query(collection(db, 'andringsforslag'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'))),
      ]);
      setDrafts(draftSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setSuggestions(suggestSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Kunde inte hämta data:', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const approve = (item) => {
    Alert.alert('Godkänn lekplats', `Vill du publicera "${item.namn}"?`, [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Godkänn',
        onPress: async () => {
          try {
            await updateDoc(doc(db, 'lekplatser', item.id), {
              status: 'publicerad',
            });
            if (item.createdBy) {
              await addDoc(
                collection(db, 'users', item.createdBy, 'notifications'),
                {
                  type: 'PLAYGROUND_APPROVED',
                  title: 'Lekplats godkänd!',
                  message: `Din lekplats "${item.namn}" har godkänts och är nu publicerad.`,
                  read: false,
                  createdAt: serverTimestamp(),
                  link: `/lekplats/${item.id}`,
                }
              );
            }
            setDrafts((prev) => prev.filter((d) => d.id !== item.id));
          } catch (e) {
            Alert.alert('Fel', 'Kunde inte godkänna lekplatsen.');
          }
        },
      },
    ]);
  };

  const reject = (item) => {
    Alert.alert(
      'Neka lekplats',
      `Vill du ta bort "${item.namn}"? Detta går inte att ångra.`,
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Ta bort',
          style: 'destructive',
          onPress: async () => {
            try {
              if (item.createdBy) {
                await addDoc(
                  collection(db, 'users', item.createdBy, 'notifications'),
                  {
                    type: 'PLAYGROUND_REJECTED',
                    title: 'Lekplats nekad',
                    message: `Din lekplats "${item.namn}" godkändes tyvärr inte.`,
                    read: false,
                    createdAt: serverTimestamp(),
                  }
                );
              }
              await deleteDoc(doc(db, 'lekplatser', item.id));
              setDrafts((prev) => prev.filter((d) => d.id !== item.id));
            } catch (e) {
              Alert.alert('Fel', 'Kunde inte ta bort lekplatsen.');
            }
          },
        },
      ]
    );
  };

  const markSuggestion = async (item, newStatus) => {
    try {
      await updateDoc(doc(db, 'andringsforslag', item.id), {
        status: newStatus,
      });
      if (item.userId) {
        const statusText = newStatus === 'done' ? 'genomförts' : 'avfärdats';
        await addDoc(
          collection(db, 'users', item.userId, 'notifications'),
          {
            type: 'SUGGESTION_UPDATE',
            title: newStatus === 'done' ? 'Ändringsförslag genomfört!' : 'Ändringsförslag avfärdat',
            message: `Ditt förslag för "${item.lekplatsNamn}" har ${statusText}.`,
            read: false,
            createdAt: serverTimestamp(),
            link: `/lekplats/${item.lekplatsId}`,
          }
        );
      }
      setSuggestions((prev) => prev.filter((s) => s.id !== item.id));
    } catch (e) {
      Alert.alert('Fel', 'Kunde inte uppdatera förslaget.');
    }
  };

  const styles = getStyles(theme);

  const renderDraft = ({ item }) => (
    <Card style={styles.card}>
      {item.bildUrl ? (
        <Image source={{ uri: item.bildUrl }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Ionicons name="image-outline" size={32} color={theme.colors.textMuted} />
        </View>
      )}

      <View style={styles.info}>
        <Text style={styles.namn} numberOfLines={1}>
          {item.namn}
        </Text>
        {item.adress ? (
          <Text style={styles.adress} numberOfLines={1}>
            {item.adress}
          </Text>
        ) : null}
        {item.kommun ? (
          <Text style={styles.kommun} numberOfLines={1}>
            {item.kommun}
          </Text>
        ) : null}
        {item.beskrivning ? (
          <Text style={styles.beskrivning} numberOfLines={2}>
            {item.beskrivning}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => approve(item)}
            style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
          >
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Godkänn</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              navigation.navigate('PlaygroundDetails', { id: item.id })
            }
            style={[styles.actionBtn, { backgroundColor: theme.colors.info }]}
          >
            <Ionicons name="eye" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Visa</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => reject(item)}
            style={[styles.actionBtn, { backgroundColor: theme.colors.danger }]}
          >
            <Ionicons name="close-circle" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Neka</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

  const renderSuggestion = ({ item }) => (
    <Card style={{ padding: theme.space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.space.xs }}>
        <Ionicons name="location" size={16} color={theme.colors.primary} style={{ marginRight: 6 }} />
        <Text style={{ fontWeight: '800', color: theme.colors.text, flex: 1 }} numberOfLines={1}>
          {item.lekplatsNamn}
        </Text>
      </View>
      <Text style={{ color: theme.colors.text, lineHeight: 20, marginBottom: theme.space.sm }}>
        {item.message}
      </Text>
      <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginBottom: theme.space.sm }}>
        {item.createdAt?.toDate?.()
          ? item.createdAt.toDate().toLocaleDateString('sv-SE')
          : ''}
      </Text>
      <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('AddPlayground', { id: item.lekplatsId })
          }
          style={[styles.actionBtn, { backgroundColor: theme.colors.textMuted }]}
        >
          <Ionicons name="create" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Redigera</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            navigation.navigate('PlaygroundDetails', { id: item.lekplatsId })
          }
          style={[styles.actionBtn, { backgroundColor: theme.colors.info }]}
        >
          <Ionicons name="eye" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Visa</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => markSuggestion(item, 'done')}
          style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
        >
          <Ionicons name="checkmark-circle" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Genomfört</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => markSuggestion(item, 'dismissed')}
          style={[styles.actionBtn, { backgroundColor: theme.colors.danger }]}
        >
          <Ionicons name="close-circle" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Avfärda</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.colors.bg }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const currentData = activeTab === 'drafts' ? drafts : suggestions;
  const renderFn = activeTab === 'drafts' ? renderDraft : renderSuggestion;
  const emptyMsg =
    activeTab === 'drafts'
      ? 'Inga lekplatser att granska just nu.'
      : 'Inga ändringsförslag just nu.';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={22} color={theme.colors.primary} />
        <Text style={styles.headerTitle}>Admin</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          onPress={() => setActiveTab('drafts')}
          style={[styles.tab, activeTab === 'drafts' && { borderBottomColor: theme.colors.primary, borderBottomWidth: 3 }]}
        >
          <Text style={[styles.tabText, activeTab === 'drafts' && { color: theme.colors.primary }]}>
            Nya lekplatser
          </Text>
          {drafts.length > 0 && (
            <View style={[styles.badge, activeTab === 'drafts' && { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.badgeText}>{drafts.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('suggestions')}
          style={[styles.tab, activeTab === 'suggestions' && { borderBottomColor: theme.colors.primary, borderBottomWidth: 3 }]}
        >
          <Text style={[styles.tabText, activeTab === 'suggestions' && { color: theme.colors.primary }]}>
            Ändringsförslag
          </Text>
          {suggestions.length > 0 && (
            <View style={[styles.badge, activeTab === 'suggestions' && { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.badgeText}>{suggestions.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('ManageSponsors')}
          style={[styles.tab]}
        >
          <Text style={[styles.tabText]}>Sponsorer</Text>
        </TouchableOpacity>
      </View>

      {currentData.length === 0 ? (
        <View style={styles.center}>
          <Ionicons
            name={activeTab === 'drafts' ? 'checkmark-done-circle-outline' : 'chatbubble-ellipses-outline'}
            size={56}
            color={theme.colors.textMuted}
          />
          <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
            {emptyMsg}
          </Text>
        </View>
      ) : (
        <FlatList
          data={currentData}
          keyExtractor={(item) => item.id}
          renderItem={renderFn}
          contentContainerStyle={{ padding: theme.space.md, paddingBottom: theme.space.xl * 2 }}
          ItemSeparatorComponent={() => <View style={{ height: theme.space.sm }} />}
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.md,
      gap: theme.space.xs,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.text,
      flex: 1,
    },
    tabRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.space.sm,
      gap: 6,
      borderBottomWidth: 3,
      borderBottomColor: 'transparent',
    },
    tabText: {
      fontWeight: '700',
      fontSize: 14,
      color: theme.colors.textMuted,
    },
    badge: {
      backgroundColor: theme.colors.textMuted,
      borderRadius: 12,
      minWidth: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    badgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
    card: {
      padding: 0,
      overflow: 'hidden',
    },
    image: {
      width: '100%',
      height: 160,
      backgroundColor: theme.colors.bgSoft,
    },
    imagePlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: {
      padding: theme.space.md,
    },
    namn: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.colors.text,
    },
    adress: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    kommun: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    beskrivning: {
      fontSize: 14,
      color: theme.colors.text,
      marginTop: theme.space.xs,
    },
    actions: {
      flexDirection: 'row',
      gap: theme.space.sm,
      marginTop: theme.space.md,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      height: 40,
      borderRadius: theme.radius.md,
    },
    actionBtnText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 13,
    },
    emptyText: {
      marginTop: theme.space.md,
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
    },
  });

export default ReviewDraftsScreen;

