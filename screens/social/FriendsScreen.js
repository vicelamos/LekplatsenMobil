
// FriendsScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../firebase';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

// 🟢 Tema & UI
import { useTheme } from '../../src/theme';
import { Card } from '../../src/ui';

// ---- Header för vänlistan (memo) ----
const FriendsListHeader = React.memo(function FriendsListHeader({
  searchQuery,
  setSearchQuery,
  isSearching,
  handleSearch,
  searchResults,
  renderSearchItem,
  pendingRequests,
  renderPendingRequest,
}) {
  const { theme } = useTheme();

  return (
    <View>
      {/* SÖK-SEKTION */}
      <Card style={{ padding: theme.space.md, marginHorizontal: theme.space.lg, marginTop: theme.space.md }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: theme.colors.text, marginBottom: 4 }}>
          Hitta Vänner
        </Text>
        <Text style={{ fontSize: 14, color: theme.colors.textMuted, marginBottom: theme.space.sm }}>
          Sök efter smeknamn
        </Text>

        <TextInput
          style={{
            width: '100%',
            height: 48,
            backgroundColor: theme.colors.inputBg || theme.colors.card,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
            paddingHorizontal: theme.space.md,
            fontSize: 16,
            color: theme.colors.text,
          }}
          placeholder="T.ex. LekplatsKalle"
          placeholderTextColor={theme.colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />

        <TouchableOpacity
          onPress={handleSearch}
          disabled={isSearching}
          style={{
            marginTop: theme.space.sm,
            height: 44,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            ...theme.shadow.floating,
            opacity: isSearching ? 0.7 : 1,
          }}
          activeOpacity={0.8}
        >
          {isSearching ? (
            <ActivityIndicator color={theme.colors.primaryTextOn} />
          ) : (
            <Text style={{ color: theme.colors.primaryTextOn, fontWeight: '800' }}>Sök</Text>
          )}
        </TouchableOpacity>

        {/* Sökresultat */}
        <View style={{ marginTop: theme.space.md }}>
          {searchResults.map((item) => renderSearchItem(item))}
          {searchResults.length === 0 && searchQuery.length > 0 && !isSearching && (
            <Text style={{ textAlign: 'center', color: theme.colors.textMuted, marginTop: theme.space.sm }}>
              Inga träffar.
            </Text>
          )}
        </View>
      </Card>

      {/* Inkommande vänförfrågningar */}
      {pendingRequests.length > 0 && (
        <Card style={{ padding: theme.space.md, marginHorizontal: theme.space.lg, marginTop: theme.space.md }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text, marginBottom: theme.space.sm }}>
            Väntande förfrågningar ({pendingRequests.length})
          </Text>
          {pendingRequests.map((req) => renderPendingRequest(req))}
        </Card>
      )}

      {/* Rubrik för vänlistan */}
      <View style={{ paddingHorizontal: theme.space.lg, paddingTop: theme.space.lg }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: theme.colors.text }}>Mina Vänner</Text>
      </View>
    </View>
  );
});

function FriendsScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [friendsList, setFriendsList] = useState([]);
  const [friendIds, setFriendIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequestIds, setSentRequestIds] = useState(new Set());

  const userId = auth.currentUser?.uid;

  // Hämta vänner
  const fetchFriends = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) {
        setFriendsList([]);
        setFriendIds([]);
        return;
      }
      const friendsArray = userDocSnap.data().friends || [];
      setFriendIds(friendsArray);

      if (friendsArray.length === 0) {
        setFriendsList([]);
        return;
      }
      const friendPromises = friendsArray.map((id) => getDoc(doc(db, 'users', id)));
      const friendDocs = await Promise.all(friendPromises);
      const friendsData = friendDocs
        .filter((docSnap) => docSnap.exists())
        .map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() }));
      setFriendsList(friendsData);
    } catch (error) {
      console.error('Fel vid hämtning av vänner:', error);
      Alert.alert('Fel', 'Kunde inte hämta din vänlista.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Hämta inkommande vänförfrågningar
  const fetchPendingRequests = useCallback(async () => {
    if (!userId) return;
    try {
      const q = query(
        collection(db, 'friendRequests'),
        where('toUserId', '==', userId),
        where('status', '==', 'pending')
      );
      const snapshot = await getDocs(q);
      const requests = await Promise.all(
        snapshot.docs.map(async (reqDoc) => {
          const data = reqDoc.data();
          const fromUserDoc = await getDoc(doc(db, 'users', data.fromUserId));
          return {
            id: reqDoc.id,
            ...data,
            fromUser: fromUserDoc.exists()
              ? { uid: fromUserDoc.id, ...fromUserDoc.data() }
              : null,
          };
        })
      );
      setPendingRequests(requests.filter((r) => r.fromUser !== null));
    } catch (error) {
      console.error('Fel vid hämtning av förfrågningar:', error);
    }
  }, [userId]);

  // Hämta redan skickade förfrågningar (för att visa rätt status i sökresultat)
  const fetchSentRequests = useCallback(async () => {
    if (!userId) return;
    try {
      const q = query(
        collection(db, 'friendRequests'),
        where('fromUserId', '==', userId),
        where('status', '==', 'pending')
      );
      const snapshot = await getDocs(q);
      const ids = new Set(snapshot.docs.map((d) => d.data().toUserId));
      setSentRequestIds(ids);
    } catch (error) {
      console.error('Fel vid hämtning av skickade förfrågningar:', error);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    fetchFriends();
    fetchPendingRequests();
    fetchSentRequests();
  }, [fetchFriends, fetchPendingRequests, fetchSentRequests]));

  // Sök efter nya vänner (prefix-sökning, case-insensitive via lowercase-fält)
  const handleSearch = useCallback(async () => {
    const trimmed = searchQuery.trim();
    if (trimmed === '') {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const prefix = trimmed.toLowerCase();
      const q = query(
        collection(db, 'users'),
        where('smeknamnLower', '>=', prefix),
        where('smeknamnLower', '<=', prefix + '\uf8ff')
      );
      const querySnapshot = await getDocs(q);
      const results = querySnapshot.docs
        .map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() }))
        .filter((user) => user.uid !== userId);
      setSearchResults(results);
    } catch (error) {
      console.error('Sökfel:', error);
      Alert.alert('Fel', 'Kunde inte utföra sökningen.');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, userId]);

  // Skicka vänförfrågan
  const handleSendFriendRequest = useCallback(async (targetUser) => {
    if (!userId) return;
    try {
      await addDoc(collection(db, 'friendRequests'), {
        fromUserId: userId,
        toUserId: targetUser.uid,
        status: 'pending',
        timestamp: serverTimestamp(),
      });
      setSentRequestIds((prev) => new Set([...prev, targetUser.uid]));
      Alert.alert('Förfrågan skickad!', `En vänförfrågan har skickats till ${targetUser.smeknamn}.`);
    } catch (error) {
      console.error('Fel vid skickande av vänförfrågan:', error);
      Alert.alert('Fel', 'Kunde inte skicka vänförfrågan.');
    }
  }, [userId]);

  // Acceptera vänförfrågan
  const handleAcceptRequest = useCallback(async (request) => {
    if (!userId) return;
    try {
      // Lägg till ömsesidigt vänskapband
      await Promise.all([
        updateDoc(doc(db, 'users', userId), { friends: arrayUnion(request.fromUserId) }),
        updateDoc(doc(db, 'users', request.fromUserId), { friends: arrayUnion(userId) }),
        updateDoc(doc(db, 'friendRequests', request.id), { status: 'accepted' }),
      ]);
      // Uppdatera lokal state
      setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
      setFriendsList((prev) => [...prev, request.fromUser]);
      setFriendIds((prev) => [...prev, request.fromUserId]);
      Alert.alert('Vän tillagd!', `${request.fromUser.smeknamn} är nu din vän.`);
    } catch (error) {
      console.error('Fel vid accepterande av förfrågan:', error);
      Alert.alert('Fel', 'Kunde inte acceptera förfrågan.');
    }
  }, [userId]);

  // Avvisa vänförfrågan
  const handleRejectRequest = useCallback(async (request) => {
    if (!userId) return;
    try {
      await deleteDoc(doc(db, 'friendRequests', request.id));
      setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
    } catch (error) {
      console.error('Fel vid avvisande av förfrågan:', error);
      Alert.alert('Fel', 'Kunde inte avvisa förfrågan.');
    }
  }, [userId]);

  // Ta bort vän
  const handleRemoveFriend = useCallback(async (friendToRemove) => {
    if (!userId) return;
    Alert.alert(
      'Ta bort vän',
      `Är du säker på att du vill ta bort ${friendToRemove.smeknamn} som vän?`,
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Ta bort',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all([
                updateDoc(doc(db, 'users', userId), { friends: arrayRemove(friendToRemove.uid) }),
                updateDoc(doc(db, 'users', friendToRemove.uid), { friends: arrayRemove(userId) }),
              ]);
              setFriendsList((prev) => prev.filter((user) => user.uid !== friendToRemove.uid));
              setFriendIds((prev) => prev.filter((id) => id !== friendToRemove.uid));
            } catch (error) {
              console.error('Fel vid borttagning av vän:', error);
              Alert.alert('Fel', 'Kunde inte ta bort vän.');
            }
          },
        },
      ]
    );
  }, [userId]);

  // Render: inkommande förfrågan
  const renderPendingRequest = useCallback((request) => {
    const user = request.fromUser;
    return (
      <View key={request.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: theme.space.xs }}>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
          onPress={() => navigation.navigate('PublicProfile', { userId: user.uid })}
        >
          <Image
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.bgSoft, marginRight: 10 }}
            source={{
              uri: user.profilbildUrl || `https://placehold.co/50x50/e0e0e0/ffffff?text=${user.smeknamn?.[0] || '?'}`,
            }}
          />
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.text }}>
            {user.smeknamn || user.email}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleAcceptRequest(request)}
          style={{ padding: 6, marginRight: 4 }}
        >
          <Ionicons name="checkmark-circle-outline" size={26} color={theme.colors.success} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleRejectRequest(request)}
          style={{ padding: 6 }}
        >
          <Ionicons name="close-circle-outline" size={26} color={theme.colors.danger} />
        </TouchableOpacity>
      </View>
    );
  }, [handleAcceptRequest, handleRejectRequest, navigation, theme]);

  // Render: vänkort
  const renderFriendItem = useCallback(({ item }) => (
    <Card style={{ marginHorizontal: theme.space.lg, marginTop: theme.space.sm, padding: theme.space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
          onPress={() => navigation.navigate('PublicProfile', { userId: item.uid })}
        >
          <Image
            style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: theme.colors.bgSoft, marginRight: 12 }}
            source={{
              uri:
                item.profilbildUrl ||
                `https://placehold.co/50x50/e0e0e0/ffffff?text=${item.smeknamn?.[0] || '?'}`,
            }}
          />
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: theme.colors.text }}>
            {item.smeknamn || item.email}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleRemoveFriend(item)} style={{ padding: 6 }}>
          <Ionicons name="person-remove-outline" size={22} color={theme.colors.danger} />
        </TouchableOpacity>
      </View>
    </Card>
  ), [handleRemoveFriend, navigation, theme.colors.text, theme.space.lg, theme.space.md]);

  // Render: sökresultat
  const renderSearchItem = useCallback((item) => {
    const isFriend = friendIds.includes(item.uid);
    const hasSentRequest = sentRequestIds.has(item.uid);
    const hasPendingFromThem = pendingRequests.some((r) => r.fromUserId === item.uid);
    return (
      <Card key={item.uid} style={{ marginHorizontal: theme.space.xs, marginTop: theme.space.xs, padding: theme.space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
            onPress={() => navigation.navigate('PublicProfile', { userId: item.uid })}
          >
            <Image
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.bgSoft, marginRight: 10 }}
              source={{
                uri:
                  item.profilbildUrl ||
                  `https://placehold.co/50x50/e0e0e0/ffffff?text=${item.smeknamn?.[0] || '?'}`,
              }}
            />
            <Text style={{ flex: 1, fontSize: 15, color: theme.colors.text }}>
              {item.smeknamn || item.email}
            </Text>
          </TouchableOpacity>
          {isFriend ? (
            <Text style={{ fontSize: 13, color: theme.colors.textMuted, fontStyle: 'italic' }}>
              Redan vän
            </Text>
          ) : hasPendingFromThem ? (
            <Text style={{ fontSize: 13, color: theme.colors.primary, fontStyle: 'italic' }}>
              Vill bli din vän
            </Text>
          ) : hasSentRequest ? (
            <Text style={{ fontSize: 13, color: theme.colors.textMuted, fontStyle: 'italic' }}>
              Förfrågan skickad
            </Text>
          ) : (
            <TouchableOpacity onPress={() => handleSendFriendRequest(item)} style={{ padding: 6 }}>
              <Ionicons name="person-add-outline" size={22} color={theme.colors.success} />
            </TouchableOpacity>
          )}
        </View>
      </Card>
    );
  }, [friendIds, sentRequestIds, pendingRequests, handleSendFriendRequest, navigation, theme]);

  const listHeaderComponent = useMemo(
    () => (
      <FriendsListHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isSearching={isSearching}
        handleSearch={handleSearch}
        searchResults={searchResults}
        renderSearchItem={renderSearchItem}
        pendingRequests={pendingRequests}
        renderPendingRequest={renderPendingRequest}
      />
    ),
    [searchQuery, isSearching, handleSearch, searchResults, renderSearchItem, pendingRequests, renderPendingRequest]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={friendsList}
          renderItem={renderFriendItem}
          keyExtractor={(item) => item.uid}
          ListHeaderComponent={listHeaderComponent}
          ListEmptyComponent={() => (
            <Text style={{ textAlign: 'center', color: theme.colors.textMuted, marginTop: theme.space.md }}>
              Du har inga vänner än. Börja med att söka!
            </Text>
          )}
          contentContainerStyle={{ paddingBottom: theme.space.xl * 2 }}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    // Behövs inte längre eftersom vi jobbar inline med theme,
    // men mallen finns kvar om du vill centralisera vissa stilar.
  });

export default FriendsScreen;
