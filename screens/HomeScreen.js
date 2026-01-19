import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Image,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Alert
} from 'react-native';
import { auth, db } from '../firebase';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  arrayUnion,
  arrayRemove,
  startAfter // <-- NY IMPORT FÖR INFINITE SCROLL
} from 'firebase/firestore';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

// --- Komponent för "Upptäck nya lekplatser" ---
const DiscoverCard = React.memo(({ item }) => {
  const navigation = useNavigation();
  const imageUrl = item.bildUrl || 'https://firebasestorage.googleapis.com/v0/b/lekplatsen-907fb.firebasestorage.app/o/bild%20saknas.png?alt=media&token=3acbfa69-dea8-456b-bbe2-dd95034f773f';

  return (
    <TouchableOpacity 
      style={styles.discoverCard} 
      onPress={() => navigation.navigate('Sök', { playgroundId: item.id })}
    >
      <Image source={{ uri: imageUrl }} style={styles.discoverImage} />
      <View style={styles.discoverOverlay} />
      <Text style={styles.discoverTitle}>{item.namn}</Text>
      <Text style={styles.discoverSubtitle}>{item.adress}</Text>
      <View style={styles.discoverRating}>
        <Ionicons name="star" size={16} color="#FFD700" />
        <Text style={styles.discoverRatingText}>{(item.snittbetyg || 0).toFixed(1)}</Text>
      </View>
    </TouchableOpacity>
  );
});

