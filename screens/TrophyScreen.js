
// TrophyScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

// 🟢 Tema & UI
import { useTheme } from '../src/theme';
import { Card } from '../src/ui';

// Hjälpfunktion för live-stat
const getUserStatValue = (userProfile, statToTrack) => {
  if (!userProfile || !statToTrack) return 0;
  const statData = userProfile[statToTrack];
  if (typeof statData === 'number') return statData;
  if (Array.isArray(statData)) return statData.length;
  if (typeof statData === 'string' && statData.trim() !== '') return 1;
  return 0;
};

// Trofékort (memo)
const TrophyCard = React.memo(({ trophy, unlockedData, userProfile }) => {
  const { theme } = useTheme();

  const isUnlocked = !!unlockedData;
  const currentLevelValue = unlockedData?.level || 0;
  const currentLevelData = trophy.levels?.find((l) => l.value === currentLevelValue);
  const nextLevelData = trophy.levels?.find((l) => l.value > currentLevelValue);

  const userStatValue = getUserStatValue(userProfile, trophy.statToTrack);

  let progress = 0;
  let progressText = `Nästa nivå: ${nextLevelData?.title || 'Max'}`;
  let showProgress = false;

  if (isUnlocked && nextLevelData) {
    const prevLevelValue = currentLevelData?.value || 0;
    const nextLevelValue = nextLevelData.value;
    const progressRange = nextLevelValue - prevLevelValue;
    const currentProgress = userStatValue - prevLevelValue;
    progress = (currentProgress / progressRange) * 100;
    progressText = `Nästa nivå: ${nextLevelData.title} (${userStatValue}/${nextLevelValue})`;
    showProgress = true;
  } else if (!isUnlocked && trophy.levels?.length) {
    const nextLevelValue = trophy.levels[0].value;
    progress = (userStatValue / nextLevelValue) * 100;
    progressText = `Nästa nivå: ${trophy.levels[0].title} (${userStatValue}/${nextLevelValue})`;
    showProgress = true;
  }

  let imageUrl = currentLevelData?.imageUrl;
  // Om ingen bild – visa ikon
  const useIcon = !imageUrl && !!trophy.iconName;

  return (
    <Card
      style={{
        flex: 1,
        margin: theme.space.sm,
        padding: theme.space.md,
        alignItems: 'center',
        opacity: isUnlocked ? 1 : 0.85,
      }}
    >
      {/* Bild / Ikon */}
      <View
        style={{
          width: 100,
          height: 100,
          borderRadius: 50,
          backgroundColor: theme.colors.bgSoft,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: theme.space.sm,
          overflow: 'hidden',
        }}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <Ionicons name={trophy.iconName || 'star'} size={40} color={isUnlocked ? theme.colors.primary : theme.colors.textMuted} />
        )}
      </View>

      {/* Titel */}
      <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.text, textAlign: 'center', marginBottom: 4 }}>
        {trophy.title}
      </Text>

      {/* Info */}
      {isUnlocked && currentLevelData ? (
        <>
          <Text style={{ fontSize: 14, color: theme.colors.text }}>Nivå: {currentLevelData.title}</Text>
          <Text style={{ fontSize: 12, color: theme.colors.textMuted, marginBottom: theme.space.xs }}>
            Upplåst: {unlockedData.unlockedAt?.toDate().toLocaleDateString('sv-SE') || 'Okänt datum'}
          </Text>
        </>
      ) : (
        <Text style={{ fontSize: 14, color: theme.colors.textMuted }}>Låst</Text>
      )}

      {/* Framsteg */}
      <View style={{ width: '100%', marginTop: 'auto', paddingTop: theme.space.sm }}>
        <Text style={{ fontSize: 12, color: theme.colors.textMuted, textAlign: 'center', marginBottom: 5 }}>
          {showProgress ? progressText : 'Du har nått maxnivån!'}
        </Text>
        <View style={{ width: '100%', height: 8, backgroundColor: theme.colors.border, borderRadius: 4 }}>
          {showProgress ? (
            <View
              style={{
                height: '100%',
                width: `${Math.max(0, Math.min(100, progress))}%`,
                backgroundColor: theme.colors.primary,
                borderRadius: 4,
              }}
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
});

function TrophyScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [loading, setLoading] = useState(true);
  const [allTrophies, setAllTrophies] = useState([]);
  const [unlockedMap, setUnlockedMap] = useState({});
  const [userProfile, setUserProfile] = useState(null);
  const userId = auth.currentUser?.uid;

  const fetchData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const userDocRef = doc(db, 'users', userId);
      const trophiesColRef = collection(db, 'trophies');
      const unlockedColRef = collection(db, 'users', userId, 'unlockedTrophies');

      const [userDocSnap, trophiesSnapshot, unlockedSnapshot] = await Promise.all([
        getDoc(userDocRef),
        getDocs(trophiesColRef),
        getDocs(unlockedColRef),
      ]);

      if (userDocSnap.exists()) setUserProfile(userDocSnap.data());

      const trophiesList = trophiesSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAllTrophies(trophiesList);

      const unlockedData = {};
      unlockedSnapshot.forEach((d) => {
        unlockedData[d.id] = d.data();
      });
      setUnlockedMap(unlockedData);
    } catch (error) {
      console.error('Fel vid hämtning av troféer:', error);
      Alert.alert('Fel', 'Kunde inte ladda troféer.');
    } finally {
      setLoading(false);
    }
  };

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
            unlockedData={unlockedMap[item.id]}
            userProfile={userProfile}
          />
        )}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={{ padding: theme.space.sm, paddingBottom: theme.space.xl * 2 }}
      />
    </SafeAreaView>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    loadingContainer: {
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

export default TrophyScreen;
