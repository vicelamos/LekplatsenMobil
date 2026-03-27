import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { Card, Chip } from '../ui';
import FullscreenImageModal from './FullscreenImageModal';
import { auth, db } from '../../firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';

const REPORT_REASONS = [
  'Olämpligt innehåll',
  'Spam',
  'Stötande språk',
  'Felaktig information',
  'Annat',
];

export const CheckInCard = ({ item, playgroundName, onPressComments }) => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const userId = auth.currentUser?.uid;

  // States för interaktion
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLiked, setIsLiked] = useState(item.likes?.includes(userId) || false);
  const [likeCount, setLikeCount] = useState(item.likes?.length || 0);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedReason, setSelectedReason] = useState(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const hasExtraContent = 
    (item.gjordaAktiviteter?.length > 0) || 
    (item.klaradeUtmaningar?.length > 0) || 
    (item.taggadeVanner?.length > 0);

  const date = item.timestamp?.toDate
    ? item.timestamp.toDate().toLocaleDateString('sv-SE')
    : '';

  const handleSubmitReport = async () => {
    if (!selectedReason || isSubmittingReport) return;
    setIsSubmittingReport(true);
    try {
      await addDoc(collection(db, 'rapporter'), {
        type: 'checkin',
        itemId: item.id,
        reportedUserId: item.userId,
        reportedByUserId: userId,
        reason: selectedReason,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setReportModalVisible(false);
      setSelectedReason(null);
      Alert.alert('Tack', 'Din rapport har skickats och granskas av en administratör.');
    } catch {
      Alert.alert('Fel', 'Kunde inte skicka rapporten. Försök igen.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleLike = async () => {
    if (!userId) return;
    const checkInRef = doc(db, 'incheckningar', item.id);
    if (isLiked) {
      setIsLiked(false);
      setLikeCount(prev => prev - 1);
      await updateDoc(checkInRef, { likes: arrayRemove(userId) });
    } else {
      setIsLiked(true);
      setLikeCount(prev => prev + 1);
      await updateDoc(checkInRef, { likes: arrayUnion(userId) });
    }
  };

  return (
    <Card style={styles.card}>
      {/* Header: Profil och Lekplats */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => navigation.navigate('PublicProfile', { userId: item.userId })}
        >
          <Image 
            source={{ uri: item.profilbildUrl || `https://ui-avatars.com/api/?name=${item.userSmeknamn}` }} 
            style={[styles.avatar, { backgroundColor: theme.colors.bgSoft }]} 
          />
          <Text style={[styles.userName, { color: theme.colors.text }]}>{item.userSmeknamn || 'Användare'}</Text>
        </TouchableOpacity>

        {playgroundName && (
          <TouchableOpacity onPress={() => navigation.navigate('PlaygroundDetails', { id: item.lekplatsId })}>
            <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 13 }}>@ {playgroundName}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Innehåll */}
      {item.kommentar ? <Text style={[styles.comment, { color: theme.colors.text }]}>{item.kommentar}</Text> : null}
      {item.bildUrl ? (
        <TouchableOpacity activeOpacity={0.9} onPress={() => setFullscreenImage(item.bildUrl)}>
          <Image source={{ uri: item.bildUrl }} style={[styles.mainImage, { backgroundColor: theme.colors.bgSoft }]} resizeMode="cover" />
        </TouchableOpacity>
      ) : null}

      <FullscreenImageModal
        visible={!!fullscreenImage}
        imageUrl={fullscreenImage}
        onClose={() => setFullscreenImage(null)}
      />

      {/* Expanderbar del */}
      {isExpanded && (
        <View style={[styles.expandedSection, { borderTopColor: theme.colors.border }]}>
          {item.gjordaAktiviteter?.length > 0 && (
            <View style={styles.tagSection}>
              <Text style={[styles.tagTitle, { color: theme.colors.textMuted }]}>Gjorda aktiviteter:</Text>
              <View style={styles.chipsContainer}>
                {item.gjordaAktiviteter.map((a, i) => <Chip key={i} label={a} />)}
              </View>
            </View>
          )}

          {item.klaradeUtmaningar?.length > 0 && (
            <View style={styles.tagSection}>
              <Text style={[styles.tagTitle, { color: theme.colors.textMuted }]}>Klarade utmaningar:</Text>
              <View style={styles.chipsContainer}>
                {item.klaradeUtmaningar.map((u, i) => (
                  <Chip key={i} label={u} icon="trophy-outline" />
                ))}
              </View>
            </View>
          )}

          {item.taggadeVanner?.length > 0 && (
            <View style={styles.friendsRow}>
              <Ionicons name="people-outline" size={14} color={theme.colors.textMuted} />
              <Text style={[styles.friendsText, { color: theme.colors.textMuted }]}>Med: {item.taggadeVanner.join(', ')}</Text>
            </View>
          )}
        </View>
      )}

      {/* Footer: Stats & Likes */}
      <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
        <View style={styles.statsGroup}>
          <View style={styles.statItem}>
            <Ionicons name="star" size={16} color={theme.colors.star} />
            <Text style={[styles.statText, { color: theme.colors.textMuted }]}>{item.betyg || 0}</Text>
          </View>
          {item.tidPaLekplats && (
            <View style={styles.statItem}>
              <Ionicons name="time-outline" size={16} color={theme.colors.textMuted} />
              <Text style={[styles.statText, { color: theme.colors.textMuted }]}>{item.tidPaLekplats}</Text>
            </View>
          )}
          <TouchableOpacity onPress={handleLike} style={styles.statItem}>
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={18} color={isLiked ? theme.colors.danger : theme.colors.textMuted} />
            <Text style={[styles.statText, { color: theme.colors.textMuted }]}>{likeCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onPressComments?.(item)} style={styles.statItem}>
            <Ionicons name="chatbubble-outline" size={18} color={theme.colors.textMuted} />
            <Text style={[styles.statText, { color: theme.colors.textMuted }]}>{item.commentCount || 0}</Text>
          </TouchableOpacity>
          {item.userId === userId ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('EditCheckin', { checkInId: item.id, checkIn: item })}
              style={styles.statItem}
            >
              <Ionicons name="pencil-outline" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => { setSelectedReason(null); setReportModalVisible(true); }}
              style={styles.statItem}
            >
              <Ionicons name="flag-outline" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.date, { color: theme.colors.textMuted }]}>{date}</Text>
      </View>

      {/* Rapport-modal */}
      <Modal visible={reportModalVisible} transparent animationType="fade" onRequestClose={() => setReportModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setReportModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { backgroundColor: theme.colors.cardBg }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Rapportera inlägg</Text>
            <Text style={[styles.modalSubtitle, { color: theme.colors.textMuted }]}>Välj anledning</Text>
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[styles.reasonRow, { borderColor: theme.colors.border }, selectedReason === reason && { backgroundColor: theme.colors.primarySoft }]}
                onPress={() => setSelectedReason(reason)}
              >
                <Ionicons
                  name={selectedReason === reason ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={selectedReason === reason ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text style={[styles.reasonText, { color: theme.colors.text }]}>{reason}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: theme.colors.primary }, (!selectedReason || isSubmittingReport) && { opacity: 0.4 }]}
              onPress={handleSubmitReport}
              disabled={!selectedReason || isSubmittingReport}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>{isSubmittingReport ? 'Skickar...' : 'Skicka rapport'}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Visa mer knapp */}
      {hasExtraContent && (
        <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} style={styles.expandBtn}>
          <Text style={{ color: theme.colors.link, fontWeight: '700', fontSize: 13 }}>
            {isExpanded ? "Visa mindre" : "Visa mer..."}
          </Text>
        </TouchableOpacity>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 16, padding: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  userName: { fontWeight: '800', fontSize: 14 },
  comment: { fontSize: 14, marginBottom: 10, fontStyle: 'italic' },
  mainImage: { width: '100%', height: 210, borderRadius: 12, marginBottom: 10 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, borderTopWidth: 0.5, paddingTop: 10 },
  statsGroup: { flexDirection: 'row', gap: 14 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, fontWeight: '600' },
  date: { fontSize: 10 },
  expandBtn: { marginTop: 12, paddingVertical: 4, alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, marginBottom: 16 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  reasonText: { fontSize: 15 },
  submitBtn: { marginTop: 8, padding: 14, borderRadius: 12, alignItems: 'center' },
  expandedSection: { paddingVertical: 10, borderTopWidth: 0.5 },
  tagSection: { marginBottom: 12 },
  tagTitle: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  friendsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  friendsText: { fontSize: 12 }
});