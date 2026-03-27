// EditCheckInScreen.js
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
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { File as ExpoFile } from 'expo-file-system';
import { auth, db, storage } from '../../firebase';
import { compressImage, getReadableFileSize } from '../../utils/imageCompression';
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';

import { useTheme } from '../../src/theme';
import { Card } from '../../src/ui';


export default function EditCheckInScreen({ route, navigation }) {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const { checkInId, checkIn } = route.params;

  const [pgName] = useState(checkIn.lekplatsNamn || 'Lekplats');
  const playgroundId = checkIn.lekplatsId;

  // Formstate — pre-populerat med befintliga värden
  const [rating, setRating] = useState(checkIn.betyg || 0);
  const [comment, setComment] = useState(checkIn.kommentar || '');

  // Expanderbar detaljsektion — öppna direkt om detaljer finns
  const hasExistingDetails =
    (checkIn.tidPaLekplats || '') !== '' ||
    (checkIn.gjordaAktiviteter?.length > 0) ||
    (checkIn.klaradeUtmaningar?.length > 0) ||
    (checkIn.taggadeVanner?.length > 0);
  const [showDetails, setShowDetails] = useState(hasExistingDetails);

  // Tid
  const [timeOptions, setTimeOptions] = useState([]);
  const [selectedTime, setSelectedTime] = useState(checkIn.tidPaLekplats || '');

  // Aktiviteter & utmaningar
  const [equipmentOptions, setEquipmentOptions] = useState([]);
  const [challengeOptions, setChallengeOptions] = useState([]);
  const [gjordaAktiviteter, setGjordaAktiviteter] = useState(checkIn.gjordaAktiviteter || []);
  const [klaradeUtmaningar, setKlaradeUtmaningar] = useState(checkIn.klaradeUtmaningar || []);
  const [previouslyCompleted, setPreviouslyCompleted] = useState([]);

  // Bild
  const [imageUri, setImageUri] = useState(null); // ny lokal bild
  const [existingBildUrl, setExistingBildUrl] = useState(checkIn.bildUrl || '');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Vänner
  const [allFriends, setAllFriends] = useState([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [taggedFriends, setTaggedFriends] = useState([]);

  const userId = auth.currentUser?.uid || null;

  useEffect(() => {
    navigation.setOptions({ title: 'Redigera incheckning' });
  }, [navigation]);

  // Hämta lekplatsdata för chips-alternativ
  useEffect(() => {
    const load = async () => {
      if (!playgroundId) return;
      try {
        const snap = await getDoc(doc(db, 'lekplatser', playgroundId));
        if (snap.exists()) {
          const d = snap.data();
          setEquipmentOptions(Array.isArray(d.utrustning) ? d.utrustning : []);
          setChallengeOptions(Array.isArray(d.utmaningar) ? d.utmaningar : []);
        }

        if (userId) {
          const completedSnap = await getDoc(doc(db, 'users', userId, 'klaradeUtmaningar', playgroundId));
          if (completedSnap.exists()) {
            setPreviouslyCompleted(completedSnap.data().utmaningar || []);
          }
        }
      } catch (e) {
        console.warn('Kunde inte hämta lekplatsdata', e);
      }
    };
    load();
  }, [playgroundId]);

  // Hämta tidsalternativ
  useEffect(() => {
    const loadTimeOptions = async () => {
      try {
        const snap = await getDoc(doc(db, 'konfiguration', 'alternativ'));
        if (snap.exists()) {
          const d = snap.data();
          setTimeOptions(Array.isArray(d.tid) ? d.tid : []);
        }
      } catch (e) {
        console.warn('Kunde inte hämta tidsalternativ', e);
      }
    };
    loadTimeOptions();
  }, []);

  // Hämta vänner + pre-populera taggade vänner
  useEffect(() => {
    const fetchFriends = async () => {
      if (!userId) return;
      try {
        const userSnap = await getDoc(doc(db, 'users', userId));
        if (!userSnap.exists()) return;
        const friendIds = userSnap.data().friends || [];
        if (friendIds.length === 0) return;
        const friendDocs = await Promise.all(friendIds.map(id => getDoc(doc(db, 'users', id))));
        const friendsList = friendDocs
          .filter(d => d.exists())
          .map(d => ({ id: d.id, smeknamn: d.data().smeknamn, profilbildUrl: d.data().profilbildUrl }));
        setAllFriends(friendsList);

        // Pre-populera taggade vänner från befintlig incheckning
        const existingTagged = checkIn.taggadeVanner || [];
        if (existingTagged.length > 0) {
          const tagged = friendsList.filter(f => existingTagged.includes(f.id));
          setTaggedFriends(tagged);
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
    const available = allFriends.filter(f => !taggedFriends.some(tf => tf.id === f.id));
    setFilteredFriends(available.filter(f => f.smeknamn.toLowerCase().includes(searchLower)));
  }, [friendSearch, allFriends, taggedFriends]);

  const toggleDetails = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowDetails(prev => !prev);
  };

  // Stjärnor
  const Stars = useMemo(() => {
    const items = [];
    for (let i = 1; i <= 5; i++) {
      const filled = i <= rating;
      items.push(
        <TouchableOpacity key={`s-${i}`} onPress={() => setRating(i)} style={{ padding: 4 }}>
          <Ionicons
            name={filled ? 'star' : 'star-outline'}
            size={32}
            color={filled ? theme.colors.star : theme.colors.textMuted}
          />
        </TouchableOpacity>
      );
    }
    return <View style={{ flexDirection: 'row', gap: 4 }}>{items}</View>;
  }, [rating, theme.colors.textMuted]);

  const uploadBase64 = async (storageRef, base64Data) => {
    const bucket = storageRef.bucket;
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

  const addTaggedFriend = (friend) => {
    if (!taggedFriends.some(tf => tf.id === friend.id)) {
      setTaggedFriends([...taggedFriends, friend]);
    }
    setFriendSearch('');
    setFilteredFriends([]);
  };

  const removeTaggedFriend = (friendId) => {
    setTaggedFriends(taggedFriends.filter(f => f.id !== friendId));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Behörighet krävs', 'Appen behöver åtkomst till dina bilder.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      quality: 0.75,
    });
    if (!res.canceled) {
      const compressedUri = await compressImage(res.assets[0].uri, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.75,
      });
      setImageUri(compressedUri);
      setExistingBildUrl(''); // ersätt befintlig bild
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Behörighet krävs', 'Appen behöver åtkomst till kameran.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.75,
    });
    if (!res.canceled) {
      const compressedUri = await compressImage(res.assets[0].uri, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.75,
      });
      setImageUri(compressedUri);
      setExistingBildUrl('');
    }
  };

  const showImageOptions = () => {
    Alert.alert('Byt bild', '', [
      { text: 'Välj från galleri', onPress: pickImage },
      { text: 'Ta foto', onPress: takePhoto },
      { text: 'Ta bort bild', style: 'destructive', onPress: () => { setImageUri(null); setExistingBildUrl(''); } },
      { text: 'Avbryt', style: 'cancel' },
    ]);
  };

  const uploadImageIfNew = async () => {
    if (!imageUri) return existingBildUrl;
    try {
      setUploading(true);
      const file = new ExpoFile(imageUri);
      const base64Data = await file.base64();
      const path = `images/checkins/${userId}/${checkInId}/${Date.now()}.jpg`;
      const storageRef = ref(storage, path);
      await uploadBase64(storageRef, base64Data);
      return await getDownloadURL(storageRef);
    } catch (e) {
      console.error('EditCheckInScreen: Uppladdning misslyckades:', e);
      Alert.alert('Fel', 'Kunde inte ladda upp bilden.');
      return existingBildUrl;
    } finally {
      setUploading(false);
    }
  };

  const toggleFromArray = (value, list, setter) => {
    if (list.includes(value)) setter(list.filter(v => v !== value));
    else setter([...list, value]);
  };

  const save = async () => {
    try {
      if (rating <= 0) {
        Alert.alert('Betyg saknas', 'Välj ett betyg (1–5).');
        return;
      }
      setSubmitting(true);

      const finalBildUrl = await uploadImageIfNew();

      await updateDoc(doc(db, 'incheckningar', checkInId), {
        betyg: Number(rating),
        kommentar: (comment || '').trim(),
        bildUrl: finalBildUrl || '',
        gjordaAktiviteter,
        klaradeUtmaningar,
        taggadeVanner: taggedFriends.map(f => f.id),
        tidPaLekplats: (selectedTime || '').toString().trim(),
        redigerad: true,
        redigeradAt: serverTimestamp(),
      });

      Alert.alert('Sparat!', 'Din incheckning är uppdaterad.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      console.error('Kunde inte uppdatera incheckning:', e);
      Alert.alert('Fel', 'Kunde inte spara ändringarna. Försök igen.');
    } finally {
      setSubmitting(false);
    }
  };

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

  const displayImage = imageUri || existingBildUrl || null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView contentContainerStyle={{ padding: theme.space.lg, paddingBottom: theme.space.xl }}>

        {/* Lekplatsheader (låst) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: theme.space.sm }}>
          <Ionicons name="location-outline" size={18} color={theme.colors.text} />
          <Text style={{ fontWeight: '800', fontSize: 16, color: theme.colors.text }}>{pgName}</Text>
        </View>

        {/* === SNABB-LÄGE === */}

        {/* Betyg */}
        <Card style={{ padding: theme.space.md, marginBottom: theme.space.sm, alignItems: 'center' }}>
          <Text style={{ fontWeight: '800', color: theme.colors.text, marginBottom: theme.space.sm, fontSize: 15 }}>
            Hur var det?
          </Text>
          {Stars}
        </Card>

        {/* Kommentar + bildknapp */}
        <Card style={{ padding: theme.space.md, marginBottom: theme.space.sm }}>
          <TextInput
            style={styles.inputMultiline}
            value={comment}
            onChangeText={setComment}
            placeholder="Lägg till en kommentar… (valfritt)"
            placeholderTextColor={theme.colors.textMuted}
            multiline
            numberOfLines={3}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.space.sm, gap: theme.space.sm }}>
            <TouchableOpacity onPress={showImageOptions} style={styles.imageBtn}>
              <Ionicons name="camera-outline" size={20} color={theme.colors.primary} />
              <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 13 }}>
                {displayImage ? 'Byt bild' : 'Lägg till bild'}
              </Text>
            </TouchableOpacity>
            {displayImage && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <Image source={{ uri: displayImage }} style={styles.imageThumbnail} />
                <TouchableOpacity onPress={() => { setImageUri(null); setExistingBildUrl(''); }}>
                  <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}
          </View>
          {uploading && (
            <Text style={{ marginTop: 6, color: theme.colors.textMuted, fontSize: 12 }}>Laddar upp bild…</Text>
          )}
        </Card>

        {/* Spara-knapp */}
        <TouchableOpacity
          onPress={save}
          style={[styles.primaryBtn, (submitting || uploading) && { opacity: 0.7 }]}
          disabled={submitting || uploading}
        >
          {submitting ? (
            <ActivityIndicator color={theme.colors.primaryTextOn} />
          ) : (
            <Text style={{ color: theme.colors.primaryTextOn, fontWeight: '800', fontSize: 16 }}>
              Spara ändringar
            </Text>
          )}
        </TouchableOpacity>

        {/* Detaljer-toggle */}
        <TouchableOpacity onPress={toggleDetails} style={styles.detailsToggle}>
          <Text style={{ color: theme.colors.link, fontWeight: '700', fontSize: 14 }}>
            {showDetails ? 'Dölj detaljer ▲' : 'Lägg till detaljer ▼'}
          </Text>
        </TouchableOpacity>

        {/* === EXPANDERBAR DETALJSEKTION === */}
        {showDetails && (
          <View>
            {/* Tid på lekplatsen */}
            <Card style={{ padding: theme.space.md, marginTop: theme.space.sm }}>
              <Text style={{ fontWeight: '800', color: theme.colors.text, marginBottom: theme.space.xs }}>
                Tid på lekplatsen
              </Text>
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

            {/* Tagga vänner */}
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
          </View>
        )}

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
      minHeight: 80,
      textAlignVertical: 'top',
      backgroundColor: theme.colors.inputBg,
      color: theme.colors.text,
    },
    imageBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    imageThumbnail: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.bgSoft,
    },
    avatarTiny: {
      width: 30,
      height: 30,
      borderRadius: 15,
      marginRight: 10,
      backgroundColor: theme.colors.bgSoft,
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
    primaryBtn: {
      height: 54,
      borderRadius: 999,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadow?.floating,
    },
    detailsToggle: {
      marginTop: theme.space.md,
      alignItems: 'center',
      paddingVertical: theme.space.sm,
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
  });
