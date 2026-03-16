import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { useTheme } from '../src/theme';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationsScreen({ navigation }) {
  const { theme } = useTheme();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const uid = auth.currentUser?.uid;

  // add header button
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={clearAll}
          style={{ paddingHorizontal: 12 }}
        >
          <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Rensa</Text>
        </TouchableOpacity>
      ),
      headerTitleStyle: { color: theme.colors.primary },
      headerStyle: { backgroundColor: theme.colors.cardBg },
    });
  }, [navigation, theme]);

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'users', uid, 'notifications'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifs(items);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  const markAsRead = async (id) => {
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid, 'notifications', id), { read: true });
  };

  const clearAll = async () => {
    if (!uid) return;
    Alert.alert(
      'Rensa notiser',
      'Är du säker på att du vill ta bort alla notiser?',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Rensa',
          style: 'destructive',
          onPress: async () => {
            try {
              const snap = await getDocs(collection(db, 'users', uid, 'notifications'));
              const batch = writeBatch(db);
              snap.forEach(docSnap => batch.delete(docSnap.ref));
              await batch.commit();
              setNotifs([]);
            } catch (e) {
              console.warn('Kunde inte rensa notiser', e);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    let iconName;
    switch ((item.type || '').toUpperCase()) {
      case 'COMMENT': iconName = 'chatbubble-outline'; break;
      case 'MENTION': iconName = 'at-outline'; break;
      case 'TROPHY': iconName = 'trophy-outline'; break;
      case 'LIKE': iconName = 'heart-outline'; break;
      default: iconName = 'notifications-outline';
    }

    return (
      <TouchableOpacity
        onPress={async () => {
          if (!item.read) await markAsRead(item.id);

          // navigate based on type/link
          const link = item.link || '';
          // try to extract checkin id from link if present
          let checkInId = null;
          const match = link.match(/inchecknings?\/?([^\/]+)/);
          if (match) checkInId = match[1];

          if ((item.type === 'COMMENT' || item.type === 'LIKE') && checkInId) {
            navigation.navigate('Comments', { checkInId, checkInComment: '' });
          } else if (item.type === 'TROPHY') {
            navigation.navigate('Trophies');
          } else if (item.type === 'ADMIN_REVIEW' || item.type === 'ADMIN_SUGGESTION') {
            navigation.navigate('ReviewDrafts');
          } else if (item.type === 'PLAYGROUND_APPROVED' || item.type === 'PLAYGROUND_REJECTED' || item.type === 'SUGGESTION_UPDATE') {
            const lekplatsMatch = link.match(/\/lekplats\/(.+)/);
            if (lekplatsMatch) {
              navigation.navigate('PlaygroundDetails', { id: lekplatsMatch[1] });
            }
          } else if (item.type === 'TAG' || item.type === 'MENTION') {
            const checkinMatch = link.match(/\/incheckning\/(.+)/);
            if (checkinMatch) {
              navigation.navigate('Comments', { checkInId: checkinMatch[1], checkInComment: '' });
            }
          } else if (checkInId) {
            navigation.navigate('Comments', { checkInId, checkInComment: '' });
          } else if (link) {
            const parts = link.split('/');
            if (parts[1]) navigation.navigate(parts[1], { id: parts[2] });
            else console.warn('Unknown link format on notification:', link);
          } else {
            console.warn('Notification has no link/target', item);
          }
        }}
        style={{
          padding: theme.space.md,
          backgroundColor: item.read ? theme.colors.card : theme.colors.primarySoft,
          borderBottomWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name={iconName} size={20} color={theme.colors.primary} style={{ marginRight: theme.space.sm }} />
          <Text style={{ fontWeight: '800', color: theme.colors.text, flex: 1 }}>{item.title}</Text>
          {!item.read && (
            <View style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: theme.colors.primary,
              marginLeft: theme.space.sm,
            }} />
          )}
        </View>
        <Text style={{ color: theme.colors.textMuted, marginTop: theme.space.xs }}>{item.message}</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg }}>
        <ActivityIndicator color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (notifs.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent:'center',alignItems:'center', backgroundColor: theme.colors.bg }}>
        <Text style={{ color: theme.colors.textMuted }}>Inga notiser än</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <FlatList
        data={notifs}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop: theme.space.lg, paddingBottom: theme.space.xl * 2 }}
        style={{ backgroundColor: theme.colors.bg }}
        ListHeaderComponent={<View style={{ height: theme.space.xl }} />}
        ListFooterComponent={
          notifs.length > 0 ? (
            <View>
              <TouchableOpacity
                onPress={clearAll}
                style={{ alignSelf: 'center', marginVertical: theme.space.md }}
              >
                <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Rensa</Text>
              </TouchableOpacity>
              <View style={{ height: theme.space.xl }} />
            </View>
          ) : (
            <View style={{ height: theme.space.xl }} />
          )
        }
      />
    </SafeAreaView>
  );
}