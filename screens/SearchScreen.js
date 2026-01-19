import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { auth, db } from '../firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
// --- NYA IMPORTER FÖR KARTAN ---
import MapView, { Marker, Callout } from 'react-native-maps';

// --- Komponent för Lekplats-kort (Grid) ---
const PlaygroundCard = React.memo(({ item }) => {
  const navigation = useNavigation();
  const imageUrl = item.bildUrl || 'https://firebasestorage.googleapis.com/v0/b/lekplatsen-907fb.firebasestorage.app/o/bild%20saknas.png?alt=media&token=3acbfa69-dea8-456b-bbe2-dd95034f773f';

  return (
    <TouchableOpacity 
      style={styles.card}
      // onPress={() => navigation.navigate('PlaygroundDetail', { playgroundId: item.id })} // Framtida steg
    >
      <Image source={{ uri: imageUrl }} style={styles.cardImage} />
      <View style={styles.cardOverlay} />
      <Text style={styles.cardTitle}>{item.namn}</Text>
      <Text style={styles.cardSubtitle}>{item.adress}</Text>
      <View style={styles.cardRating}>
        <Ionicons name="star" size={16} color="#FFD700" />
        <Text style={styles.cardRatingText}>{(item.snittbetyg || 0).toFixed(1)}</Text>
      </View>
    </TouchableOpacity>
  );
});

// --- Header-komponent ---
const SearchHeader = React.memo(({ 
  searchQuery, 
  setSearchQuery, 
  viewMode, 
  setViewMode, 
  isAdmin, 
  navigation 
}) => {
  return (
    <View style={styles.headerContainer}>
      {/* --- Sök och filter-bar --- */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Sök på namn, adress, kommun..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity style={styles.toggleButton} onPress={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}>
          <Ionicons name={viewMode === 'list' ? "map-outline" : "list-outline"} size={24} color="#6200ea" />
        </TouchableOpacity>
      </View>

      {/* --- Knappar (Admin / Lägg till) --- */}
      <View style={styles.buttonContainer}>
        {isAdmin && (
          <TouchableOpacity style={[styles.button, styles.adminButton]} onPress={() => navigation.navigate('ReviewDrafts')}>
            <Ionicons name="shield-checkmark-outline" size={16} color="white" />
            <Text style={styles.buttonText}>Granska utkast</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.button, styles.addButton]} onPress={() => navigation.navigate('AddPlayground')}>
          <Ionicons name="add" size={16} color="white" />
          <Text style={styles.buttonText}>Lägg till lekplats</Text>
        </TouchableOpacity>
      </View>
      
      {/* Rubrik för listan (Visas bara i list-vy) */}
      {viewMode === 'list' && (
        <Text style={styles.sectionTitle}>Alla Lekplatser</Text>
      )}
    </View>
  );
});

// --- Start-position för kartan (Centrerad på Borås) ---
const initialRegion = {
  latitude: 57.7210,
  longitude: 12.9401,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

function SearchScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allPlaygrounds, setAllPlaygrounds] = useState([]); // Hela listan
  const [filteredPlaygrounds, setFilteredPlaygrounds] = useState([]); // Visad lista
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' eller 'map'

  const userId = auth.currentUser?.uid;

  // --- Hämta all data ---
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Hämta ALLA lekplatser
      const q = query(collection(db, "lekplatser"));
      const querySnapshot = await getDocs(q);
      const playgrounds = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setAllPlaygrounds(playgrounds);
      setFilteredPlaygrounds(playgrounds);

    } catch (error) {
      console.error("Fel vid hämtning av sökdata:", error);
      Alert.alert("Fel", "Kunde inte ladda lekplatser.");
    } finally {
      setLoading(false);
    }
  };
  
  // --- Hämta Admin-status (separat) ---
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (userId) {
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists() && userDocSnap.data().isAdmin) {
          setIsAdmin(true);
        }
      }
    };
    checkAdminStatus();
  }, [userId]);


  // Hämta data när skärmen fokuseras
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [userId])
  );

  // --- Hantera sökning (filtrering) ---
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredPlaygrounds(allPlaygrounds); // Återställ till hela listan
      return;
    }
    const lowerCaseQuery = searchQuery.toLowerCase();
    const filtered = allPlaygrounds.filter(p => {
      return (
        p.namn?.toLowerCase().includes(lowerCaseQuery) ||
        p.adress?.toLowerCase().includes(lowerCaseQuery) ||
        p.kommun?.toLowerCase().includes(lowerCaseQuery)
      );
    });
    setFilteredPlaygrounds(filtered);
  }, [searchQuery, allPlaygrounds]);

  // --- Memoized Header ---
  const listHeader = useMemo(() => (
    <SearchHeader
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      viewMode={viewMode}
      setViewMode={setViewMode}
      isAdmin={isAdmin}
      navigation={navigation}
    />
  ), [searchQuery, viewMode, isAdmin, navigation]);


  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]} edges={['top']}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  // --- HUVUD-RENDER (UPPDATERAD MED KART-LOGIK) ---
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* --- Innehåll (Lista eller Karta) --- */}
      {viewMode === 'list' ? (
        // --- LIST-VY (Oförändrad) ---
        <FlatList
          data={filteredPlaygrounds}
          renderItem={({ item }) => <PlaygroundCard item={item} />}
          keyExtractor={(item) => item.id}
          numColumns={2}
          ListHeaderComponent={listHeader} // Använd den memoized headern
          ListEmptyComponent={() => <Text style={styles.emptyText}>Inga lekplatser hittades.</Text>}
          contentContainerStyle={styles.listContainer}
          keyboardShouldPersistTaps="handled" 
        />
      ) : (
        // --- KART-VY (NY!) ---
        <View style={styles.container}>
          {/* Visa headern (Sökfält/Knappar) ovanför kartan */}
          {listHeader} 
          <MapView
            style={styles.map}
            initialRegion={initialRegion}
          >
            {/* Loopa igenom filtrerade lekplatser och visa en markör för varje */}
            {filteredPlaygrounds.map(playground => {
              // Visa BARA de som har giltiga koordinater
              if (playground.lat && playground.lng) {
                return (
                  <Marker
                    key={playground.id}
                    coordinate={{
                      latitude: playground.lat,
                      longitude: playground.lng,
                    }}
                  >
                    {/* Pop-up som visas vid klick */}
                    <Callout>
                      <View style={styles.calloutContainer}>
                        <Text style={styles.calloutTitle}>{playground.namn}</Text>
                        <Text style={styles.calloutSubtitle}>{playground.adress}</Text>
                      </View>
                    </Callout>
                  </Marker>
                );
              }
              return null; // Ignorera lekplatser utan koordinater
            })}
          </MapView>
        </View>
      )}
    </SafeAreaView>
  );
}

