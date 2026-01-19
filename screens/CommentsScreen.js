import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert
} from 'react-native';
import { auth, db } from '../firebase';
import {
  doc,
  getDoc,
  collection,
  query,
  onSnapshot, // Realtids-lyssnare
  orderBy,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// --- Komponent för ett enskilt kommentars-kort ---
const CommentCard = React.memo(({ item }) => {
  const { user, comment } = item;
  
  if (!user) {
    // Fallback om användardatan av någon anledning saknas
    return (
      <View style={styles.commentCard}>
        <Text style={styles.commentText}>Laddar kommentar...</Text>
      </View>
    );
  }

  const date = comment.timestamp?.toDate().toLocaleDateString('sv-SE') || 'Okänt datum';

  return (
    <View style={styles.commentCard}>
      <Image 
        source={{ uri: user.profilbildUrl || `https://placehold.co/40x40/e0e0e0/ffffff?text=${user.smeknamn?.[0] || '?'}` }} 
        style={styles.commentAvatar} 
      />
      <View style={styles.commentBody}>
        <Text style={styles.commentHeader}>
          <Text style={{fontWeight: 'bold'}}>{user.smeknamn || 'Användare'}</Text>
          <Text style={styles.commentDate}> • {date}</Text>
        </Text>
        <Text style={styles.commentText}>{comment.text}</Text>
      </View>
    </View>
  );
});

// --- Huvudkomponenten för Kommentars-skärmen ---
function CommentsScreen({ route }) {
  const { checkInId, checkInComment } = route.params; // Hämta ID från navigering
  const navigation = useNavigation();
  
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const userId = auth.currentUser?.uid;

  // --- Hämta kommentarer i realtid ---
  useEffect(() => {
    const commentsColRef = collection(db, 'incheckningar', checkInId, 'comments');
    const q = query(commentsColRef, orderBy('timestamp', 'asc')); // Äldst först

    // onSnapshot startar en realtids-lyssnare
    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      setLoading(true);
      const commentsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Berika kommentarerna med användardata
      const userIds = [...new Set(commentsData.map(c => c.userId))];
      if (userIds.length > 0) {
        const userPromises = userIds.map(id => getDoc(doc(db, 'users', id)));
        const userDocs = await Promise.all(userPromises);
        const usersMap = {};
        userDocs.forEach(docSnap => {
          if (docSnap.exists()) usersMap[docSnap.id] = docSnap.data();
        });

        const finalComments = commentsData.map(comment => ({
          id: comment.id,
          comment: comment,
          user: usersMap[comment.userId]
        }));

        setComments(finalComments);
      } else {
        setComments([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Fel vid hämtning av kommentarer:", error);
      Alert.alert("Fel", "Kunde inte ladda kommentarer.");
      setLoading(false);
    });

    // Stäng lyssnaren när komponenten lämnas
    return () => unsubscribe();
  }, [checkInId]);

  // --- Hantera inskickning av ny kommentar ---
  const handleSubmitComment = async () => {
    if (newComment.trim() === '' || !userId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const commentsColRef = collection(db, 'incheckningar', checkInId, 'comments');
      
      // Lägg till den nya kommentaren
      await addDoc(commentsColRef, {
        text: newComment.trim(),
        userId: userId,
        timestamp: serverTimestamp()
      });

      // Notera: commentCount uppdateras av din Firebase Function!
      // Notisen skickas också av din Firebase Function!
      
      setNewComment(''); // Rensa fältet
    } catch (error) {
      console.error("Fel vid skickande av kommentar:", error);
      Alert.alert("Fel", "Kunde inte skicka kommentar.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Huvud-incheckningens kommentar (från hemskärmen)
  const renderHeader = () => (
    <View style={styles.checkInCommentContainer}>
      <Text style={styles.checkInCommentText}>"{checkInComment || 'Ingen kommentar'}"</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
        keyboardVerticalOffset={100} // Justera detta värde vid behov
      >
        {loading && comments.length === 0 ? (
          <ActivityIndicator size="large" style={{flex: 1}} />
        ) : (
          <FlatList
            data={comments}
            renderItem={({ item }) => <CommentCard item={item} />}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={() => (
              !loading && <Text style={styles.emptyText}>Inga kommentarer än...</Text>
            )}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}

        {/* --- Inmatningsfält --- */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Skriv en kommentar..."
            value={newComment}
            onChangeText={setNewComment}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendButton, (isSubmitting || newComment.trim() === '') && styles.sendButtonDisabled]} 
            onPress={handleSubmitComment}
            disabled={isSubmitting || newComment.trim() === ''}
          >
            <Ionicons name="send" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  container: {
    flex: 1,
  },
  // Stil för huvud-incheckningens kommentar
  checkInCommentContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 10,
  },
  checkInCommentText: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#333',
    textAlign: 'center'
  },
  // Stil för kommentarerna i listan
  commentCard: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 15,
    backgroundColor: '#e0e0e0',
  },
  commentBody: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
  },
  commentDate: {
    fontSize: 12,
    color: '#888',
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 40,
  },
  // Stil för inmatningsfältet
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120, // Begränsa höjden
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6200ea', // Samma lila
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  sendButtonDisabled: {
    backgroundColor: '#aaa',
  }
});

export default CommentsScreen;

