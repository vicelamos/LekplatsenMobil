import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Image,
  ActivityIndicator
} from 'react-native';
import { auth, db } from '../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

// En hjälpfunktion för att hämta användarens live-statistik
const getUserStatValue = (userProfile, statToTrack) => {
  if (!userProfile || !statToTrack) return 0;
  
  const statData = userProfile[statToTrack];
  
  if (typeof statData === 'number') {
    return statData; // t.ex. totalCheckinCount
  } else if (Array.isArray(statData)) {
    return statData.length; // t.ex. visitedPlaygroundIds.length eller friends.length
  } else if (typeof statData === 'string' && statData.trim() !== '') {
    return 1; // t.ex. profilbildUrl
  }
  return 0;
};

// --- Trofé-kortet ---
// Vi gör detta till en egen komponent för prestanda (React.memo)
const TrophyCard = React.memo(({ trophy, unlockedData, userProfile }) => {
  
  const isUnlocked = !!unlockedData;
  const currentLevelValue = unlockedData?.level || 0;
  
  // Hitta nuvarande och nästa nivå från trofé-katalogen
  const currentLevelData = trophy.levels?.find(l => l.value === currentLevelValue);
  const nextLevelData = trophy.levels?.find(l => l.value > currentLevelValue); // Hitta FÖRSTA nivån som är högre
  
  // Hämta live-statistiken
  const userStatValue = getUserStatValue(userProfile, trophy.statToTrack);

  // Beräkna framsteg
  let progress = 0;
  let progressText = `Nästa nivå: ${nextLevelData?.title || 'Max'}`;
  let showProgress = false;

  if (isUnlocked && nextLevelData) {
    // Användaren är på en nivå och det finns en högre nivå
    const prevLevelValue = currentLevelData?.value || 0;
    const nextLevelValue = nextLevelData.value;
    const progressRange = nextLevelValue - prevLevelValue;
    const currentProgress = userStatValue - prevLevelValue;
    
    progress = (currentProgress / progressRange) * 100;
    progressText = `Nästa nivå: ${nextLevelData.title} (${userStatValue}/${nextLevelValue})`;
    showProgress = true;
  } else if (!isUnlocked && nextLevelData) {
    // Användaren har inte ens nivå 1, men det finns en nivå 1
    const nextLevelValue = trophy.levels[0].value;
    progress = (userStatValue / nextLevelValue) * 100;
    progressText = `Nästa nivå: ${trophy.levels[0].title} (${userStatValue}/${nextLevelValue})`;
    showProgress = true;
  }

  // Bestäm vilken bild/ikon som ska visas
  let imageUrl = currentLevelData?.imageUrl; // Försök hämta bild för upplåst nivå
  if (!imageUrl && trophy.iconName) {
    // Om ingen bild finns (eller låst), använd ikonen (om den finns)
    // Detta är en platshållare, vi visar ikonen nedan
  } else if (!imageUrl) {
    // Fallback om varken bild eller ikon finns
    imageUrl = `https://placehold.co/100x100/6200ea/ffffff?text=${trophy.title?.[0] || '?'}`;
  }

  return (
    <View style={[styles.card, isUnlocked ? styles.cardUnlocked : styles.cardLocked]}>
      
      {/* --- Bild / Ikon --- */}
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.trophyImage} />
        ) : (
          <Ionicons name={trophy.iconName || 'star'} size={40} color={isUnlocked ? '#6200ea' : '#aaa'} />
        )}
      </View>

      {/* --- Titel --- */}
      <Text style={styles.cardTitle}>{trophy.title}</Text>

      {/* --- Info (Nivå, Datum) --- */}
      {isUnlocked && currentLevelData ? (
        <>
          <Text style={styles.levelText}>Nivå: {currentLevelData.title}</Text>
          <Text style={styles.dateText}>Upplåst: {unlockedData.unlockedAt?.toDate().toLocaleDateString('sv-SE') || 'Okänt datum'}</Text>
        </>
      ) : (
        <Text style={styles.levelText}>Låst</Text>
      )}

      {/* --- Framsteg --- */}
      {showProgress ? (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>{progressText}</Text>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${Math.max(0, Math.min(100, progress))}%` }]} />
          </View>
        </View>
      ) : (
        <View style={styles.progressContainer}>
           <Text style={styles.progressText}>Du har nått maxnivån!</Text>
        </View>
      )}
    </View>
  );
});


function TrophyScreen() {
  const [loading, setLoading] = useState(true);
  const [allTrophies, setAllTrophies] = useState([]); // Katalogen
  const [unlockedMap, setUnlockedMap] = useState({});   // Upplåsta
  const [userProfile, setUserProfile] = useState(null); // För live-stats
  const userId = auth.currentUser?.uid;

  const fetchData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // 1. Hämta alla tre datakällor samtidigt
      const userDocRef = doc(db, 'users', userId);
      const trophiesColRef = collection(db, 'trophies');
      const unlockedColRef = collection(db, 'users', userId, 'unlockedTrophies');

      const [userDocSnap, trophiesSnapshot, unlockedSnapshot] = await Promise.all([
        getDoc(userDocRef),
        getDocs(trophiesColRef),
        getDocs(unlockedColRef)
      ]);

      // 2. Spara användarprofilen
      if (userDocSnap.exists()) {
        setUserProfile(userDocSnap.data());
      }

      // 3. Spara trofé-katalogen
      const trophiesList = trophiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllTrophies(trophiesList);

      // 4. Spara de upplåsta troféerna i en "map" för snabb åtkomst
      const unlockedData = {};
      unlockedSnapshot.forEach(doc => {
        unlockedData[doc.id] = doc.data();
      });
      setUnlockedMap(unlockedData);

    } catch (error) {
      console.error("Fel vid hämtning av troféer:", error);
      Alert.alert("Fel", "Kunde inte ladda troféer.");
    } finally {
      setLoading(false);
    }
  };

  // Ladda om datan varje gång skärmen visas
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [userId])
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={allTrophies}
        renderItem={({ item }) => (
          <TrophyCard
            trophy={item}
            unlockedData={unlockedMap[item.id]} // Skicka in upplåst data (eller undefined)
            userProfile={userProfile} // Skicka in live-stats
          />
        )}
        keyExtractor={(item) => item.id}
        numColumns={2} // Visa i två kolumner
        contentContainerStyle={styles.listContentContainer}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContentContainer: {
    padding: 10,
  },
  card: {
    flex: 1,
    margin: 10,
    padding: 15,
    borderRadius: 15,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    // Skugga
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  cardUnlocked: {
    // Ingen speciell stil just nu, men kan ha t.ex. en färgad kant
  },
  cardLocked: {
    opacity: 0.7, // Gör låsta kort lite genomskinliga
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    overflow: 'hidden', // För att bilden ska hålla sig inom cirkeln
  },
  trophyImage: {
    width: '100%',
    height: '100%',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  levelText: {
    fontSize: 14,
    color: '#333',
  },
  dateText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 10,
  },
  progressContainer: {
    width: '100%',
    marginTop: 'auto', // Se till att progress-baren hamnar längst ner
    paddingTop: 10,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 5,
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00C851', // Grön
    borderRadius: 4,
  },
});

export default TrophyScreen;