// --- Hjälpfunktion för att visa taggar ---
const renderTagSection = (title, data, iconName) => {
  if (!data || data.length === 0) return null;
  return (
    <View style={styles.tagSection}>
      <Text style={styles.tagTitle}>
        <Ionicons name={iconName} size={16} color="#555" /> {title}
      </Text>
      <View style={styles.tagContainer}>
        {data.map((item, index) => (
          <View key={index} style={styles.tag}>
            <Text style={styles.tagText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// --- Komponent för "Senaste äventyren" (UPPDATERAD MED LIKE/KOMMENTAR) ---
const CheckInCard = React.memo(({ item }) => {
  if (!item || !item.user || !item.lekplats) {
    return null;
  }
  
  const navigation = useNavigation();
  const { user, lekplats, incheckning } = item;
  const userId = auth.currentUser?.uid;

  const [isExpanded, setIsExpanded] = useState(false);
  const [isLiked, setIsLiked] = useState(incheckning.likes?.includes(userId) || false);
  const [likeCount, setLikeCount] = useState(incheckning.likes?.length || 0);

  const { 
    kommentar, bild, tidPaLekplats, gjordaAktiviteter, 
    klaradeUtmaningar, taggadeVanner 
  } = incheckning;

  const date = incheckning.timestamp?.toDate().toLocaleDateString('sv-SE') || 'Okänt datum';

  const hasExpandableContent = 
    (gjordaAktiviteter?.length > 0) || 
    (klaradeUtmaningar?.length > 0) || 
    (taggadeVanner?.length > 0);

  const handleLike = async () => {
    if (!userId) return;
    const checkInRef = doc(db, 'incheckningar', item.id);
    if (isLiked) {
      setIsLiked(false);
      setLikeCount(prev => prev - 1);
      try {
        await updateDoc(checkInRef, { likes: arrayRemove(userId) });
      } catch (error) {
        console.error("Fel vid unlike:", error);
        setIsLiked(true);
        setLikeCount(prev => prev + 1);
      }
    } else {
      setIsLiked(true);
      setLikeCount(prev => prev + 1);
      try {
        await updateDoc(checkInRef, { likes: arrayUnion(userId) });
      } catch (error) {
        console.error("Fel vid like:", error);
        setIsLiked(false);
        setLikeCount(prev => prev - 1);
      }
    }
  };
  
  const handleCommentPress = () => {
    navigation.navigate('Comments', { checkInId: item.id, checkInComment: kommentar });
  };

  return (
    <View style={styles.checkInCard}>
      {/* Header */}
      <View style={styles.checkInHeader}>
        <Image 
          source={{ uri: user.profilbildUrl || `https://placehold.co/40x40/e0e0e0/ffffff?text=${user.smeknamn?.[0] || '?'}` }} 
          style={styles.checkInAvatar} 
        />
        <Text style={styles.checkInHeaderText}>
          <Text style={{fontWeight: 'bold'}}>{user.smeknamn || 'Användare'}</Text>
          <Text> på {lekplats.namn || 'okänd lekplats'}</Text>
        </Text>
      </View>

      {/* Kommentar */}
      {kommentar ? (
        <Text style={styles.checkInComment}>{kommentar}</Text>
      ) : null}

      {/* Bild */}
      {bild ? (
        <Image source={{ uri: bild }} style={styles.checkInImage} />
      ) : null}

      {/* Expanderbart innehåll */}
      {isExpanded && (
        <View style={styles.expandedContent}>
          {renderTagSection("Gjorda aktiviteter", gjordaAktiviteter, "game-controller-outline")}
          {renderTagSection("Klarade utmaningar", klaradeUtmaningar, "trophy-outline")}
          {renderTagSection("Taggade vänner", taggadeVanner, "people-outline")}
        </View>
      )}

      {/* Footer med stats */}
      <View style={styles.checkInFooter}>
        <View style={styles.checkInStats}>
          <Ionicons name="star" size={16} color="#FFD700" />
          <Text style={styles.checkInStatText}>{incheckning.betyg || 0}</Text>
          
          {tidPaLekplats ? (
            <>
              <Ionicons name="time-outline" size={16} color="#748c94" style={{marginLeft: 10}} />
              <Text style={styles.checkInStatText}>{tidPaLekplats} min</Text>
            </>
          ) : null}

          <TouchableOpacity onPress={handleLike} style={{flexDirection: 'row', alignItems: 'center', marginLeft: 10}}>
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={16} color={isLiked ? "#e74c3c" : "#748c94"} />
            <Text style={styles.checkInStatText}>{likeCount}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={handleCommentPress} style={{flexDirection: 'row', alignItems: 'center', marginLeft: 10}}>
            <Ionicons name="chatbubble-outline" size={16} color="#748c94" />
            <Text style={styles.checkInStatText}>{incheckning.commentCount || 0}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.checkInDate}>{date}</Text>
      </View>

      {/* "Visa mer"-knapp */}
      {hasExpandableContent && (
        <TouchableOpacity 
          style={styles.toggleExpandButton} 
          onPress={() => setIsExpanded(!isExpanded)}
        >
          <Text style={styles.toggleExpandText}>
            {isExpanded ? 'Visa mindre' : 'Visa mer...'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

// --- Huvudkomponenten för Hemskärmen ---
function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [discoverPlaygrounds, setDiscoverPlaygrounds] = useState([]);
  const [checkInFeed, setCheckInFeed] = useState([]);
  
  // --- NY STATE FÖR INFINITE SCROLL ---
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState(null); // Håller koll på sista dokumentet
  const [hasMore, setHasMore] = useState(true); // Finns det mer att hämta?

  const userId = auth.currentUser?.uid;

  // --- HJÄLPFUNKTION FÖR ATT BERIKA FLÖDET (för att undvika kod-duplicering) ---
  const enrichFeed = async (checkInsData) => {
    // Hämta alla unika ID:n som behövs
    let userIdsToFetch = new Set(checkInsData.map(c => c.userId));
    const playgroundIdsToFetch = [...new Set(checkInsData.map(c => c.lekplatsId))];
    
    // Hämta taggade vänner-ID:n
    checkInsData.forEach(c => {
      if (c.taggadeVanner && Array.isArray(c.taggadeVanner)) {
        c.taggadeVanner.forEach(friendId => userIdsToFetch.add(friendId));
      }
    });

    // Hämta profildata
    const userPromises = [...userIdsToFetch].map(id => getDoc(doc(db, 'users', id)));
    const userDocs = await Promise.all(userPromises);
    const usersMap = {};
    userDocs.forEach(docSnap => {
      if (docSnap.exists()) usersMap[docSnap.id] = docSnap.data();
    });

    // Hämta lekplatsdata
    const playgroundPromises = playgroundIdsToFetch.map(id => getDoc(doc(db, 'lekplatser', id)));
    const playgroundDocs = await Promise.all(playgroundPromises);
    const playgroundsMap = {};
    playgroundDocs.forEach(docSnap => {
      if (docSnap.exists()) playgroundsMap[docSnap.id] = docSnap.data();
    });

    // 6. Kombinera allt till ett snyggt flöde
    return checkInsData.map(incheckning => {
      // Byt ut taggadeVanner-ID:n mot smeknamn
      const taggadeVannerSmeknamn = (incheckning.taggadeVanner || []).map(friendId => {
        return usersMap[friendId]?.smeknamn || 'Okänd';
      });

      return {
        id: incheckning.id,
        incheckning: {
          ...incheckning,
          taggadeVanner: taggadeVannerSmeknamn // Ersätt med smeknamn
        },
        user: usersMap[incheckning.userId],
        lekplats: playgroundsMap[incheckning.lekplatsId]
      };
    });
  };

  // --- Funktion för att hämta FÖRSTA SIDAN data ---
  const fetchHomeScreenData = async () => {
    if (!userId) return;
    setLoading(true);
    setHasMore(true); // Återställ vid ny hämtning

    try {
      // 1. Hämta användardata
      const userDocRef = doc(db, 'users', userId);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) throw new Error("Användaren finns inte");
      
      const currentUserData = userDocSnap.data();
      setUserData(currentUserData);
      const visitedIds = currentUserData.visitedPlaygroundIds || [];
      const friendIds = currentUserData.friends || [];

      // 2. Hämta "Upptäck"-lekplatser
      const playgroundsColRef = collection(db, 'lekplatser');
      const playgroundsSnapshot = await getDocs(playgroundsColRef);
      const allPlaygrounds = playgroundsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const discoverList = allPlaygrounds
        .filter(p => !visitedIds.includes(p.id))
        .slice(0, 3);
      setDiscoverPlaygrounds(discoverList);

      // 3. Hämta FÖRSTA SIDAN "Senaste äventyren"
      const userAndFriendsIds = [...friendIds, userId];
      if (userAndFriendsIds.length > 0) {
        const checkInsQuery = query(
          collection(db, 'incheckningar'),
          where('userId', 'in', userAndFriendsIds),
          orderBy('timestamp', 'desc'),
          limit(10) // Hämta de 10 första
        );
        const checkInsSnapshot = await getDocs(checkInsQuery);
        // *** VIKTIG ÄNDRING FÖR ATT FÅ DOKUMENT-ID ***
        const checkInsData = checkInsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Spara det sista dokumentet för paginering
        setLastVisible(checkInsSnapshot.docs[checkInsSnapshot.docs.length - 1]);
        if (checkInsSnapshot.docs.length < 10) {
          setHasMore(false); // Det fanns färre än 10, ingen mer data
        }

        // 4. Berika och sätt flödet
        const finalFeed = await enrichFeed(checkInsData);
        setCheckInFeed(finalFeed);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Fel vid hämtning av Hemskärmsdata:", error);
      Alert.alert("Fel", "Kunde inte ladda flödet. Kontrollera Firestore-index.");
    } finally {
      setLoading(false);
    }
  };

  // --- NY FUNKTION: HÄMTA MER DATA (INFINITE SCROLL) ---
  const fetchMoreCheckIns = async () => {
    // Stoppa om vi redan laddar, eller om det inte finns mer data
    if (loadingMore || !hasMore || !lastVisible) return;
    
    setLoadingMore(true);

    try {
      const friendIds = userData?.friends || [];
      const userAndFriendsIds = [...friendIds, userId];

      // Skapa en ny fråga som börjar EFTER det sista dokumentet
      const nextQuery = query(
        collection(db, 'incheckningar'),
        where('userId', 'in', userAndFriendsIds),
        orderBy('timestamp', 'desc'),
        startAfter(lastVisible), // <-- Magin!
        limit(10)
      );

      const checkInsSnapshot = await getDocs(nextQuery);
      // *** VIKTIG ÄNDRING FÖR ATT FÅ DOKUMENT-ID ***
      const newCheckInsData = checkInsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      // Uppdatera 'lastVisible' för nästa hämtning
      setLastVisible(checkInsSnapshot.docs[checkInsSnapshot.docs.length - 1]);
      if (checkInsSnapshot.docs.length < 10) {
        setHasMore(false); // Inga fler dokument
      }

      // Berika och lägg till i flödet
      const newFinalFeed = await enrichFeed(newCheckInsData);
      setCheckInFeed(prevFeed => [...prevFeed, ...newFinalFeed]);
      
    } catch (error) {
      console.error("Fel vid hämtning av mer data:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Ladda om all data när skärmen fokuseras
  useFocusEffect(
    useCallback(() => {
      fetchHomeScreenData(); // Kör den initiala hämtningen
    }, [userId])
  );

  // --- Header-komponent för FlatList ---
  const renderHeader = () => (
    <View>
      <Text style={styles.sectionTitle}>Upptäck nya lekplatser</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.discoverScroll}>
        {discoverPlaygrounds.length > 0 ? (
          discoverPlaygrounds.map(item => <DiscoverCard key={item.id} item={item} />)
        ) : (
          !loading && <Text style={styles.emptyText}>Inga nya lekplatser att upptäcka.</Text>
        )}
      </ScrollView>
      <Text style={styles.sectionTitle}>Senaste äventyren</Text>
    </View>
  );

  // --- NY FOOTER-KOMPONENT FÖR SPINNER ---
  const renderFooter = () => {
    if (!loadingMore) return null; // Visa inget om vi inte laddar
    return (
      <ActivityIndicator
        style={{ marginVertical: 20 }}
        size="large"
      />
    );
  };

  if (loading && checkInFeed.length === 0) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={checkInFeed}
        renderItem={({ item }) => <CheckInCard item={item} />}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={() => (
          !loading ? <Text style={styles.emptyText}>Ditt flöde är tomt. Gå ut och lek!</Text> : null
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
        
        // --- NYA PROPS FÖR INFINITE SCROLL ---
        onEndReached={fetchMoreCheckIns} // Funktion som anropas vid botten
        onEndReachedThreshold={0.5} // Hur långt från botten (0.5 = 50%)
        ListFooterComponent={renderFooter} // Visa spinnern
      />
    </SafeAreaView>
  );
}

// --- STYLES (med uppdateringar) ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  discoverScroll: {
    paddingLeft: 20,
  },
  discoverCard: {
    width: 250,
    height: 150,
    marginRight: 15,
    borderRadius: 15,
    overflow: 'hidden',
  },
  discoverImage: {
    width: '100%',
    height: '100%',
  },
  discoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  discoverTitle: {
    position: 'absolute',
    bottom: 30,
    left: 15,
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  discoverSubtitle: {
    position: 'absolute',
    bottom: 10,
    left: 15,
    color: 'white',
    fontSize: 14,
  },
  discoverRating: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  discoverRatingText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 4,
  },
  checkInCard: {
    backgroundColor: 'white',
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  checkInHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  checkInAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#e0e0e0',
  },
  checkInHeaderText: {
    flex: 1,
    fontSize: 14,
  },
  checkInComment: {
    fontSize: 14,
    color: '#333',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  checkInImage: {
    width: '100%',
    height: 200, 
    borderRadius: 10,
    marginBottom: 10,
  },
  checkInFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
  },
  checkInStats: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap', 
  },
  checkInStatText: {
    marginLeft: 5,
    color: '#748c94',
  },
  checkInDate: {
    fontSize: 12,
    color: '#aaa',
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 20,
    fontSize: 14,
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 10,
    paddingTop: 10,
  },
  tagSection: {
    marginBottom: 10,
  },
  tagTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 5,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: '#e0e0e0',
    borderRadius: 15,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginRight: 5,
    marginBottom: 5,
  },
  tagText: {
    fontSize: 12,
    color: '#333',
  },
  toggleExpandButton: {
    paddingTop: 10,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  toggleExpandText: {
    fontSize: 14,
    color: '#007AFF', 
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default HomeScreen;

