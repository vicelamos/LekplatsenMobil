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
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView // Behålls för <ScrollView> i vissa fall, men vi tar bort den från layouten
} from 'react-native';
import { auth, db } from '../firebase';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  arrayUnion, // <-- ÄNDRING: Importera arrayUnion
  arrayRemove // <-- ÄNDRING: Importera arrayRemove
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native'; // För att ladda om

// ---- NY KOMPONENT: ListHeader ----
// Vi skapar en separat, memoized komponent för headern.
// Detta hindrar TextInput från att tappa fokus.
const FriendsListHeader = React.memo(({
  searchQuery,
  setSearchQuery,
  isSearching,
  handleSearch,
  searchResults,
  renderSearchItem
}) => {
  return (
    <View>
      {/* SÖK-SEKTION */}
      <View style={styles.searchContainer}>
        <Text style={styles.title}>Hitta Vänner</Text>
        <Text style={styles.subtitle}>Sök efter smeknamn</Text>
        <TextInput
          style={styles.input}
          placeholder="T.ex. LekplatsKalle"
          value={searchQuery}
          onChangeText={setSearchQuery} // Detta är stabilt (från useState)
          autoCapitalize="none"
        />
        <Button title={isSearching ? "Söker..." : "Sök"} onPress={handleSearch} disabled={isSearching} />
        
        {isSearching && <ActivityIndicator style={{marginTop: 10}} />}
        
        {/* ---- ERSÄTTNING FÖR SÖK-FLATLIST ---- */}
        <View>
          {searchResults.map(item => renderSearchItem(item))}
          {searchResults.length === 0 && searchQuery.length > 0 && !isSearching && (
            <Text style={styles.emptyText}>Inga träffar.</Text>
          )}
        </View>
      </View>

      {/* VÄNLISTA-SEKTION (Endast rubriken) */}
      <View style={styles.listContainerHeader}>
        <Text style={styles.title}>Mina Vänner</Text>
      </View>
    </View>
  );
});

