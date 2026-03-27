// MyCheckinsScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../src/theme';
import { CheckInCard } from '../../src/components/CheckInCard';
import { enrichFeed } from '../../src/services/feedService';

export default function MyCheckinsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [checkins, setCheckins] = useState([]);
  const [loading, setLoading] = useState(true);

  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!userId) return;
    const fetchCheckins = async () => {
      try {
        const q = query(
          collection(db, 'incheckningar'),
          where('userId', '==', userId),
          orderBy('timestamp', 'desc')
        );
        const snap = await getDocs(q);
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const enriched = await enrichFeed(items);
        setCheckins(enriched);
      } catch (e) {
        console.error('Fel vid hämtning av incheckningar:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchCheckins();
  }, [userId]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <FlatList
        data={checkins}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: theme.space.md, paddingBottom: theme.space.xl * 2 }}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: theme.colors.textMuted, marginTop: theme.space.xl }}>
            Du har inga incheckningar än.
          </Text>
        }
        renderItem={({ item }) => (
          <CheckInCard
            item={{
              ...item.incheckning,
              id: item.id,
              userSmeknamn: item.user?.smeknamn || item.incheckning?.userSmeknamn,
              profilbildUrl: item.user?.profilbildUrl || item.incheckning?.profilbildUrl,
              bildUrl: item.incheckning?.bildUrl || item.incheckning?.bild,
            }}
            playgroundName={item.lekplats?.namn}
            onPressComments={() =>
              navigation.navigate('Comments', {
                checkInId: item.id,
                checkInComment: item.incheckning?.kommentar || '',
              })
            }
          />
        )}
      />
    </SafeAreaView>
  );
}
