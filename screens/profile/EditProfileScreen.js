// EditProfileScreen.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { auth, db, storage } from '../../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { File as ExpoFile } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Card } from '../../src/ui';

function EditProfileScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!userId) return;
    const fetchProfile = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'users', userId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserProfile(data);
          setFormData(data);
        }
      } catch (e) {
        console.error('Fel vid hämtning av profil:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [userId]);

  // --- Bilduppladdning ---

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

  const uploadImage = async (uri) => {
    if (!userId) return;
    setUploading(true);
    try {
      const file = new ExpoFile(uri);
      const base64Data = await file.base64();
      const storageRef = ref(storage, `profilbilder/${userId}`);
      await uploadBase64(storageRef, base64Data);
      const downloadURL = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'users', userId), { profilbildUrl: downloadURL });
      setFormData((prev) => ({ ...prev, profilbildUrl: downloadURL }));
      setUserProfile((prev) => ({ ...prev, profilbildUrl: downloadURL }));
      Alert.alert('Klart!', 'Din profilbild är uppdaterad.');
    } catch (error) {
      console.error('Uppladdningsfel:', error);
      Alert.alert('Fel', 'Kunde inte ladda upp bilden.');
    } finally {
      setUploading(false);
    }
  };

  const handleImagePick = () => {
    Alert.alert('Ändra profilbild', 'Välj källa', [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Galleri', onPress: pickImage },
      { text: 'Kamera', onPress: takePhoto },
    ]);
  };

  const pickImage = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert('Åtkomst nekad', 'Du måste ge appen tillåtelse att komma åt dina foton.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) uploadImage(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Åtkomst nekad', 'Du måste ge appen tillåtelse att använda kameran.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) uploadImage(result.assets[0].uri);
  };

  // --- Formulär ---

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === 'smeknamn') setErrors((prev) => ({ ...prev, smeknamn: '' }));
  };

  const generateUsername = () => {
    const prefix = ['Modiga', 'Glada', 'Snabba', 'Vilda', 'Hoppiga', 'Lugna'];
    const suffix = ['Kängurun', 'Björnen', 'Räven', 'Ekorren', 'Haren', 'Ugglan'];
    const suggested =
      prefix[Math.floor(Math.random() * prefix.length)] +
      suffix[Math.floor(Math.random() * suffix.length)] +
      Math.floor(100 + Math.random() * 899);
    setFormData((prev) => ({ ...prev, smeknamn: suggested }));
    setErrors((prev) => ({ ...prev, smeknamn: '' }));
  };

  const isUsernameUnique = async (name) => {
    if (!name || name === userProfile?.smeknamn) return true;
    const snap = await getDocs(query(collection(db, 'users'), where('smeknamn', '==', name)));
    return snap.docs.every((d) => d.id === userId);
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    setErrors({});
    try {
      const newNick = (formData.smeknamn || '').trim();
      if (newNick) {
        const unique = await isUsernameUnique(newNick);
        if (!unique) {
          setErrors({ smeknamn: 'Smeknamnet är upptaget.' });
          setSaving(false);
          return;
        }
      }
      await updateDoc(doc(db, 'users', userId), {
        fornamn: formData.fornamn || '',
        efternamn: formData.efternamn || '',
        smeknamn: newNick,
        smeknamnLower: newNick.toLowerCase(),
      });
      Alert.alert('Sparat!', 'Din profil har uppdaterats.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Fel vid uppdatering:', error);
      Alert.alert('Fel', 'Kunde inte spara ändringarna.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    const email = auth.currentUser?.email;
    if (!email) return;
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert(
        'E-post skickad',
        `En länk för att byta lösenord har skickats till ${email}. Kolla din inkorg (och skräppost).`
      );
    } catch (e) {
      console.error('Fel vid lösenordsåterställning:', e);
      Alert.alert('Fel', 'Kunde inte skicka återställningslänk.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  const initialer = (formData.fornamn?.[0] || '') + (formData.efternamn?.[0] || '');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={{ padding: theme.space.lg, paddingBottom: theme.space.xl * 2 }}>

        {/* Profilbild */}
        <View style={{ alignItems: 'center', marginBottom: theme.space.lg }}>
          <TouchableOpacity onPress={handleImagePick} disabled={uploading} activeOpacity={0.8}>
            <Image
              style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: theme.colors.bgSoft }}
              source={{
                uri:
                  formData.profilbildUrl ||
                  `https://placehold.co/150x150/6200ea/ffffff?text=${initialer || '?'}`,
              }}
            />
            <View style={styles.cameraIcon}>
              {uploading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="camera" size={16} color="#fff" />}
            </View>
          </TouchableOpacity>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: theme.space.xs }}>
            Tryck för att byta profilbild
          </Text>
        </View>

        {/* Formulär */}
        <Card style={{ padding: theme.space.md }}>
          <Text style={styles.label}>Förnamn</Text>
          <TextInput
            style={styles.input}
            placeholder="Ditt förnamn"
            placeholderTextColor={theme.colors.textMuted}
            value={formData.fornamn || ''}
            onChangeText={(t) => handleInputChange('fornamn', t)}
          />

          <Text style={styles.label}>Efternamn</Text>
          <TextInput
            style={styles.input}
            placeholder="Ditt efternamn"
            placeholderTextColor={theme.colors.textMuted}
            value={formData.efternamn || ''}
            onChangeText={(t) => handleInputChange('efternamn', t)}
          />

          <Text style={styles.label}>Smeknamn</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Ditt smeknamn"
              placeholderTextColor={theme.colors.textMuted}
              value={formData.smeknamn || ''}
              onChangeText={(t) => handleInputChange('smeknamn', t)}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={generateUsername} style={{ marginLeft: 8, marginBottom: 8 }}>
              <Ionicons name="refresh-circle" size={28} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
          {errors.smeknamn && (
            <Text style={{ color: theme.colors.danger, fontSize: 12, marginTop: -4, marginBottom: 8 }}>
              {errors.smeknamn}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: theme.colors.primary, marginTop: theme.space.sm }]}
            onPress={handleSave}
            disabled={saving || uploading}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator color={theme.colors.primaryTextOn} />
              : <Text style={{ color: theme.colors.primaryTextOn, fontWeight: '800' }}>Spara ändringar</Text>}
          </TouchableOpacity>
        </Card>

        {/* Byt lösenord */}
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: theme.colors.card, marginTop: theme.space.md, borderWidth: 1, borderColor: theme.colors.border }]}
          onPress={handleChangePassword}
          activeOpacity={0.8}
        >
          <Ionicons name="lock-closed-outline" size={18} color={theme.colors.text} style={{ marginRight: 8 }} />
          <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Byt lösenord</Text>
        </TouchableOpacity>

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
    label: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginBottom: 6,
      marginTop: 10,
    },
    input: {
      height: 48,
      backgroundColor: theme.colors.inputBg || theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.space.md,
      fontSize: 16,
      color: theme.colors.text,
      marginBottom: 8,
    },
    btn: {
      height: 48,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    },
    cameraIcon: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      backgroundColor: theme.colors.primary,
      borderRadius: 14,
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export default EditProfileScreen;