// ---- STILAR (UPPDATERADE MED KART-STILAR) ----
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Header-sektionen
  headerContainer: {
    backgroundColor: 'white',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 25,
    height: 50,
  },
  searchIcon: {
    paddingLeft: 15,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 10,
    fontSize: 16,
  },
  toggleButton: {
    marginLeft: 10,
    padding: 10,
  },
  // Knapp-sektion
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 10,
  },
  adminButton: {
    backgroundColor: '#555',
  },
  addButton: {
    backgroundColor: '#00C851', // Grön
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 5,
    fontSize: 12,
  },
  // List-sektion
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    paddingHorizontal: 15, // Matcha knapparna
    paddingTop: 15,
    paddingBottom: 5,
    backgroundColor: '#F5F5F5', // Bakgrund för sektionstiteln
  },
  listContainer: {
    paddingHorizontal: 10,
    paddingBottom: 100, // Padding för flik-menyn
  },
  card: {
    flex: 0.5, // Två kolumner
    margin: 5,
    height: 200, // Fast höjd för grid
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: 'black',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cardTitle: {
    position: 'absolute',
    bottom: 30,
    left: 15,
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardSubtitle: {
    position: 'absolute',
    bottom: 10,
    left: 15,
    color: 'white',
    fontSize: 12,
  },
  cardRating: {
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
  cardRatingText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 4,
  },
  // --- NYA KART-STILAR ---
  map: {
    flex: 1, // Fyll återstående utrymme
  },
  calloutContainer: {
    width: 200, // Ge pop-upen lite bredd
    padding: 5,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  calloutSubtitle: {
    fontSize: 12,
    color: '#333',
  },
  // Övrigt
  mapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 40,
    fontSize: 14,
  }
});

export default SearchScreen;