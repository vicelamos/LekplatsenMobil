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
  serverTimestamp,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// 🟢 Tema & UI
import { useTheme } from '../../src/theme';
import { Card } from '../../src/ui';

/* -------------------------------------------------------------------------- */
/* Komponent: Enskild kommentar                                                */
/* -------------------------------------------------------------------------- */
const CommentCard = React.memo(({ item }) => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { user, comment } = item;

  if (!user) return null;

  const date = comment.timestamp?.toDate?.().toLocaleDateString('sv-SE') || 'Just nu';

  return (
    <Card style={{ padding: theme.space.md, marginHorizontal: theme.space.lg, marginTop: theme.space.sm }}>
      <View style={{ flexDirection: 'row' }}>
        <TouchableOpacity
          onPress={() => navigation.navigate('PublicProfile', { userId: user.uid })}
        >
          <Image
            source={{ 
              uri: user.profilbildUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.smeknamn)}&background=e0e0e0&color=777` 
            }}
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
      </View>
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
          renderItem={({ item }) => <CommentCard item={item} />}
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
  }
});