function FriendsScreen() {
  const [loading, setLoading] = useState(true);
  const [friendsList, setFriendsList] = useState([]);
  const [friendIds, setFriendIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const userId = auth.currentUser?.uid;

  // ---- 1. HÄMTA VÄNNER ----
  const fetchFriends = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    try {
      const userDocRef = doc(db, 'users', userId);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) {
        console.log("Användaren finns inte");
        setLoading(false);
        return;
      }
      const friendsArray = userDocSnap.data().friends || [];
      setFriendIds(friendsArray);
      if (friendsArray.length === 0) {
        setFriendsList([]);
        setLoading(false);
        return;
      }
      const friendPromises = friendsArray.map(id => getDoc(doc(db, 'users', id)));
      const friendDocs = await Promise.all(friendPromises);
      const friendsData = friendDocs
        .filter(docSnap => docSnap.exists())
        .map(docSnap => ({ uid: docSnap.id, ...docSnap.data() }));
      setFriendsList(friendsData);
    } catch (error) {
      console.error("Fel vid hämtning av vänner:", error);
      Alert.alert("Fel", "Kunde inte hämta din vänlista.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      fetchFriends();
    }, [fetchFriends])
  );

  // ---- 2. SÖK EFTER NYA VÄNNER ----
  const handleSearch = useCallback(async () => {
    if (searchQuery.trim() === "") {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const q = query(collection(db, "users"), where("smeknamn", "==", searchQuery.trim()));
      const querySnapshot = await getDocs(q);
      const results = querySnapshot.docs
        .map(docSnap => ({ uid: docSnap.id, ...docSnap.data() }))
        .filter(user => user.uid !== userId);
      setSearchResults(results);
    } catch (error) {
      console.error("Sökfel:", error);
      Alert.alert("Fel", "Kunde inte utföra sökningen.");
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, userId]);

  // ---- 3. LÄGG TILL EN VÄN ----
  const handleAddFriend = useCallback(async (friendToAdd) => {
    if (!userId) return;
    try {
      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, { friends: arrayUnion(friendToAdd.uid) });
      setFriendsList(prev => [...prev, friendToAdd]);
      setFriendIds(prev => [...prev, friendToAdd.uid]);
      setSearchResults(prev => prev.filter(user => user.uid !== friendToAdd.uid));
      Alert.alert("Vän tillagd!", `${friendToAdd.smeknamn} är nu din vän.`);
    } catch (error) {
      console.error("Fel vid tillägg av vän:", error);
      Alert.alert("Fel", "Kunde inte lägga till vän.");
    }
  }, [userId]);

  // ---- 4. TA BORT EN VÄN ----
  const handleRemoveFriend = useCallback(async (friendToRemove) => {
    if (!userId) return;
    Alert.alert(
      "Ta bort vän",
      `Är du säker på att du vill ta bort ${friendToRemove.smeknamn} som vän?`,
      [
        { text: "Avbryt", style: "cancel" },
        {
          text: "Ta bort",
          style: "destructive",
          onPress: async () => {
            try {
              const userDocRef = doc(db, 'users', userId);
              await updateDoc(userDocRef, { friends: arrayRemove(friendToRemove.uid) });
              setFriendsList(prev => prev.filter(user => user.uid !== friendToRemove.uid));
              setFriendIds(prev => prev.filter(id => id !== friendToRemove.uid));
            } catch (error) {
              console.error("Fel vid borttagning av vän:", error);
              Alert.alert("Fel", "Kunde inte ta bort vän.");
            }
          }
        }
      ]
    );
  }, [userId]);

  // ---- Render-funktion för VÄNLISTAN ----
  const renderFriendItem = useCallback(({ item }) => (
    <View style={styles.listItem}>
      <Image
        style={styles.profileImage}
        source={{ uri: item.profilbildUrl || `https://placehold.co/50x50/e0e0e0/ffffff?text=${item.smeknamn?.[0] || '?'}` }}
      />
      <Text style={styles.nameText}>{item.smeknamn || item.email}</Text>
      <TouchableOpacity onPress={() => handleRemoveFriend(item)} style={styles.removeButton}>
        <Ionicons name="person-remove-outline" size={24} color="#c0392b" />
      </TouchableOpacity>
    </View>
  ), [handleRemoveFriend]);

  // ---- Render-funktion för SÖKRESULTAT ----
  const renderSearchItem = useCallback((item) => {
    const isFriend = friendIds.includes(item.uid);
    return (
      <View key={item.uid} style={styles.listItem}>
        <Image
          style={styles.profileImage}
          source={{ uri: item.profilbildUrl || `https://placehold.co/50x50/e0e0e0/ffffff?text=${item.smeknamn?.[0] || '?'}` }}
        />
        <Text style={styles.nameText}>{item.smeknamn || item.email}</Text>
        {isFriend ? (
          <Text style={styles.alreadyFriendText}>Redan vän</Text>
        ) : (
          <TouchableOpacity onPress={() => handleAddFriend(item)} style={styles.addButton}>
            <Ionicons name="person-add-outline" size={24} color="#27ae60" />
          </TouchableOpacity>
        )}
      </View>
    );
  }, [friendIds, handleAddFriend]);

  // ---- DEN VIKTIGA FIXEN ----
  // Vi använder React.useMemo för att skapa vår header-komponent.
  // Denna kommer bara att återskapas om dess beroenden (som 'handleSearch' 
  // eller 'searchResults') ändras. 'searchQuery' skickas som prop,
  // men `setSearchQuery` (som är stabil) används för onChangeText.
  const listHeaderComponent = React.useMemo(() => (
    <FriendsListHeader
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      isSearching={isSearching}
      handleSearch={handleSearch}
      searchResults={searchResults}
      renderSearchItem={renderSearchItem}
    />
  ), [searchQuery, isSearching, handleSearch, searchResults, renderSearchItem, setSearchQuery]); // Inkludera alla props

  return (
    <SafeAreaView style={styles.safeArea}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={friendsList}
          renderItem={renderFriendItem}
          keyExtractor={(item) => item.uid}
          // ---- ÄNDRING HÄR ----
          // Använd den memoized-komponenten
          ListHeaderComponent={listHeaderComponent}
          ListEmptyComponent={() => (
            <Text style={styles.emptyText}>Du har inga vänner än. Börja med att söka!</Text>
          )}
          contentContainerStyle={styles.listContentContainer}
          // ---- EXTRA VIKTIG FIX HÄR ----
          // Talar om för listan att inte stänga tangentbordet
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: 'white',
  },
  listContainerHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: '#F5F5F5',
  },
  listContentContainer: {
    paddingBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 10,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingHorizontal: 20,
    backgroundColor: 'white',
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e0e0e0',
    marginRight: 15,
  },
  nameText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  removeButton: {
    padding: 5,
  },
  addButton: {
    padding: 5,
  },
  alreadyFriendText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 20,
    fontSize: 14,
    paddingHorizontal: 20,
  }
});

export default FriendsScreen;

