// MyVisitedPlaygroundsScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Card } from '../../src/ui';

export default function MyVisitedPlaygroundsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [playgrounds, setPlaygrounds] = useState([]);
  const [loading, setLoading] = useState(true);

  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!userId) return;
    const fetchVisited = async () => {
      try {
        const userSnap = await getDoc(doc(db, 'users', userId));
        const ids = userSnap.data()?.visitedPlaygroundIds || [];
        if (ids.length === 0) {
          setPlaygrounds([]);
          return;
        }
        // Firestore 'in'-fråga tillåter max 30 per anrop
        const chunks = [];
        for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
        const results = await Promise.all(
          chunks.map((chunk) =>
            getDocs(query(collection(db, 'lekplatser'), where('__name__', 'in', chunk)))
          )
        );
        const list = results.flatMap((snap) =>
          snap.docs.map((d) => ({ id: d.id, namn: d.data().namn || d.data().name || 'Okänd' }))
        );
        list.sort((a, b) => a.namn.localeCompare(b.namn, 'sv'));
        setPlaygrounds(list);
      } catch (e) {
        console.error('Fel vid hämtning av besökta lekplatser:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchVisited();
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
        data={playgrounds}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: theme.space.md, paddingBottom: theme.space.xl * 2 }}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: theme.colors.textMuted, marginTop: theme.space.xl }}>
            Du har inte besökt några lekplatser än.
          </Text>
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: theme.space.sm, padding: 0, overflow: 'hidden' }}>
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: theme.space.md,
              }}
              onPress={() => navigation.navigate('PlaygroundDetails', { id: item.id })}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} style={{ marginRight: theme.space.sm }} />
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text, flex: 1 }}>
                  {item.namn}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}
