import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useTheme } from '../../src/theme';
import { enrichFeed } from '../../src/services/feedService';
import { CheckInCard } from '../../src/components/CheckInCard';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

function PublicProfileScreen({ route }) {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { userId } = route.params || {};
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trophyCount, setTrophyCount] = useState(0);
  const [userCheckins, setUserCheckins] = useState([]);
  const [checkinsLoading, setCheckinsLoading] = useState(true);
  const [friendStatus, setFriendStatus] = useState('none'); // 'none' | 'friend' | 'sent' | 'received'
  const [sendingRequest, setSendingRequest] = useState(false);
  const navigation = useNavigation();

  const currentUserId = auth.currentUser?.uid;
  const isOwnProfile = currentUserId === userId;

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const fetchUser = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', userId));
        if (snap.exists()) setUser(snap.data());
        // Troféer är bara läsbara av ägaren — faller tillbaka till 0 annars
        try {
          const trophySnap = await getDocs(collection(db, 'users', userId, 'unlockedTrophies'));
          setTrophyCount(trophySnap.size);
        } catch {
          setTrophyCount(0);
        }
      } catch (e) {
        console.warn('Kunde inte hämta användare:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [userId]);

  useEffect(() => {
    if (!currentUserId || !userId || isOwnProfile) return;
    const checkStatus = async () => {
      try {
        const myDoc = await getDoc(doc(db, 'users', currentUserId));
        const friends = myDoc.data()?.friends || [];
        if (friends.includes(userId)) { setFriendStatus('friend'); return; }
        const sentSnap = await getDocs(query(
          collection(db, 'friendRequests'),
          where('fromUserId', '==', currentUserId),
          where('toUserId', '==', userId),
          where('status', '==', 'pending')
        ));
        if (!sentSnap.empty) { setFriendStatus('sent'); return; }
        const receivedSnap = await getDocs(query(
          collection(db, 'friendRequests'),
          where('fromUserId', '==', userId),
          where('toUserId', '==', currentUserId),
          where('status', '==', 'pending')
        ));
        if (!receivedSnap.empty) { setFriendStatus('received'); return; }
        setFriendStatus('none');
      } catch (e) {
        console.warn('Kunde inte kolla vänskaps-status:', e);
      }
    };
    checkStatus();
  }, [currentUserId, userId, isOwnProfile]);

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

  const handleSendFriendRequest = async () => {
    if (!currentUserId || sendingRequest) return;
    setSendingRequest(true);
    try {
      await addDoc(collection(db, 'friendRequests'), {
        fromUserId: currentUserId,
        toUserId: userId,
        status: 'pending',
        timestamp: serverTimestamp(),
      });
      setFriendStatus('sent');
    } catch (e) {
      console.error('Fel vid skickande av vänförfrågan:', e);
    } finally {
      setSendingRequest(false);
    }
  };

  const renderFriendButton = () => {
    if (friendStatus === 'friend') {
      return (
        <View style={[styles.friendBtn, { backgroundColor: theme.colors.bgSoft }]}>
          <Ionicons name="people" size={18} color={theme.colors.textMuted} />
          <Text style={{ color: theme.colors.textMuted, fontWeight: '600', marginLeft: 6 }}>Vänner</Text>
        </View>
      );
    }
    if (friendStatus === 'sent') {
      return (
        <View style={[styles.friendBtn, { backgroundColor: theme.colors.bgSoft }]}>
          <Ionicons name="time-outline" size={18} color={theme.colors.textMuted} />
          <Text style={{ color: theme.colors.textMuted, fontWeight: '600', marginLeft: 6 }}>Förfrågan skickad</Text>
        </View>
      );
    }
    if (friendStatus === 'received') {
      return (
        <View style={[styles.friendBtn, { backgroundColor: theme.colors.bgSoft }]}>
          <Ionicons name="mail-outline" size={18} color={theme.colors.primary} />
          <Text style={{ color: theme.colors.primary, fontWeight: '600', marginLeft: 6 }}>Vill bli din vän</Text>
        </View>
      );
    }
    return (
      <TouchableOpacity
        style={[styles.friendBtn, { backgroundColor: theme.colors.primary }]}
        onPress={handleSendFriendRequest}
        disabled={sendingRequest}
        activeOpacity={0.8}
      >
        {sendingRequest ? (
          <ActivityIndicator size="small" color={theme.colors.primaryTextOn} />
        ) : (
          <>
            <Ionicons name="person-add-outline" size={18} color={theme.colors.primaryTextOn} />
            <Text style={{ color: theme.colors.primaryTextOn, fontWeight: '700', marginLeft: 6 }}>Lägg till vän</Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.colors.text }}>Ingen användare hittades.</Text>
      </SafeAreaView>
    );
  }

  const initialer = (user?.fornamn?.[0] || '') + (user?.efternamn?.[0] || '');
  const fullName = `${user?.fornamn || ''} ${user?.efternamn || ''}`.trim();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={{ paddingBottom: theme.space.xl * 2 }}>

        {/* Profilhuvud */}
        <View style={{ alignItems: 'center', marginTop: theme.space.xl, marginBottom: theme.space.lg }}>
          <Image
            style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: theme.colors.bgSoft }}
            source={{
              uri: user.profilbildUrl ||
                `https://placehold.co/150x150/6200ea/ffffff?text=${initialer || '?'}`,
            }}
          />
          <Text style={styles.smeknamn}>{user.smeknamn || 'Användare'}</Text>
          {fullName.length > 0 && (
            <Text style={{ color: theme.colors.textMuted, marginTop: 2 }}>{fullName}</Text>
          )}

          {/* Vän-knapp */}
          {!isOwnProfile && (
            <View style={{ marginTop: theme.space.md }}>
              {renderFriendButton()}
            </View>
          )}

          {/* Stats-rad */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{user.totalCheckinCount || 0}</Text>
              <Text style={styles.statLabel}>Incheckningar</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{user.visitedPlaygroundIds?.length || 0}</Text>
              <Text style={styles.statLabel}>Besökta lekplatser</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{trophyCount}</Text>
              <Text style={styles.statLabel}>Troféer</Text>
            </View>
          </View>
        </View>

        {/* Senaste incheckningarna */}
        <View style={{ paddingHorizontal: theme.space.lg }}>
          <Text style={styles.sectionTitle}>Senaste incheckningarna</Text>
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    smeknamn: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.colors.text,
      marginTop: theme.space.sm,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: theme.space.md,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      paddingVertical: theme.space.sm,
      paddingHorizontal: theme.space.xl,
    },
    statItem: {
      alignItems: 'center',
      paddingHorizontal: theme.space.lg,
    },
    statNumber: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.text,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    statDivider: {
      width: 1,
      height: 32,
      backgroundColor: theme.colors.border,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.space.sm,
    },
    friendBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 24,
    },
  });

export default PublicProfileScreen;
