import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useTheme } from '../src/theme';
import { Avatar } from '../src/ui';
import { enrichFeed } from '../src/services/feedService';
import { CheckInCard } from '../src/components/CheckInCard';
import { useNavigation } from '@react-navigation/native';

function PublicProfileScreen({ route }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { userId } = route.params || {};
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userCheckins, setUserCheckins] = useState([]);
  const [checkinsLoading, setCheckinsLoading] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const fetchUser = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', userId));
        if (snap.exists()) setUser(snap.data());
      } catch (e) {
        console.warn('Kunde inte hämta användare:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, 'incheckningar'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );
    const unsub = onSnapshot(q, async (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const enriched = await enrichFeed(items);
      setUserCheckins(enriched);
      setCheckinsLoading(false);
    });
    return unsub;
  }, [userId]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}> 
        <ActivityIndicator color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}> 
        <Text style={{ color: theme.colors.text }}>Ingen användare hittades.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: theme.space.lg, paddingBottom: theme.space.xl * 2 }}>
        <View style={{ alignItems: 'center', marginBottom: theme.space.lg }}>
          <Avatar
            uri={user.profilbildUrl}
            size={100}
            style={{ backgroundColor: theme.colors.bgSoft }}
          />
          <Text style={[styles.name]}>{user.smeknamn || 'Användare'}</Text>
          {(user.fornamn || user.efternamn) && (
            <Text style={{ color: theme.colors.textMuted, marginTop: theme.space.xs }}>
              {`${user.fornamn || ''} ${user.efternamn || ''}`.trim()}
            </Text>
          )}
        </View>

        <View style={{ marginBottom: theme.space.lg }}>
          <Text style={styles.sectionTitle}>Statistik</Text>
          <Text style={styles.statText}>
            🌟 Incheckningar: {user.totalCheckinCount || 0}
          </Text>
          <Text style={styles.statText}>
            📍 Besökta platser: {user.visitedPlaygroundIds?.length || 0}
          </Text>
        </View>

        {/* senaste incheckningar */}
        <Text style={[styles.sectionTitle, { marginBottom: theme.space.sm }]}>Senaste incheckningarna</Text>
        {checkinsLoading ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : userCheckins.length === 0 ? (
          <Text style={{ color: theme.colors.textMuted }}>Ingen aktivitet än</Text>
        ) : (
          userCheckins.map((item) => (
            <CheckInCard
              key={item.id}
              item={{
                ...item.incheckning,
                id: item.id,
                userSmeknamn: user.smeknamn,
                profilbildUrl: user.profilbildUrl,
                bildUrl: item.incheckning.bildUrl || item.incheckning.bild,
              }}
              playgroundName={item.lekplats?.namn}
              onPressComments={() =>
                navigation.navigate('Comments', {
                  checkInId: item.id,
                  checkInComment: item.incheckning.kommentar || '',
                })
              }
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    text: {
      fontSize: 20,
      fontWeight: 'bold',
    },
    name: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.colors.text,
      marginTop: theme.space.sm,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.space.sm,
    },
    statText: {
      fontSize: 14,
      color: theme.colors.text,
      marginBottom: theme.space.xs,
    },
  });

export default PublicProfileScreen;