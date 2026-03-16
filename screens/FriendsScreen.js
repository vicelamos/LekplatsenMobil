
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
import { auth, db } from '../firebase';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

// 🟢 Tema & UI
import { useTheme } from '../src/theme';
import { Card } from '../src/ui';

// ---- Header för vänlistan (memo) ----
const FriendsListHeader = React.memo(function FriendsListHeader({
  searchQuery,
  setSearchQuery,
  isSearching,
  handleSearch,
  searchResults,
  renderSearchItem,
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

  useFocusEffect(useCallback(() => { fetchFriends(); }, [fetchFriends]));

  // Sök efter nya vänner
  const handleSearch = useCallback(async () => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const q = query(collection(db, 'users'), where('smeknamn', '==', searchQuery.trim()));
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

  // Lägg till vän
  const handleAddFriend = useCallback(async (friendToAdd) => {
    if (!userId) return;
    try {
      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, { friends: arrayUnion(friendToAdd.uid) });
      setFriendsList((prev) => [...prev, friendToAdd]);
      setFriendIds((prev) => [...prev, friendToAdd.uid]);
      setSearchResults((prev) => prev.filter((user) => user.uid !== friendToAdd.uid));
      Alert.alert('Vän tillagd!', `${friendToAdd.smeknamn} är nu din vän.`);
    } catch (error) {
      console.error('Fel vid tillägg av vän:', error);
      Alert.alert('Fel', 'Kunde inte lägga till vän.');
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
              const userDocRef = doc(db, 'users', userId);
              await updateDoc(userDocRef, { friends: arrayRemove(friendToRemove.uid) });
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

  // Render-funktioner
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

  const renderSearchItem = useCallback((item) => {
    const isFriend = friendIds.includes(item.uid);
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
          ) : (
            <TouchableOpacity onPress={() => handleAddFriend(item)} style={{ padding: 6 }}>
              <Ionicons name="person-add-outline" size={22} color={theme.colors.success} />
            </TouchableOpacity>
          )}
        </View>
      </Card>
    );
  }, [friendIds, handleAddFriend, navigation, theme.colors.text, theme.colors.textMuted, theme.space.xs, theme.space.sm]);

  const listHeaderComponent = useMemo(
    () => (
      <FriendsListHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isSearching={isSearching}
        handleSearch={handleSearch}
        searchResults={searchResults}
        renderSearchItem={renderSearchItem}
      />
    ),
    [searchQuery, isSearching, handleSearch, searchResults, renderSearchItem]
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
