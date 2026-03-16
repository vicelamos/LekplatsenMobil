
// ProfileScreen.js
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
import { auth, db, storage } from '../firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { File as ExpoFile } from 'expo-file-system';
import { getDownloadURL, ref } from 'firebase/storage';
import { Ionicons } from '@expo/vector-icons';

// 🟢 Tema & UI
import { useTheme } from '../src/theme';
import { Card } from '../src/ui';

function ProfileScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [formData, setFormData] = useState({});
  const [visitedPlaygrounds, setVisitedPlaygrounds] = useState([]);
  const [loadingVisited, setLoadingVisited] = useState(false);
  const [showVisited, setShowVisited] = useState(false);
  const [errors, setErrors] = useState({}); // validation messages

  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (userId) {
      const fetchUserProfile = async () => {
        setLoading(true);
        try {
          const userDocRef = doc(db, 'users', userId);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserProfile(data);
            setFormData(data);
          }
        } catch (error) {
          console.error('Fel vid hämtning av profil:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchUserProfile();
    }
  }, [userId]);

  // Funktion för att hämta namn på besökta lekplatser
  const fetchVisitedDetails = async () => {
    if (visitedPlaygrounds.length > 0 || !userProfile?.visitedPlaygroundIds?.length) return;
    
    setLoadingVisited(true);
    try {
      const ids = userProfile.visitedPlaygroundIds;
      // Firestore tillåter max 10 IDs i en 'in'-fråga. Om användaren besökt fler, 
      // kan man köra flera queries eller hämta alla och filtrera. 
      // Här kör vi en enkel variant för de senaste:
      const q = query(collection(db, 'lekplatser'), where('__name__', 'in', ids.slice(0, 10)));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, name: d.data().namn || d.data().name }));
      setVisitedPlaygrounds(list);
    } catch (e) {
      console.error("Kunde inte hämta besökta lekplatser", e);
    } finally {
      setLoadingVisited(false);
    }
  };

  // helper to upload file as base64 via XHR to Firebase Storage
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
        else {
          console.error('Upload failed:', xhr.status, xhr.responseText);
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };
      xhr.onerror = (e) => {
        console.error('XHR onerror:', e, 'url:', url);
        reject(new Error('Upload XHR error'));
      };
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'image/jpeg');
      xhr.setRequestHeader('X-Goog-Upload-Protocol', 'raw');
      if (token) xhr.setRequestHeader('Authorization', `Firebase ${token}`);
      xhr.send(bytes);
    });
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Åtkomst nekad', 'Du måste ge appen tillåtelse att komma åt dina foton för att byta profilbild.');
      return;
    }
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!pickerResult.canceled) {
      const imageUri = pickerResult.assets[0].uri;
      uploadImage(imageUri);
    }
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
    if (!result.canceled) {
      uploadImage(result.assets[0].uri);
    }
  };

  const handleImagePick = () => {
    Alert.alert('Ändra profilbild', 'Välj källa', [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Galleri', onPress: pickImage },
      { text: 'Kamera', onPress: takePhoto },
    ]);
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
      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, { profilbildUrl: downloadURL });

      const updatedProfile = { ...userProfile, profilbildUrl: downloadURL };
      setUserProfile(updatedProfile);
      setFormData(updatedProfile);

      Alert.alert('Klart!', 'Din profilbild är uppdaterad.');
    } catch (error) {
      console.error('Uppladdningsfel:', error);
      Alert.alert('Fel', 'Kunde inte ladda upp bilden.');
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === 'smeknamn') {
      // clear nickname errors when user edits it
      setErrors((prev) => ({ ...prev, smeknamn: '' }));
    }
  };

  // generate a random nickname (same logic as signup)
  const generateUsername = () => {
    const prefix = ["Modiga", "Glada", "Snabba", "Vilda", "Hoppiga", "Lugna"];
    const suffix = ["Kängurun", "Björnen", "Räven", "Ekorren", "Haren", "Ugglan"];
    const suggested =
      prefix[Math.floor(Math.random() * prefix.length)] +
      suffix[Math.floor(Math.random() * suffix.length)] +
      Math.floor(100 + Math.random() * 899);
    setFormData((prev) => ({ ...prev, smeknamn: suggested }));
    setErrors((prev) => ({ ...prev, smeknamn: '' }));
  };

  // check that the nickname isn't used by another account
  const isUsernameUnique = async (name) => {
    if (!name) return true;
    // if user hasn't changed nickname or it's their own, allow it
    if (name === userProfile?.smeknamn) return true;
    const q = query(collection(db, 'users'), where('smeknamn', '==', name));
    const querySnapshot = await getDocs(q);
    // make sure no other document besides this user exists
    return querySnapshot.docs.every((d) => d.id === userId);
  };

  const handleSaveChanges = async () => {
    if (!userId) return;
    setLoading(true);
    setErrors({});
    try {
      const newNick = (formData.smeknamn || '').trim();
      if (newNick) {
        const unique = await isUsernameUnique(newNick);
        if (!unique) {
          setErrors((prev) => ({ ...prev, smeknamn: 'Smeknamnet är upptaget.' }));
          setLoading(false);
          return;
        }
      }

      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, {
        fornamn: formData.fornamn || '',
        efternamn: formData.efternamn || '',
        smeknamn: newNick,
      });
      setUserProfile(formData);
      Alert.alert('Sparat!', 'Din profil har uppdaterats.');
    } catch (error) {
      console.error('Fel vid uppdatering:', error);
      Alert.alert('Fel', 'Kunde inte spara ändringarna.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    signOut(auth).catch((error) => console.error('Utloggning misslyckades', error));
  };

  if (loading && !uploading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.center]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  const initialer = (userProfile?.fornamn?.[0] || '') + (userProfile?.efternamn?.[0] || '');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={{ paddingBottom: theme.space.xl * 2 }}>
        {/* Profilbild */}
        <View style={{ alignItems: 'center', marginTop: theme.space.lg }}>
          <TouchableOpacity onPress={handleImagePick} disabled={uploading} activeOpacity={0.8}>
            <Image
              style={{
                width: 150,
                height: 150,
                borderRadius: 75,
                backgroundColor: theme.colors.bgSoft,
              }}
              source={{
                uri:
                  formData.profilbildUrl ||
                  `https://placehold.co/150x150/6200ea/ffffff?text=${initialer || '?'}`,
              }}
            />
            {uploading && (
              <View
                style={{
                  ...StyleSheet.absoluteFillObject,
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: 75,
                }}
              >
                <ActivityIndicator size="large" color="#ffffff" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: theme.space.xs }}>
            Tryck på bilden för att välja från galleri eller ta ett foto
          </Text>
        </View>

        {/* Formulärkort */}
        <Card style={{ padding: theme.space.md, marginHorizontal: theme.space.lg, marginTop: theme.space.md }}>
          <Text style={styles.label}>E-post (kan ej redigeras)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.bgSoft, color: theme.colors.textMuted }]}
            value={userProfile?.email || ''}
            editable={false}
          />

          <Text style={styles.label}>Förnamn</Text>
          <TextInput
            style={styles.input}
            placeholder="Ditt förnamn"
            placeholderTextColor={theme.colors.textMuted}
            value={formData.fornamn || ''}
            onChangeText={(text) => handleInputChange('fornamn', text)}
          />

          <Text style={styles.label}>Efternamn</Text>
          <TextInput
            style={styles.input}
            placeholder="Ditt efternamn"
            placeholderTextColor={theme.colors.textMuted}
            value={formData.efternamn || ''}
            onChangeText={(text) => handleInputChange('efternamn', text)}
          />

          <Text style={styles.label}>Smeknamn</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Ditt smeknamn"
              placeholderTextColor={theme.colors.textMuted}
              value={formData.smeknamn || ''}
              onChangeText={(text) => handleInputChange('smeknamn', text)}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={generateUsername} style={{ marginLeft: 8 }}>
              <Ionicons name="refresh-circle" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
          {errors.smeknamn && <Text style={{ color: 'red', fontSize: 10 }}>{errors.smeknamn}</Text>}

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleSaveChanges}
            disabled={uploading}
            activeOpacity={0.8}
          >
            <Text style={{ color: theme.colors.primaryTextOn, fontWeight: '800' }}>Spara ändringar</Text>
          </TouchableOpacity>
        </Card>

        {/* 🏁 BESÖKTA LEKPLATSER (Expandbar sektion) */}
        <Card style={{ marginHorizontal: theme.space.lg, marginTop: theme.space.md, padding: 0 }}>
          <TouchableOpacity 
            onPress={() => {
                setShowVisited(!showVisited);
                if (!showVisited) fetchVisitedDetails();
            }}
            style={{ 
                padding: theme.space.md, 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                <Text style={{ fontWeight: '800', marginLeft: 8, color: theme.colors.text }}>
                    Besökta lekplatser ({userProfile?.visitedPlaygroundIds?.length || 0})
                </Text>
            </View>
            <Ionicons name={showVisited ? "chevron-up" : "chevron-down"} size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>

          {showVisited && (
            <View style={{ paddingHorizontal: theme.space.md, paddingBottom: theme.space.md }}>
                {loadingVisited ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : visitedPlaygrounds.length === 0 ? (
                    <Text style={{ fontStyle: 'italic', color: theme.colors.textMuted }}>Du har inte checkat in på någon lekplats än.</Text>
                ) : (
                    visitedPlaygrounds.map((pg) => (
                        <TouchableOpacity 
                            key={pg.id} 
                            style={styles.visitedItem}
                            onPress={() => navigation.navigate('PlaygroundDetails', { id: pg.id })}
                        >
                            <Text style={{ color: theme.colors.text }}>{pg.name}</Text>
                            <Ionicons name="arrow-forward" size={14} color={theme.colors.textMuted} />
                        </TouchableOpacity>
                    ))
                )}
            </View>
          )}
        </Card>

        {/* Navigeringsknappar */}
        <View style={{ flexDirection: 'row', gap: theme.space.sm, marginHorizontal: theme.space.lg, marginTop: theme.space.md }}>
          <TouchableOpacity
            style={[styles.navBtn]}
            onPress={() => navigation.navigate('Friends')}
            disabled={uploading}
            activeOpacity={0.8}
          >
            <Text style={{ color: theme.colors.primaryTextOn, fontWeight: '800' }}>Mina Vänner</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navBtn]}
            onPress={() => navigation.navigate('Trophies')}
            disabled={uploading}
            activeOpacity={0.8}
          >
            <Text style={{ color: theme.colors.primaryTextOn, fontWeight: '800' }}>Mina Troféer</Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <View style={{ marginHorizontal: theme.space.lg, marginTop: theme.space.lg }}>
          <TouchableOpacity
            onPress={handleLogout}
            style={{
              height: 48,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.danger,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.8}
          >
            <Text style={{ color: theme.colors.overlayText, fontWeight: '800' }}>Logga ut</Text>
          </TouchableOpacity>
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
    center: { justifyContent: 'center', alignItems: 'center' },
    label: {
      width: '100%',
      fontSize: 14,
      color: theme.colors.textMuted,
      marginTop: 10,
      marginBottom: 6,
    },
    input: {
      width: '100%',
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
    primaryBtn: {
      marginTop: 12,
      height: 48,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadow.floating,
    },
    navBtn: {
      flex: 1,
      height: 48,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadow.floating,
    },
  });

export default ProfileScreen;
