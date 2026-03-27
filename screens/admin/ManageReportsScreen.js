import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { useTheme } from '../../src/theme';
import { Card } from '../../src/ui';

const STATUS_FILTERS = ['Alla', 'pending', 'reviewed', 'dismissed'];
const STATUS_LABELS = { pending: 'Väntar', reviewed: 'Granskad', dismissed: 'Avvisad' };
const STATUS_COLORS = { pending: '#f59e0b', reviewed: '#10b981', dismissed: '#6b7280' };
const TYPE_LABELS = { checkin: 'Incheckning', comment: 'Kommentar' };

export default function ManageReportsScreen() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    const q = query(collection(db, 'rapporter'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredReports = filter === 'Alla' ? reports : reports.filter((r) => r.status === filter);

  const updateStatus = (id, status) => {
    Alert.alert(
      'Uppdatera status',
      `Sätt rapporten till "${STATUS_LABELS[status] ?? status}"?`,
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Bekräfta',
          onPress: async () => {
            await updateDoc(doc(db, 'rapporter', id), {
              status,
              reviewedAt: serverTimestamp(),
            });
          },
        },
      ]
    );
  };

  const renderReport = ({ item }) => {
    const statusColor = STATUS_COLORS[item.status] ?? '#6b7280';
    const date = item.createdAt?.toDate?.().toLocaleDateString('sv-SE') ?? '–';

    return (
      <Card style={styles.reportCard}>
        <View style={styles.reportHeader}>
          <View style={[styles.badge, { backgroundColor: statusColor + '22' }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>
              {STATUS_LABELS[item.status] ?? item.status}
            </Text>
          </View>
          <Text style={[styles.typeLabel, { color: theme.colors.textMuted }]}>
            {TYPE_LABELS[item.type] ?? item.type}
          </Text>
          <Text style={[styles.date, { color: theme.colors.textMuted }]}>{date}</Text>
        </View>

        <Text style={[styles.reason, { color: theme.colors.text }]}>
          <Text style={{ fontWeight: '700' }}>Anledning: </Text>{item.reason}
        </Text>
        <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
          Rapporterat objekt-ID: {item.itemId}
        </Text>
        {item.checkInId && item.checkInId !== item.itemId && (
          <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
            Incheckning: {item.checkInId}
          </Text>
        )}

        {item.status === 'pending' && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#10b981' }]}
              onPress={() => updateStatus(item.id, 'reviewed')}
            >
              <Ionicons name="checkmark" size={14} color="#fff" />
              <Text style={styles.actionBtnText}>Markera granskad</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#6b7280' }]}
              onPress={() => updateStatus(item.id, 'dismissed')}
            >
              <Ionicons name="close" size={14} color="#fff" />
              <Text style={styles.actionBtnText}>Avvisa</Text>
            </TouchableOpacity>
          </View>
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Filterrad */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && { backgroundColor: theme.colors.primary }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, { color: filter === f ? '#fff' : theme.colors.textMuted }]}>
              {STATUS_LABELS[f] ?? f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />
      ) : filteredReports.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-circle-outline" size={48} color={theme.colors.textMuted} />
          <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>Inga rapporter att visa</Text>
        </View>
      ) : (
        <FlatList
          data={filteredReports}
          keyExtractor={(item) => item.id}
          renderItem={renderReport}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.colors.bg },
    filterRow: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
    filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: theme.colors.bgSoft },
    filterText: { fontSize: 13, fontWeight: '600' },
    reportCard: { marginBottom: 12, padding: 14 },
    reportHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
    badgeText: { fontSize: 12, fontWeight: '700' },
    typeLabel: { fontSize: 12, fontWeight: '600' },
    date: { fontSize: 12, marginLeft: 'auto' },
    reason: { fontSize: 14, marginBottom: 6 },
    meta: { fontSize: 12, marginBottom: 2 },
    actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
    actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    emptyText: { fontSize: 15 },
  });
