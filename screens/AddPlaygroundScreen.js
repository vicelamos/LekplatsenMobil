
// AddPlaygroundScreen.js
import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';

import { auth, db, storage } from '../firebase';
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';

// 🟢 Tema & UI
import { useTheme, mapStyle } from '../src/theme';
import { Card } from '../src/ui';

/* -------------------------------------------------------------------------- */
/* Komponenter                                                                */
/* -------------------------------------------------------------------------- */
// Temaanpassad, valbar chip för flervalslistor
const SelectableChip = ({ label, selected, onPress }) => {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
          marginRight: 8,
          marginBottom: 8,
        },
        selected && {
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.primarySoft || '#DCFCE7',
        },
      ]}
    >
      <Text
        style={[
          { color: theme.colors.text, fontWeight: '600' },
          selected && { color: theme.colors.primaryStrong || theme.colors.primary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

export default function AddPlaygroundScreen({ route, navigation }) {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const playgroundId = route.params?.id || null; // finns = redigera, annars skapa

  // Formfält
  const [namn, setNamn] = useState('');
  const [adress, setAdress] = useState('');
  const [kommun, setKommun] = useState('');
  const [beskrivning, setBeskrivning] = useState('');
  const [bildUrl, setBildUrl] = useState('');
  const [localImage, setLocalImage] = useState(null);
  const [status, setStatus] = useState('publicerad');

  // Alternativ från konfiguration/alternativ
  const [optFaciliteter, setOptFaciliteter] = useState([]);
  const [optUtrustning, setOptUtrustning] = useState([]);
  const [optUtmaningar, setOptUtmaningar] = useState([]);

  // Valda flerfält
  const [faciliteter, setFaciliteter] = useState([]);
  const [utrustning, setUtrustning] = useState([]);
  const [utmaningar, setUtmaningar] = useState([]);

  // Karta/position
  const FALLBACK_REGION = {
    latitude: 59.334,
    longitude: 18.063,
    latitudeDelta: 0.2,
    longitudeDelta: 0.2,
  };
  const [region, setRegion] = useState(FALLBACK_REGION);
  const [marker, setMarker] = useState(null); // { latitude, longitude }
  const mapRef = useRef(null);

  // States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: playgroundId ? 'Redigera lekplats' : 'Ny lekplats' });
  }, [navigation, playgroundId]);

  // Admin-koll
  useEffect(() => {
    (async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        setIsAdmin(false);
        return;
      }
      try {
        const up = await getDoc(doc(db, 'users', uid));
        setIsAdmin(!!up.exists() && !!up.data()?.isAdmin);
      } catch {
        setIsAdmin(false);
      }
    })();
  }, []);

  // Hämta konfig-alternativ
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'konfiguration', 'alternativ'));
        if (snap.exists()) {
          const d = snap.data();
          setOptFaciliteter(Array.isArray(d.faciliteter) ? d.faciliteter : []);
          setOptUtmaningar(Array.isArray(d.utmaningar) ? d.utmaningar : []);
          setOptUtrustning(Array.isArray(d.utrustning) ? d.utrustning : []);
        }
      } catch (e) {
        console.warn('Kunde inte hämta alternativen:', e);
      }
    })();
  }, []);

  // Init region: redigering → dokumentets position, annars försök centera på användaren
  useEffect(() => {
    (async () => {
      try {
        if (playgroundId) {
          const snap = await getDoc(doc(db, 'lekplatser', playgroundId));
          if (snap.exists()) {
            const d = snap.data();
            setNamn(d.namn || d.name || '');
            setAdress(d.adress || d.address || '');
            setKommun(d.kommun || '');
            setBeskrivning(d.beskrivning || d.description || '');
            setBildUrl(d.bildUrl || d.imageUrl || '');
            setStatus(d.status || 'publicerad');
            setFaciliteter(Array.isArray(d.faciliteter) ? d.faciliteter : []);
            setUtrustning(Array.isArray(d.utrustning) ? d.utrustning : []);
            setUtmaningar(Array.isArray(d.utmaningar) ? d.utmaningar : []);

            // position från dokumentet
            let lat = null,
              lng = null;
            if (d.location?.latitude && d.location?.longitude) {
              lat = d.location.latitude;
              lng = d.location.longitude;
            } else if (typeof d.position === 'string' && d.position.includes(',')) {
              const [la, lo] = d.position.split(',');
              lat = Number(la.trim());
              lng = Number(lo.trim());
            }

            if (
              typeof lat === 'number' &&
              typeof lng === 'number' &&
              !isNaN(lat) &&
              !isNaN(lng)
            ) {
              const r = { latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 };
              setRegion(r);
              setMarker({ latitude: lat, longitude: lng });
            } else {
              await centerOnUser();
            }
          } else {
            Alert.alert('Hittas inte', 'Lekplatsen finns inte längre.');
            navigation.goBack?.();
            return;
          }
        } else {
          await centerOnUser();
        }
      } catch (e) {
        console.warn('Init fel:', e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playgroundId]);

  const centerOnUser = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setRegion(FALLBACK_REGION);
        // permission denied – fall back silently
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      // debug log kept; remove or comment out if not needed
      console.log('centerOnUser got pos', pos);
      const r = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
      setRegion(r);
      // placera pinnen på användarens position också
      setMarker({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      // animera kartan så att vi ser det
      if (mapRef.current && mapRef.current.animateToRegion) {
        mapRef.current.animateToRegion(r, 500);
      }
    } catch (e) {
      console.warn('centerOnUser error', e);
      setRegion(FALLBACK_REGION);
      // ignore error - silent fallback
    }
  };

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
    if (!res.canceled) setLocalImage(res.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Behörighet krävs', 'Appen behöver åtkomst till kameran.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.9,
    });
    if (!res.canceled) setLocalImage(res.assets[0].uri);
  };

  const uploadImageIfAny = async (docId) => {
    if (!localImage) return '';
    console.log('AddPlaygroundScreen: startar uppladdning', { docId, localImage });
    try {
      setUploading(true);
      const file = new File(localImage);
      const base64Data = await file.base64();
      console.log('AddPlaygroundScreen: base64 length', base64Data.length);
      const ext = 'jpg';
      const path = `images/playgrounds/${docId}/${Date.now()}.${ext}`;
      const storageRef = ref(storage, path);
      await uploadBase64(storageRef, base64Data);
      console.log('AddPlaygroundScreen: upload lyckades', path);
      const url = await getDownloadURL(storageRef);
      console.log('AddPlaygroundScreen: downloadURL', url);
      return url;
    } catch (e) {
      console.error('AddPlaygroundScreen: Uppladdning misslyckades:', e);
      Alert.alert('Fel', 'Kunde inte ladda upp bilden. Försök igen.');
      return '';
    } finally {
      setUploading(false);
    }
  };

  const toggleFromArray = (value, list, setter) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const validate = () => {
    if (!isAdmin && playgroundId) {
      Alert.alert('Behörighet saknas', 'Endast administratörer får redigera lekplatser.');
      return false;
    }
    if (!namn.trim()) {
      Alert.alert('Namn saknas', 'Ange ett namn.');
      return false;
    }
    if (!marker) {
      Alert.alert('Position saknas', 'Tryck i kartan för att sätta ut en pin.');
      return false;
    }
    return true;
  };

  const save = async () => {
    if (!validate()) return;
    try {
      setSaving(true);

      const latNum = marker.latitude;
      const lngNum = marker.longitude;

      const effectiveStatus = isAdmin ? (status || 'publicerad') : 'review';

      const baseData = {
        namn: namn.trim(),
        adress: adress.trim(),
        kommun: kommun.trim(),
        beskrivning: beskrivning.trim(),
        bildUrl: bildUrl || '',
        faciliteter,
        utmaningar,
        utrustning,
        status: playgroundId ? (status || 'publicerad') : effectiveStatus,
        position: `${latNum}, ${lngNum}`,
        location: { latitude: latNum, longitude: lngNum },
        updatedAt: serverTimestamp(),
      };

      if (playgroundId) {
        await setDoc(doc(db, 'lekplatser', playgroundId), baseData, { merge: true });
        if (localImage) {
          const url = await uploadImageIfAny(playgroundId);
          if (url) {
            await updateDoc(doc(db, 'lekplatser', playgroundId), { bildUrl: url });
            setBildUrl(url);
          }
        }
        Alert.alert('Sparat', 'Lekplatsen har uppdaterats.');
        navigation.goBack?.();
      } else {
        const created = await addDoc(collection(db, 'lekplatser'), {
          ...baseData,
          createdBy: auth.currentUser?.uid || '',
          snittbetyg: 0,
          antalIncheckningar: 0,
          createdAt: serverTimestamp(),
        });
        if (localImage) {
          const url = await uploadImageIfAny(created.id);
          console.log('AddPlaygroundScreen: uploadImageIfAny returnerade', url);
          if (url) {
            await updateDoc(doc(db, 'lekplatser', created.id), { bildUrl: url });
            setBildUrl(url);
          } else {
            Alert.alert('Fel', 'Bilden laddades inte upp men lekplatsen skapades.');
          }
        }
        if (isAdmin) {
          Alert.alert('Skapad', 'Lekplatsen är skapad och publicerad.');
          navigation.replace('PlaygroundDetails', { id: created.id });
        } else {
          Alert.alert(
            'Tack!',
            'Lekplatsen har skickats in för granskning. En administratör kommer att granska den innan den publiceras.',
            [{ text: 'OK', onPress: () => navigation.goBack?.() }]
          );
        }
      }
    } catch (e) {
      console.error('Kunde inte spara lekplats:', e);
      Alert.alert('Fel', 'Kunde inte spara. Försök igen.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!playgroundId) return;
    Alert.alert('Ta bort lekplats', 'Är du säker? Detta går inte att ångra.', [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Ta bort',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'lekplatser', playgroundId));
            Alert.alert('Borttagen', 'Lekplatsen har raderats.');
            navigation.popToTop?.();
          } catch (e) {
            Alert.alert('Fel', 'Kunde inte ta bort lekplatsen.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.bg }]}>
        <ActivityIndicator />
        <Text style={{ color: theme.colors.textMuted, marginTop: theme.space.xs }}>
          Laddar formulär…
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView contentContainerStyle={{ padding: theme.space.lg, paddingBottom: theme.space.xl }}>
        {/* BASFÄLT */}
        <Card style={{ padding: theme.space.md }}>
          <Text style={styles.label}>Namn *</Text>
          <TextInput
            style={styles.input}
            value={namn}
            onChangeText={setNamn}
            placeholder="t.ex. Sjöbo torgs lekplats"
            placeholderTextColor={theme.colors.textMuted}
          />

          <Text style={styles.label}>Adress</Text>
          <TextInput
            style={styles.input}
            value={adress}
            onChangeText={setAdress}
            placeholder="t.ex. Sjöbo torg 1"
            placeholderTextColor={theme.colors.textMuted}
          />

          <Text style={styles.label}>Kommun</Text>
          <TextInput
            style={styles.input}
            value={kommun}
            onChangeText={setKommun}
            placeholder="t.ex. Borås Stad"
            placeholderTextColor={theme.colors.textMuted}
          />

          <Text style={styles.label}>Beskrivning</Text>
          <TextInput
            style={styles.inputMultiline}
            value={beskrivning}
            onChangeText={setBeskrivning}
            placeholder="Beskriv lekplatsen kort…"
            placeholderTextColor={theme.colors.textMuted}
            multiline
          />
        </Card>

        {/* KARTA / POSITION */}
        <Card style={{ padding: theme.space.md, marginTop: theme.space.sm }}>
          <Text style={styles.label}>Position (välj i kartan)</Text>
          <View style={[mapStyle.containerStyle, { height: 260, width: '100%' }]}>
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              initialRegion={region}
              region={region}
              customMapStyle={mapStyle.customMapStyle}
              onRegionChangeComplete={setRegion}
              onPress={(e) => setMarker(e.nativeEvent.coordinate)}
            >
              {marker && (
                <Marker
                  coordinate={marker}
                  draggable
                  anchor={{ x: 0.5, y: 1 }}
                  onDragEnd={(e) => setMarker(e.nativeEvent.coordinate)}
                >
                  <MaterialCommunityIcons name="seesaw" size={40} color={mapStyle.markerColor} />
                </Marker>
              )}
            </MapView>
          </View>

          <View style={{ flexDirection: 'row', gap: theme.space.sm, marginTop: theme.space.xs }}>
            <TouchableOpacity
              onPress={centerOnUser}
              style={[
                styles.btn(theme),
                { backgroundColor: theme.colors.card, borderColor: theme.colors.text },
              ]}
            >
              <Ionicons name="locate-outline" size={16} color={theme.colors.text} />
              <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Använd min position</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMarker(null)}
              style={[
                styles.btn(theme),
                { backgroundColor: theme.colors.card, borderColor: theme.colors.text },
              ]}
            >
              <Ionicons name="trash-outline" size={16} color={theme.colors.text} />
              <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Rensa pin</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.infoMuted}>
            Tips: Tryck i kartan för att placera pinnen. Du kan sedan dra den för finjustering.
          </Text>
          {marker && (
            <Text style={[styles.infoMuted, { marginTop: 2 }]}>
              Vald position: {marker.latitude.toFixed(6)}, {marker.longitude.toFixed(6)}
            </Text>
          )}
        </Card>

        {/* BILD */}
        <Card style={{ padding: theme.space.md, marginTop: theme.space.sm }}>
          <Text style={styles.label}>Bild (valfritt)</Text>
          {localImage ? (
            <Image source={{ uri: localImage }} style={styles.preview} />
          ) : bildUrl ? (
            <Image source={{ uri: bildUrl }} style={styles.preview} />
          ) : (
            <View style={styles.previewPlaceholder}>
              <Text style={{ color: theme.colors.textMuted }}>Ingen bild</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: theme.space.sm, marginTop: theme.space.xs }}>
            <TouchableOpacity
              onPress={pickImage}
              style={[
                styles.btn(theme),
                { backgroundColor: theme.colors.card, borderColor: theme.colors.text },
              ]}
            >
              <Ionicons name="images-outline" size={16} color={theme.colors.text} />
              <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Galleri</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={takePhoto}
              style={[
                styles.btn(theme),
                { backgroundColor: theme.colors.card, borderColor: theme.colors.text },
              ]}
            >
              <Ionicons name="camera-outline" size={16} color={theme.colors.text} />
              <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Kamera</Text>
            </TouchableOpacity>
          </View>
          {uploading ? (
            <Text style={styles.infoMuted}>Laddar upp…</Text>
          ) : null}
        </Card>

        {/* FACILITETER */}
        <Card style={{ padding: theme.space.md, marginTop: theme.space.sm }}>
          <Text style={styles.label}>Faciliteter</Text>
          {optFaciliteter.length === 0 ? (
            <Text style={styles.infoMuted}>Inga alternativ hittades i konfiguration.</Text>
          ) : (
            <View style={styles.chipsWrap}>
              {optFaciliteter.map((opt) => (
                <SelectableChip
                  key={opt}
                  label={opt}
                  selected={faciliteter.includes(opt)}
                  onPress={() => toggleFromArray(opt, faciliteter, setFaciliteter)}
                />
              ))}
            </View>
          )}
        </Card>

        {/* UTRUSTNING */}
        <Card style={{ padding: theme.space.md, marginTop: theme.space.sm }}>
          <Text style={styles.label}>Utrustning</Text>
          {optUtrustning.length === 0 ? (
            <Text style={styles.infoMuted}>Inga alternativ hittades i konfiguration.</Text>
          ) : (
            <View style={styles.chipsWrap}>
              {optUtrustning.map((opt) => (
                <SelectableChip
                  key={opt}
                  label={opt}
                  selected={utrustning.includes(opt)}
                  onPress={() => toggleFromArray(opt, utrustning, setUtrustning)}
                />
              ))}
            </View>
          )}
        </Card>

        {/* UTMANINGAR */}
        <Card style={{ padding: theme.space.md, marginTop: theme.space.sm }}>
          <Text style={styles.label}>Utmaningar</Text>
          {optUtmaningar.length === 0 ? (
            <Text style={styles.infoMuted}>Inga alternativ hittades i konfiguration.</Text>
          ) : (
            <View style={styles.chipsWrap}>
              {optUtmaningar.map((opt) => (
                <SelectableChip
                  key={opt}
                  label={opt}
                  selected={utmaningar.includes(opt)}
                  onPress={() => toggleFromArray(opt, utmaningar, setUtmaningar)}
                />
              ))}
            </View>
          )}
        </Card>

        {/* INFO FÖR ICKE-ADMIN */}
        {!isAdmin && !playgroundId && (
          <Card style={{ padding: theme.space.md, marginTop: theme.space.sm, borderLeftWidth: 4, borderLeftColor: theme.colors.info }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs, marginBottom: theme.space.xs }}>
              <Ionicons name="information-circle" size={20} color={theme.colors.info} />
              <Text style={{ fontWeight: '800', color: theme.colors.text }}>Granskning krävs</Text>
            </View>
            <Text style={{ color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 }}>
              Nya lekplatser granskas av en administratör innan de blir publika och synliga för alla. Du får ett meddelande när den har godkänts.
            </Text>
          </Card>
        )}

        {/* ACTIONS */}
        <TouchableOpacity
          onPress={save}
          style={[
            styles.primaryBtn(theme),
            (saving || uploading || (!isAdmin && playgroundId)) && { opacity: 0.7 },
          ]}
          disabled={saving || uploading || (!isAdmin && playgroundId)}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={theme.colors.primaryTextOn} />
          ) : (
            <Text style={{ color: theme.colors.primaryTextOn, fontWeight: '800' }}>
              {playgroundId ? 'Spara ändringar' : 'Skapa lekplats'}
            </Text>
          )}
        </TouchableOpacity>

        {playgroundId && isAdmin ? (
          <TouchableOpacity
            onPress={confirmDelete}
            style={{
              marginTop: theme.space.sm,
              height: 44,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.danger,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="trash-outline" size={16} color={theme.colors.overlayText} />
            <Text style={{ color: theme.colors.overlayText, fontWeight: '800' }}>Ta bort lekplats</Text>
          </TouchableOpacity>
        ) : null}

        <View style={{ height: theme.space.md }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    label: { fontWeight: '800', color: theme.colors.text, marginBottom: theme.space.xs },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.space.md,
      height: 44,
      backgroundColor: theme.colors.inputBg || theme.colors.card,
      marginBottom: theme.space.sm,
      color: theme.colors.text,
    },
    inputMultiline: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.space.md,
      paddingVertical: 10,
      minHeight: 90,
      textAlignVertical: 'top',
      backgroundColor: theme.colors.inputBg || theme.colors.card,
      color: theme.colors.text,
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
    infoMuted: { marginTop: 6, color: theme.colors.textMuted, fontSize: 12 },
    btn: (theme) => ({
      flex: 1,
      height: 42,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
      borderWidth: 1,
    }),
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
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
