// CheckInScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { File as ExpoFile } from 'expo-file-system';
import { auth, db, storage } from '../firebase';
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
  updateDoc,
  setDoc,
} from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';

// 🟢 Tema & UI
import { useTheme } from '../src/theme';
import { Card } from '../src/ui';

export default function CheckInScreen({ route, navigation }) {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const playgroundId = route.params?.playgroundId;

  const [pgName, setPgName] = useState('Lekplats');
  const [loadingPg, setLoadingPg] = useState(false);

  // Formstate
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  // Tid (från konfiguration)
  const [timeOptions, setTimeOptions] = useState([]);   // strängar
  const [selectedTime, setSelectedTime] = useState(''); // valt tidsintervall

  // Aktiviteter & utmaningar (från lekplats)
  const [equipmentOptions, setEquipmentOptions] = useState([]);
  const [challengeOptions, setChallengeOptions] = useState([]);
  const [gjordaAktiviteter, setGjordaAktiviteter] = useState([]);
  const [klaradeUtmaningar, setKlaradeUtmaningar] = useState([]);
  const [previouslyCompleted, setPreviouslyCompleted] = useState([]); // Redan klarade utmaningar

  // Övrigt
  const [imageUri, setImageUri] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // State för vänner och taggning
  const [allFriends, setAllFriends] = useState([]); // Hela vänlistan
  const [friendSearch, setFriendSearch] = useState(''); // Söksträng
  const [filteredFriends, setFilteredFriends] = useState([]); // Vänner som matchar sökning
  const [taggedFriends, setTaggedFriends] = useState([]); // Valda vänner att tagga {id, smeknamn, profilbildUrl}

  const userId = auth.currentUser?.uid || null;
  const userSmeknamn = auth.currentUser?.displayName || 'Användare';

  useEffect(() => {
    navigation.setOptions({ title: 'Checka in' });
  }, [navigation]);

  // Hämta lekplatsnamn + utrustning + utmaningar + redan klarade utmaningar
  useEffect(() => {
    const loadPlayground = async () => {
      if (!playgroundId) return;
      setLoadingPg(true);
      try {
        const snap = await getDoc(doc(db, 'lekplatser', playgroundId));
        if (snap.exists()) {
          const d = snap.data();
          setPgName(d.namn || d.name || 'Lekplats');
          setEquipmentOptions(Array.isArray(d.utrustning) ? d.utrustning : []);
          setChallengeOptions(Array.isArray(d.utmaningar) ? d.utmaningar : []);
        }

        // Hämta redan klarade utmaningar för denna användare + lekplats
        if (userId) {
          const completedSnap = await getDoc(doc(db, 'users', userId, 'klaradeUtmaningar', playgroundId));
          if (completedSnap.exists()) {
            const completed = completedSnap.data().utmaningar || [];
            setPreviouslyCompleted(completed);
          }
        }
      } catch (e) {
        console.warn('Kunde inte hämta lekplatsdata', e);
      } finally {
        setLoadingPg(false);
      }
    };
    loadPlayground();
  }, [playgroundId]);

  // Hämta tidsalternativ
  useEffect(() => {
    const loadTimeOptions = async () => {
      try {
        const snap = await getDoc(doc(db, 'konfiguration', 'alternativ'));
        if (snap.exists()) {
          const d = snap.data();
          setTimeOptions(Array.isArray(d.tid) ? d.tid : []);
        } else {
          setTimeOptions([]);
        }
      } catch (e) {
        console.warn('Kunde inte hämta tidsalternativ', e);
        setTimeOptions([]);
      } finally {
        setLoadingOptions(false);
      }
    };
    loadTimeOptions();
  }, []);

  // Hämta vänner för taggning
  useEffect(() => {
    const fetchFriends = async () => {
      if (!userId) return;
      try {
        const userSnap = await getDoc(doc(db, 'users', userId));
        if (userSnap.exists()) {
          const friendIds = userSnap.data().friends || [];
          if (friendIds.length > 0) {
            const friendDocs = await Promise.all(friendIds.map(id => getDoc(doc(db, 'users', id))));
            const friendsList = friendDocs
              .filter(d => d.exists())
              .map(d => ({ id: d.id, smeknamn: d.data().smeknamn, profilbildUrl: d.data().profilbildUrl }));
            setAllFriends(friendsList);
          }
        }
      } catch (err) {
        console.error("Kunde inte hämta vänner:", err);
      }
    };
    fetchFriends();
  }, [userId]);

  // Filtrera vänner vid sökning
  useEffect(() => {
    if (friendSearch.trim() === '') {
      setFilteredFriends([]);
      return;
    }
    const searchLower = friendSearch.toLowerCase();
    // Filtrera bort redan taggade vänner från sökresultatet
    const availableFriends = allFriends.filter(f => !taggedFriends.some(tf => tf.id === f.id));
    setFilteredFriends(
      availableFriends.filter(f => f.smeknamn.toLowerCase().includes(searchLower))
    );
  }, [friendSearch, allFriends, taggedFriends]);

  // Stjärnor
  const Stars = useMemo(() => {
    const items = [];
    for (let i = 1; i <= 5; i++) {
      const filled = i <= rating;
      items.push(
        <TouchableOpacity key={`s-${i}`} onPress={() => setRating(i)} style={{ padding: 4 }}>
          <Ionicons
            name={filled ? 'star' : 'star-outline'}
            size={24}
            color={filled ? theme.colors.star : theme.colors.textMuted}
          />
        </TouchableOpacity>
      );
    }
    return <View style={{ flexDirection: 'row' }}>{items}</View>;
  }, [rating, theme.colors.textMuted]);

  // helpers
  const uploadBase64 = async (storageRef, base64Data) => {
    const bucket = 'lekplatsen-907fb.firebasestorage.app';
    const encodedPath = encodeURIComponent(storageRef.fullPath);
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}`;
    const token = await auth.currentUser?.getIdToken();
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed: ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Upload XHR error'));
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'image/jpeg');
      xhr.setRequestHeader('X-Goog-Upload-Protocol', 'raw');
      if (token) xhr.setRequestHeader('Authorization', `Firebase ${token}`);
      xhr.send(bytes);
    });
  };

  // Funktioner för att hantera taggade vänner
  const addTaggedFriend = (friend) => {
    // Säkerställ att vännen inte redan är tillagd
    if (!taggedFriends.some(tf => tf.id === friend.id)) {
      setTaggedFriends([...taggedFriends, friend]);
    }
    setFriendSearch(''); // Rensa sökfältet
    setFilteredFriends([]); // Göm sökresultaten
  };

  const removeTaggedFriend = (friendId) => {
    setTaggedFriends(taggedFriends.filter(f => f.id !== friendId));
  };


  // Bild
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Behörighet krävs', 'Appen behöver åtkomst till dina bilder.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
    });
    if (!res.canceled) setImageUri(res.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Behörighet krävs', 'Appen behöver åtkomst till kameran.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.85,
    });
    if (!res.canceled) setImageUri(res.assets[0].uri);
  };

  const uploadImageIfAny = async (checkInDocId) => {
    if (!imageUri) return '';
    console.log('CheckInScreen: startar uppladdning', { checkInDocId, imageUri });
    try {
      setUploading(true);
      const file = new ExpoFile(imageUri);
      const base64Data = await file.base64();
      console.log('CheckInScreen: base64 length', base64Data.length);
      const ext = 'jpg';
      const path = `images/checkins/${checkInDocId}/${Date.now()}.${ext}`;
      const storageRef = ref(storage, path);
      await uploadBase64(storageRef, base64Data);
      console.log('CheckInScreen: upload lyckades', path);
      const url = await getDownloadURL(storageRef);
      console.log('CheckInScreen: downloadURL', url);
      return url;
    } catch (e) {
      console.error('CheckInScreen: Uppladdning misslyckades:', e);
      Alert.alert('Fel', 'Kunde inte ladda upp bilden. Kontrollera nätverk eller filformat.');
      return '';
    } finally {
      setUploading(false);
    }
  };

  // Multival-helper
  const toggleFromArray = (value, list, setter) => {
    const exists = list.includes(value);
    if (exists) setter(list.filter((v) => v !== value));
    else setter([...list, value]);
  };

  // Skapa incheckning
  const submit = async () => {
    try {
      if (!userId) {
        Alert.alert('Inte inloggad', 'Du måste vara inloggad för att checka in.');
        return;
      }
      if (!playgroundId) {
        Alert.alert('Saknar lekplats', 'Kan inte checka in utan lekplats-id.');
        return;
      }
      if (rating <= 0) {
        Alert.alert('Betyg saknas', 'Välj ett betyg (1–5).');
        return;
      }
      setSubmitting(true);

      const baseDoc = {
        betyg: Number(rating),
        bildUrl: '',
        commentCount: 0,
        gjordaAktiviteter,
        klaradeUtmaningar,
        kommentar: (comment || '').trim(),
        lekplatsId: playgroundId,
        lekplatsNamn: pgName || '',
        likes: [],
        taggadeVanner: taggedFriends.map(f => f.id), // Spara bara IDn
        tidPaLekplats: (selectedTime || '').toString().trim(),
        timestamp: serverTimestamp(),
        userId,
        userSmeknamn,
      };

      const refCol = collection(db, 'incheckningar');
      const created = await addDoc(refCol, baseDoc);

      // Bild (valfritt)
      if (imageUri) {
        const finalBildUrl = await uploadImageIfAny(created.id);
        console.log('CheckInScreen: uploadImageIfAny returnerade', finalBildUrl);
        if (finalBildUrl) {
          await updateDoc(doc(db, 'incheckningar', created.id), { bildUrl: finalBildUrl });
        } else {
          Alert.alert('Fel', 'Bilden laddades inte upp, incheckningen sparades utan bild.');
        }
      }

      Alert.alert('Klart!', 'Din incheckning är sparad.');

      // Spara klarade utmaningar lokalt per användare + lekplats
      if (klaradeUtmaningar.length > 0) {
        const allCompleted = [...new Set([...previouslyCompleted, ...klaradeUtmaningar])];
        await setDoc(doc(db, 'users', userId, 'klaradeUtmaningar', playgroundId), {
          utmaningar: allCompleted,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      navigation.goBack();
    } catch (e) {
      console.error('Kunde inte skapa incheckning:', e);
      Alert.alert('Fel', 'Kunde inte skapa incheckningen. Försök igen.');
    } finally {
      setSubmitting(false);
    }
  };

  // Temaanpassad, valbar chip med stöd för "redan klarad" markering
  const SelectableChip = ({ label, selected, completed, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        completed && !selected && { borderColor: theme.colors.success, backgroundColor: theme.colors.successSoft },
        selected && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
      ]}
      activeOpacity={0.8}
    >
      {completed && !selected && (
        <Ionicons name="checkmark-circle" size={14} color={theme.colors.success} style={{ marginRight: 4 }} />
      )}
      <Text
        style={[
          styles.chipText,
          completed && !selected && { color: theme.colors.success },
          selected && { color: theme.colors.primaryStrong || theme.colors.primary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView contentContainerStyle={{ padding: theme.space.lg, paddingBottom: theme.space.xl }}>
        {/* Lekplatsheader */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: theme.space.xs }}>
          <Ionicons name="location-outline" size={18} color={theme.colors.text} />
          <Text style={{ fontWeight: '800', color: theme.colors.text }}>
            {loadingPg ? 'Laddar…' : pgName}
          </Text>
        </View>

        {/* Betyg */}
        <Card style={{ padding: theme.space.md, marginTop: theme.space.sm }}>
          <Text style={{ fontWeight: '800', color: theme.colors.text, marginBottom: theme.space.xs }}>Betyg</Text>
          {Stars}
        </Card>

        {/* Kommentar */}
        <Card style={{ padding: theme.space.md, marginTop: theme.space.sm }}>
          <Text style={{ fontWeight: '800', color: theme.colors.text, marginBottom: theme.space.xs }}>
            Kommentar (valfritt)
          </Text>
          <TextInput
            style={styles.inputMultiline}
            value={comment}
            onChangeText={setComment}
            placeholder="Hur var lekplatsen?"
            placeholderTextColor={theme.colors.textMuted}
            multiline
            numberOfLines={4}
          />
        </Card>

        {/* Tid på lekplatsen */}
        <Card style={{ padding: theme.space.md, marginTop: theme.space.sm }}>
          <Text style={{ fontWeight: '800', color: theme.colors.text, marginBottom: theme.space.xs }}>
            Tid på lekplatsen
          </Text>
          {loadingOptions ? (
            <Text style={{ color: theme.colors.textMuted }}>Laddar tidsalternativ…</Text>
          ) : (
            <View style={styles.chipsWrap}>
              {timeOptions.map((opt) => (
                <SelectableChip
                  key={opt}
                  label={opt}
                  selected={selectedTime === opt}
                  onPress={() => setSelectedTime(opt)}
                />
              ))}
            </View>
          )}
          {!!selectedTime && (
            <Text style={{ marginTop: 6, color: theme.colors.textMuted, fontSize: 12 }}>
              Valt: {selectedTime}
            </Text>
          )}
        </Card>

        {/* Gjorda aktiviteter */}
        <Card style={{ padding: theme.space.md, marginTop: theme.space.sm }}>
          <Text style={{ fontWeight: '800', color: theme.colors.text, marginBottom: theme.space.xs }}>
            Gjorda aktiviteter
          </Text>
          {equipmentOptions.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted }}>
              Inga utrustningsalternativ hittades för denna lekplats.
            </Text>
          ) : (
            <View style={styles.chipsWrap}>
              {equipmentOptions.map((opt) => (
                <SelectableChip
                  key={opt}
                  label={opt}
                  selected={gjordaAktiviteter.includes(opt)}
                  onPress={() => toggleFromArray(opt, gjordaAktiviteter, setGjordaAktiviteter)}
                />
              ))}
            </View>
          )}
        </Card>

        {/* Klarade utmaningar */}
        <Card style={{ padding: theme.space.md, marginTop: theme.space.sm }}>
          <Text style={{ fontWeight: '800', color: theme.colors.text, marginBottom: theme.space.xs }}>
            Klarade utmaningar
          </Text>
          {challengeOptions.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted }}>
              Inga utmaningar finns registrerade för denna lekplats.
            </Text>
          ) : (
            <View style={styles.chipsWrap}>
              {challengeOptions.map((opt) => (
                <SelectableChip
                  key={opt}
                  label={opt}
                  selected={klaradeUtmaningar.includes(opt)}
                  completed={previouslyCompleted.includes(opt)}
                  onPress={() => toggleFromArray(opt, klaradeUtmaningar, setKlaradeUtmaningar)}
                />
              ))}
            </View>
          )}
        </Card>

        {/* -- NYTT: Tagga vänner -- */}
        <Card style={{ padding: theme.space.md, marginTop: theme.space.sm }}>
          <Text style={{ fontWeight: '800', color: theme.colors.text, marginBottom: theme.space.xs }}>
            Tagga vänner som var med
          </Text>
          <TextInput
            style={[styles.inputMultiline, { minHeight: 50, height: 50, marginBottom: theme.space.sm }]}
            value={friendSearch}
            onChangeText={setFriendSearch}
            placeholder="Sök bland dina vänner..."
            placeholderTextColor={theme.colors.textMuted}
          />

          {/* Sökresultat */}
          {friendSearch.length > 0 && filteredFriends.length > 0 && (
            <View style={styles.friendSearchResults}>
              {filteredFriends.map((friend) => (
                <TouchableOpacity
                  key={friend.id}
                  style={styles.friendResultItem}
                  onPress={() => addTaggedFriend(friend)}
                >
                  <Image
                    source={{ uri: friend.profilbildUrl || `https://ui-avatars.com/api/?name=${friend.smeknamn}` }}
                    style={styles.avatarTiny}
                  />
                  <Text style={{ color: theme.colors.text }}>{friend.smeknamn}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Taggade vänner */}
          {taggedFriends.length > 0 && (
            <View style={styles.chipsWrap}>
              {taggedFriends.map((friend) => (
                <View key={friend.id} style={styles.taggedFriendChip}>
                  <Text style={styles.taggedFriendText}>{friend.smeknamn}</Text>
                  <TouchableOpacity onPress={() => removeTaggedFriend(friend.id)} style={{ marginLeft: 4 }}>
                    <Ionicons name="close-circle" size={16} color={theme.colors.primary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Bild */}
        <Card style={{ padding: theme.space.md, marginTop: theme.space.sm }}>
          <Text style={{ fontWeight: '800', color: theme.colors.text, marginBottom: theme.space.xs }}>
            Bild (valfritt)
          </Text>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.preview} />
          ) : (
            <View style={styles.previewPlaceholder}>
              <Text style={{ color: theme.colors.textMuted }}>Ingen bild vald</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: theme.space.sm, marginTop: theme.space.xs }}>
            <TouchableOpacity
              onPress={pickImage}
              style={[
                styles.btn,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.text,
                },
              ]}
            >
              <Ionicons name="images-outline" size={16} color={theme.colors.text} />
              <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Välj från galleri</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={takePhoto}
              style={[
                styles.btn,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.text,
                },
              ]}
            >
              <Ionicons name="camera-outline" size={16} color={theme.colors.text} />
              <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Ta foto</Text>
            </TouchableOpacity>
          </View>
          {uploading ? (
            <Text style={{ marginTop: 6, color: theme.colors.textMuted, fontSize: 12 }}>
              Laddar upp bild…
            </Text>
          ) : null}
        </Card>

        {/* CTA */}
        <TouchableOpacity
          onPress={submit}
          style={[
            styles.primaryBtn(theme),
            (submitting || uploading) && { opacity: 0.7 },
          ]}
          disabled={submitting || uploading}
        >
          {submitting ? (
            <ActivityIndicator color={theme.colors.primaryTextOn} />
          ) : (
            <Text style={{ color: theme.colors.primaryTextOn, fontWeight: '800' }}>
              Skapa incheckning
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: theme.space.md }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    inputMultiline: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.space.md,
      paddingVertical: 10,
      minHeight: 90,
      textAlignVertical: 'top',
      backgroundColor: theme.colors.inputBg,
      color: theme.colors.text,
    },
    avatarTiny: {
      width: 30,
      height: 30,
      borderRadius: 15,
      marginRight: 10,
      backgroundColor: theme.colors.bgSoft
    },
    friendSearchResults: {
      maxHeight: 150,
      backgroundColor: theme.colors.bgSoft,
      borderRadius: theme.radius.md,
      marginBottom: theme.space.sm,
    },
    friendResultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.space.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    taggedFriendChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primarySoft,
      borderRadius: 999,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    taggedFriendText: {
      color: theme.colors.primaryStrong,
      fontWeight: '600',
    },
    preview: {
      width: '100%',
      height: 180,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.bgSoft,
    },
    previewPlaceholder: {
      width: '100%',
      height: 180,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.bgSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btn: {
      flex: 1,
      height: 42,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
      borderWidth: 1,
    },
    chipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    chipText: {
      color: theme.colors.text,
      fontWeight: '600',
    },
    primaryBtn: (theme) => ({
      marginTop: theme.space.md,
      height: 50,
      borderRadius: 999,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadow.floating,
    }),
  });
