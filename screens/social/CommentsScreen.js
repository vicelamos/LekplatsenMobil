import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../firebase';
import {
  doc,
  getDoc,
  collection,
  query,
  onSnapshot,
  orderBy,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';

const REPORT_REASONS = [
  'Olämpligt innehåll',
  'Spam',
  'Stötande språk',
  'Felaktig information',
  'Annat',
];
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// 🟢 Tema & UI
import { useTheme } from '../../src/theme';
import { Card } from '../../src/ui';

/* -------------------------------------------------------------------------- */
/* Komponent: Enskild kommentar                                                */
/* -------------------------------------------------------------------------- */
const CommentCard = React.memo(({ item, checkInId, currentUserId }) => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { user, comment } = item;
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [selectedReason, setSelectedReason] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user) return null;

  const isOwn = user.uid === currentUserId;
  const date = comment.timestamp?.toDate?.().toLocaleDateString('sv-SE') || 'Just nu';

  const handleDelete = () => {
    setMenuVisible(false);
    Alert.alert('Radera kommentar', 'Är du säker?', [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Radera', style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'incheckningar', checkInId, 'comments', item.id));
          } catch {
            Alert.alert('Fel', 'Kunde inte radera kommentaren.');
          }
        },
      },
    ]);
  };

  const handleSubmitReport = async () => {
    if (!selectedReason || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'rapporter'), {
        type: 'comment',
        itemId: item.id,
        checkInId,
        reportedUserId: user.uid,
        reportedByUserId: currentUserId,
        reason: selectedReason,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setReportVisible(false);
      setSelectedReason(null);
      Alert.alert('Tack', 'Din rapport har skickats och granskas av en administratör.');
    } catch {
      Alert.alert('Fel', 'Kunde inte skicka rapporten. Försök igen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card style={{ padding: theme.space.md, marginHorizontal: theme.space.lg, marginTop: theme.space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <TouchableOpacity onPress={() => navigation.navigate('PublicProfile', { userId: user.uid })}>
          <Image
            source={{ uri: user.profilbildUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.smeknamn)}&background=e0e0e0&color=777` }}
            style={styles.avatarSmall}
          />
        </TouchableOpacity>
        <View style={{ flex: 1, paddingLeft: theme.space.sm }}>
          <TouchableOpacity onPress={() => navigation.navigate('PublicProfile', { userId: user.uid })}>
            <Text style={{ color: theme.colors.text }}>
              <Text style={{ fontWeight: '800' }}>{user.smeknamn}</Text>
              <Text style={{ color: theme.colors.textMuted }}> • {date}</Text>
            </Text>
          </TouchableOpacity>
          <Text style={{ color: theme.colors.text, marginTop: 2 }}>{comment.text}</Text>
        </View>
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={{ padding: 4 }}>
          <Ionicons name="ellipsis-horizontal" size={16} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Meny-modal */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.menuSheet, { backgroundColor: theme.colors.cardBg }]}>
            {!isOwn && (
              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setSelectedReason(null); setReportVisible(true); }}>
                <Ionicons name="flag-outline" size={20} color={theme.colors.danger} />
                <Text style={[styles.menuItemText, { color: theme.colors.danger }]}>Rapportera kommentar</Text>
              </TouchableOpacity>
            )}
            {isOwn && (
              <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
                <Text style={[styles.menuItemText, { color: theme.colors.danger }]}>Radera kommentar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.menuItem, { borderTopWidth: 0.5, borderTopColor: theme.colors.border }]} onPress={() => setMenuVisible(false)}>
              <Text style={[styles.menuItemText, { color: theme.colors.textMuted }]}>Avbryt</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Rapport-modal */}
      <Modal visible={reportVisible} transparent animationType="fade" onRequestClose={() => setReportVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setReportVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.reportSheet, { backgroundColor: theme.colors.cardBg }]}>
            <Text style={[styles.reportTitle, { color: theme.colors.text }]}>Rapportera kommentar</Text>
            <Text style={[styles.reportSubtitle, { color: theme.colors.textMuted }]}>Välj anledning</Text>
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[styles.reasonRow, { borderColor: theme.colors.border }, selectedReason === reason && { backgroundColor: theme.colors.primarySoft }]}
                onPress={() => setSelectedReason(reason)}
              >
                <Ionicons name={selectedReason === reason ? 'radio-button-on' : 'radio-button-off'} size={18} color={selectedReason === reason ? theme.colors.primary : theme.colors.textMuted} />
                <Text style={{ color: theme.colors.text, fontSize: 15 }}>{reason}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: theme.colors.primary }, (!selectedReason || isSubmitting) && { opacity: 0.4 }]}
              onPress={handleSubmitReport}
              disabled={!selectedReason || isSubmitting}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>{isSubmitting ? 'Skickar...' : 'Skicka rapport'}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Card>
  );
});

/* -------------------------------------------------------------------------- */
/* Huvudskärm: CommentsScreen                                                 */
/* -------------------------------------------------------------------------- */
export default function CommentsScreen({ route }) {
  const { theme } = useTheme();
  const { checkInId, checkInComment } = route.params;
  
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Taggnings-state
  const [friends, setFriends] = useState([]);
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [showMentionList, setShowMentionList] = useState(false);

  const userId = auth.currentUser?.uid;

  // 1. Hämta vänner för taggning vid start
  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const userSnap = await getDoc(doc(db, 'users', userId));
        if (userSnap.exists()) {
          const friendIds = userSnap.data().friends || [];
          if (friendIds.length > 0) {
            const friendDocs = await Promise.all(friendIds.map(id => getDoc(doc(db, 'users', id))));
            const friendsList = friendDocs
              .filter(d => d.exists())
              .map(d => ({ id: d.id, ...d.data() }));
            setFriends(friendsList);
          }
        }
      } catch (err) {
        console.error("Kunde inte hämta vänner:", err);
      }
    };
    fetchFriends();
  }, [userId]);

  // 2. Realtidslyssnare för kommentarer
  useEffect(() => {
    const q = query(collection(db, 'incheckningar', checkInId, 'comments'), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, async (snap) => {
      const commentsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const userIds = [...new Set(commentsData.map(c => c.userId))];
      
      if (userIds.length > 0) {
        const userDocs = await Promise.all(userIds.map(id => getDoc(doc(db, 'users', id))));
        const usersMap = {};
        userDocs.forEach(d => { if(d.exists()) usersMap[d.id] = d.data(); });
        
        setComments(commentsData.map(c => ({ 
          id: c.id, 
          comment: c, 
          user: usersMap[c.userId]
                 ? { uid: c.userId, ...usersMap[c.userId] }
                 : { uid: c.userId, smeknamn: 'Borttagen användare' } 
        })));
      } else {
        setComments([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [checkInId]);

  // 3. Hantera textändring och sök @mentions
  const handleTextChange = (text) => {
    setNewComment(text);
    const words = text.split(/\s/);
    const lastWord = words[words.length - 1];
    
    if (lastWord.startsWith('@')) {
      const queryText = lastWord.substring(1).toLowerCase();
      const matched = friends.filter(f => 
        (f.smeknamn || '').toLowerCase().includes(queryText)
      );
      setFilteredFriends(matched);
      setShowMentionList(matched.length > 0);
    } else {
      setShowMentionList(false);
    }
  };

  // 4. Välj vän från listan
  const insertMention = (friend) => {
    const words = newComment.split(/\s/);
    words.pop(); // Ta bort påbörjat @ord
    const updatedText = words.length > 0 
      ? words.join(' ') + ` @${friend.smeknamn} ` 
      : `@${friend.smeknamn} `;
    
    setNewComment(updatedText);
    setShowMentionList(false);
  };

  // 5. Skicka kommentar
  const handleSubmitComment = async () => {
    if (!newComment.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'incheckningar', checkInId, 'comments'), {
        text: newComment.trim(),
        userId,
        timestamp: serverTimestamp(),
      });
      setNewComment('');
    } catch (e) { 
      Alert.alert("Fel", "Kunde inte skicka kommentaren."); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }} 
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* LISTA MED KOMMENTARER */}
        <FlatList
          data={comments}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <CommentCard item={item} checkInId={checkInId} currentUserId={userId} />}
          ListHeaderComponent={() => (
            <Card style={styles.headerCard}>
              <Text style={{ fontStyle: 'italic', color: theme.colors.text }}>
                "{checkInComment || 'Besöksrapport'}"
              </Text>
            </Card>
          )}
          contentContainerStyle={{ paddingBottom: theme.space.xl * 2 }}
          style={{ flex: 1 }}
        />

        {/* TAGGNINGSLISTA (Placerad ovanför inmatningen) */}
        {showMentionList && (
          <View style={[
            styles.mentionList, 
            { 
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.cardBg,
              bottom: Platform.OS === 'ios' ? 85 : 75 
            }
          ]}>
            {filteredFriends.map(friend => (
              <TouchableOpacity 
                key={friend.id} 
                style={[styles.mentionItem, { borderBottomColor: theme.colors.border }]} 
                onPress={() => insertMention(friend)}
              >
                <Image 
                  source={{ 
                    uri: friend.profilbildUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.smeknamn)}&background=e0e0e0` 
                  }} 
                  style={[styles.avatarTiny, { backgroundColor: theme.colors.bgSoft }]} 
                />
                <Text style={{ color: theme.colors.text, fontWeight: '600' }}>{friend.smeknamn}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* INMATNINGSFÄLT LÄNGST NER */}
        <View style={[styles.inputWrapper, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.cardBg }]}>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input, 
                { 
                  backgroundColor: theme.colors.inputBg, 
                  borderColor: theme.colors.border, 
                  color: theme.colors.text 
                }
              ]}
              placeholder="Skriv en kommentar... prova @"
              placeholderTextColor={theme.colors.textMuted}
              value={newComment}
              onChangeText={handleTextChange}
              multiline
            />
            <TouchableOpacity 
              style={[
                styles.sendButton, 
                { backgroundColor: theme.colors.primary }, 
                (!newComment.trim() || isSubmitting) && { opacity: 0.5 }
              ]}
              onPress={handleSubmitComment}
              disabled={!newComment.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="arrow-up" size={24} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */
const styles = StyleSheet.create({
  headerCard: { 
    margin: 15, 
    padding: 15, 
    borderLeftWidth: 4, 
    borderLeftColor: '#FF8C6A',
  },
  avatarSmall: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    marginRight: 12,
  },
  avatarTiny: { 
    width: 30, 
    height: 30, 
    borderRadius: 15, 
    marginRight: 10,
  },
  inputWrapper: {
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  inputContainer: { 
    flexDirection: 'row', 
    paddingHorizontal: 12, 
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
    alignItems: 'center',
  },
  input: { 
    flex: 1, 
    minHeight: 50, 
    maxHeight: 120, 
    borderRadius: 25, 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    fontSize: 16, 
    borderWidth: 1,
  },
  sendButton: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginLeft: 10 
  },
  mentionList: { 
    position: 'absolute', 
    left: 15, 
    right: 15, 
    borderRadius: 12, 
    zIndex: 9999, 
    elevation: 20, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    borderWidth: 1, 
    maxHeight: 200,
    overflow: 'hidden',
  },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 0.5,
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  menuSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, paddingBottom: 40 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 24 },
  menuItemText: { fontSize: 16, fontWeight: '600' },
  reportSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  reportTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  reportSubtitle: { fontSize: 13, marginBottom: 16 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  submitBtn: { marginTop: 8, padding: 14, borderRadius: 12, alignItems: 'center' },
});