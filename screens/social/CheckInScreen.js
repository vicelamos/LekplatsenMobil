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
  Modal,
  Linking,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { File as ExpoFile } from 'expo-file-system';
import { signInAnonymously } from 'firebase/auth';
import { auth, db, storage } from '../../firebase';
import { compressImage, getReadableFileSize } from '../../utils/imageCompression';
import { checkinImagePath } from '../../utils/anonymization';
import { uploadBase64 } from '../../src/services/storageService';
import { trackSponsorEvent } from '../../utils/sponsorAnalytics';
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';

// 🟢 Tema & UI
import { useTheme } from '../../src/theme';
import { Card } from '../../src/ui';
import { useAppReview } from '../../src/hooks/useAppReview';


export default function CheckInScreen({ route, navigation }) {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const { maybeRequestReview } = useAppReview();
  const playgroundId = route.params?.playgroundId;
  const isGuest = route.params?.guest === true;

  const [guestName, setGuestName] = useState('');
  const [anonReady, setAnonReady] = useState(!isGuest);

  const [pgName, setPgName] = useState('Lekplats');
  const [loadingPg, setLoadingPg] = useState(false);

  // Formstate
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  // Expanderbar detaljsektion
  const [showDetails, setShowDetails] = useState(false);

  // Tid (från konfiguration)
  const [timeOptions, setTimeOptions] = useState([]);
  const [selectedTime, setSelectedTime] = useState('');

  // Aktiviteter & utmaningar (från lekplats)
  const [equipmentOptions, setEquipmentOptions] = useState([]);
  const [challengeOptions, setChallengeOptions] = useState([]);
  const [gjordaAktiviteter, setGjordaAktiviteter] = useState([]);
  const [klaradeUtmaningar, setKlaradeUtmaningar] = useState([]);
  const [previouslyCompleted, setPreviouslyCompleted] = useState([]);

  // Övrigt
  const [imageUri, setImageUri] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Sponsor-popup
  const [sponsorData, setSponsorData] = useState(null);
  const [sponsorId, setSponsorId] = useState(null);
  const [sponsorModal, setSponsorModal] = useState(false);

  // Vänner och taggning
  const [allFriends, setAllFriends] = useState([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [taggedFriends, setTaggedFriends] = useState([]);

  const userId = auth.currentUser?.uid || null;
  const trimmedGuestName = guestName.trim();
  const userSmeknamn = isGuest
    ? trimmedGuestName
    : (auth.currentUser?.displayName || 'Användare');

  useEffect(() => {
    navigation.setOptions({ title: isGuest ? 'Checka in som gäst' : 'Checka in' });
  }, [navigation, isGuest]);

  // Logga in anonymt för gäst-incheckning så Firestore-reglerna håller
  useEffect(() => {
    if (!isGuest) return;
    if (auth.currentUser) {
      setAnonReady(true);
      return;
    }
    let cancelled = false;
    signInAnonymously(auth)
      .then(() => { if (!cancelled) setAnonReady(true); })
      .catch((e) => {
        console.warn('Anonym inloggning misslyckades:', e);
        Alert.alert('Fel', 'Kunde inte starta gäst-incheckningen. Försök igen.');
        navigation.goBack();
      });
    return () => { cancelled = true; };
  }, [isGuest, navigation]);

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

        if (userId && !isGuest) {
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
      if (!userId || isGuest) return;
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
    const availableFriends = allFriends.filter(f => !taggedFriends.some(tf => tf.id === f.id));
    setFilteredFriends(
      availableFriends.filter(f => f.smeknamn.toLowerCase().includes(searchLower))
    );
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

  // Bild
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
    }
  };

  const showImageOptions = () => {
    Alert.alert('Lägg till bild', '', [
      { text: 'Välj från galleri', onPress: pickImage },
      { text: 'Ta foto', onPress: takePhoto },
      { text: 'Avbryt', style: 'cancel' },
    ]);
  };

  const uploadImageIfAny = async (checkInDocId) => {
    if (!imageUri) return '';
    try {
      setUploading(true);
      const file = new ExpoFile(imageUri);
      const base64Data = await file.base64();
      const path = checkinImagePath(checkInDocId, `${Date.now()}.jpg`);
      const storageRef = ref(storage, path);
      await uploadBase64(storageRef, base64Data);
      const url = await getDownloadURL(storageRef);
      return url;
    } catch (e) {
      console.error('CheckInScreen: Uppladdning misslyckades:', e);
      Alert.alert('Fel', 'Kunde inte ladda upp bilden. Kontrollera nätverk eller filformat.');
      return '';
    } finally {
      setUploading(false);
    }
  };

  const toggleFromArray = (value, list, setter) => {
    const exists = list.includes(value);
    if (exists) setter(list.filter((v) => v !== value));
    else setter([...list, value]);
  };

  // Skapa incheckning
  const submit = async () => {
    try {
      const currentUid = auth.currentUser?.uid;
      if (!currentUid) {
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
      if (isGuest && trimmedGuestName.length < 2) {
        Alert.alert('Namn saknas', 'Ange ett namn (minst 2 tecken).');
        return;
      }
      setSubmitting(true);

      const baseDoc = {
        betyg: Number(rating),
        bildUrl: '',
        commentCount: 0,
        gjordaAktiviteter: isGuest ? [] : gjordaAktiviteter,
        klaradeUtmaningar: isGuest ? [] : klaradeUtmaningar,
        kommentar: (comment || '').trim(),
        lekplatsId: playgroundId,
        lekplatsNamn: pgName || '',
        likes: [],
        taggadeVanner: isGuest ? [] : taggedFriends.map(f => f.id),
        tidPaLekplats: isGuest ? '' : (selectedTime || '').toString().trim(),
        timestamp: serverTimestamp(),
        userId: currentUid,
        userSmeknamn,
        ...(isGuest ? { isGuest: true } : {}),
      };

      const refCol = collection(db, 'incheckningar');
      const created = await addDoc(refCol, baseDoc);

      // Bild (valfritt) — ej tillgängligt för gäst
      if (!isGuest && imageUri) {
        const finalBildUrl = await uploadImageIfAny(created.id);
        if (finalBildUrl) {
          await updateDoc(doc(db, 'incheckningar', created.id), { bildUrl: finalBildUrl });
        } else {
          Alert.alert('Fel', 'Bilden laddades inte upp, incheckningen sparades utan bild.');
        }
      }

      // Klarade utmaningar hanteras nu enbart av molnfunktionen
      // updateUserAndPlaygroundStats (skriver users/{uid}/klaradeUtmaningar/{lekplatsId}
      // och ökar totalCompletedChallenges i samma transaktion). Klienten skriver
      // därför inte längre själv – det undvek dubbelräkning och en race mot
      // funktionens transaktion. Fältet klaradeUtmaningar följer med incheckningsdoken.

      // Kolla sponsorskap
      try {
        const pgSnap = await getDoc(doc(db, 'lekplatser', playgroundId));
        const sp = pgSnap.data()?.sponsorship;
        if (sp?.active && sp?.sponsorId) {
          const sponsorSnap = await getDoc(doc(db, 'sponsors', sp.sponsorId));
          if (sponsorSnap.exists()) {
            setSponsorData(sponsorSnap.data());
            setSponsorId(sp.sponsorId);
            setSponsorModal(true);
            trackSponsorEvent(sp.sponsorId, 'popupOpens');
            return;
          }
        }
      } catch (_) {}

      Alert.alert('Klart!', 'Din incheckning är sparad.', [
        { text: 'OK', onPress: async () => {
          if (!isGuest && auth.currentUser) {
            try {
              const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
              const count = userSnap.data()?.totalCheckinCount || 0;
              await maybeRequestReview(count);
            } catch (_) {}
          }
          navigation.goBack();
        }},
      ]);
    } catch (e) {
      console.error('Kunde inte skapa incheckning:', e);
      Alert.alert('Fel', 'Kunde inte skapa incheckningen. Försök igen.');
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView contentContainerStyle={{ padding: theme.space.lg, paddingBottom: 80 + theme.space.xl }}>

        {/* Lekplatsheader */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: theme.space.sm }}>
          <Ionicons name="location-outline" size={18} color={theme.colors.text} />
          <Text style={{ fontWeight: '800', fontSize: 16, color: theme.colors.text }}>
            {loadingPg ? 'Laddar…' : pgName}
          </Text>
        </View>

        {isGuest && (
          <Card style={{ padding: theme.space.md, marginBottom: theme.space.sm }}>
            <Text style={{ fontWeight: '800', color: theme.colors.text, marginBottom: theme.space.xs, fontSize: 14 }}>
              Ditt namn
            </Text>
            <TextInput
              style={[styles.inputMultiline, { minHeight: 44, height: 44 }]}
              value={guestName}
              onChangeText={setGuestName}
              placeholder="Vad ska vi kalla dig?"
              placeholderTextColor={theme.colors.textMuted}
              maxLength={30}
              returnKeyType="done"
            />
            <Text style={{ marginTop: theme.space.sm, color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 }}>
              Du checkar in som gäst. Logga in eller registrera dig för att även kunna lägga till bilder, tagga vänner, klara utmaningar och samla troféer — och för att kunna redigera eller ta bort din incheckning senare.
            </Text>
            <TouchableOpacity
              style={styles.guestLoginBtn}
              onPress={() => navigation.navigate('Login', {
                returnTo: 'CheckIn',
                returnParams: { playgroundId },
              })}
            >
              <Ionicons name="log-in-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.guestLoginBtnText}>Logga in / Registrera dig</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* === SNABB-LÄGE === */}

        {/* Betyg — stort och centrerat */}
        <Card style={{ padding: theme.space.md, marginBottom: theme.space.sm, alignItems: 'center' }}>
          <Text style={{ fontWeight: '800', color: theme.colors.text, marginBottom: theme.space.sm, fontSize: 15 }}>
            Hur var det?
          </Text>
          {Stars}
        </Card>

        {/* Kommentar + bildknapp på samma rad */}
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
          {/* Bildrad under kommentar — endast inloggad användare */}
          {!isGuest && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.space.sm, gap: theme.space.sm }}>
              <TouchableOpacity onPress={showImageOptions} style={styles.imageBtn}>
                <Ionicons name="camera-outline" size={20} color={theme.colors.primary} />
                {imageUri ? (
                  <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 13 }}>Bild vald</Text>
                ) : (
                  <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 13 }}>Lägg till bild</Text>
                )}
              </TouchableOpacity>
              {imageUri && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  <Image source={{ uri: imageUri }} style={styles.imageThumbnail} />
                  <TouchableOpacity onPress={() => setImageUri(null)}>
                    <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          {!isGuest && uploading && (
            <Text style={{ marginTop: 6, color: theme.colors.textMuted, fontSize: 12 }}>Laddar upp bild…</Text>
          )}
        </Card>

        {/* Lägg till detaljer-knapp — endast inloggad användare */}
        {!isGuest && (
          <TouchableOpacity onPress={toggleDetails} style={styles.detailsToggle}>
            <Text style={{ color: theme.colors.link, fontWeight: '700', fontSize: 14 }}>
              {showDetails ? 'Dölj detaljer ▲' : 'Lägg till detaljer ▼'}
            </Text>
          </TouchableOpacity>
        )}

        {/* === EXPANDERBAR DETALJSEKTION === */}
        {!isGuest && showDetails && (
          <View>
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

      {/* Checka in-knapp — alltid synlig längst ner */}
      <View style={{ paddingHorizontal: theme.space.lg, paddingBottom: theme.space.lg, paddingTop: theme.space.sm, backgroundColor: theme.colors.bg }}>
        <TouchableOpacity
          onPress={submit}
          style={[styles.primaryBtn, (submitting || uploading || !anonReady) && { opacity: 0.7 }]}
          disabled={submitting || uploading || !anonReady}
        >
          {submitting || !anonReady ? (
            <ActivityIndicator color={theme.colors.primaryTextOn} />
          ) : (
            <Text style={{ color: theme.colors.primaryTextOn, fontWeight: '800', fontSize: 16 }}>
              Checka in
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Sponsor-popup */}
      <Modal visible={sponsorModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: theme.colors.cardBg, borderRadius: 24, padding: 28, width: '100%', alignItems: 'center', borderWidth: 3, borderColor: theme.colors.primary }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text, textAlign: 'center', marginBottom: 4 }}>
              {pgName}
            </Text>
            <Text style={{ fontSize: 12, color: theme.colors.textMuted, marginBottom: 16, letterSpacing: 1, textTransform: 'uppercase' }}>
              Sponsrad av
            </Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: theme.colors.text, textAlign: 'center', marginBottom: 16 }}>
              {sponsorData?.name}
            </Text>
            {sponsorData?.logoUrl ? (
              <Image source={{ uri: sponsorData.logoUrl }} style={{ width: 220, height: 120, borderRadius: 14, marginBottom: 16 }} resizeMode="contain" />
            ) : null}
            {sponsorData?.description ? (
              <Text style={{ color: theme.colors.textMuted, textAlign: 'center', fontSize: 15, marginBottom: 16, lineHeight: 22 }}>
                {sponsorData.description}
              </Text>
            ) : null}
            {sponsorData?.address ? (
              <TouchableOpacity
                onPress={() => { trackSponsorEvent(sponsorId, 'hittaHitClicks'); Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(sponsorData.address)}`); }}
                style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Ionicons name="navigate-outline" size={18} color={theme.colors.primary} />
                <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 16 }}>Hitta hit</Text>
              </TouchableOpacity>
            ) : null}
            {sponsorData?.website ? (
              <TouchableOpacity
                onPress={() => {
                  const url = sponsorData.website.startsWith('http') ? sponsorData.website : `https://${sponsorData.website}`;
                  trackSponsorEvent(sponsorId, 'websiteClicks');
                  Linking.openURL(url);
                }}
                style={{ marginBottom: 16 }}
              >
                <Text style={{ color: theme.colors.link, fontSize: 14, textDecorationLine: 'underline' }}>
                  {sponsorData.website}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => { setSponsorModal(false); navigation.goBack(); }}
              style={{ height: 50, width: '100%', borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}
            >
              <Text style={{ color: theme.colors.primaryTextOn, fontWeight: '800', fontSize: 16 }}>Stäng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    guestLoginBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: theme.space.sm,
      paddingVertical: 10,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    guestLoginBtnText: {
      color: theme.colors.primary,
      fontWeight: '700',
      fontSize: 14,
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
