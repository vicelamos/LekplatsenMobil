import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform // För att kolla OS
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
// Importera ALLT från firebase, inklusive storage
import { auth, db, storage } from '../firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
// NYA IMPORTER för bildhantering
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

function ProfileScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false); // Ny state för uppladdning
  const [userProfile, setUserProfile] = useState(null);
  const [formData, setFormData] = useState({});

  const userId = auth.currentUser?.uid;

  // Hämta profildata
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
          } else {
            console.log("Inget sådant dokument!");
          }
        } catch (error) {
          console.error("Fel vid hämtning av profil:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchUserProfile();
    }
  }, [userId]);

  // ---- NY FUNKTION: Välj bild ----
  const handleImagePick = async () => {
    // Be om tillåtelse att komma åt mediebiblioteket
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Åtkomst nekad", "Du måste ge appen tillåtelse att komma åt dina foton för att byta profilbild.");
      return;
    }

    // Öppna bildväljaren
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, // Tillåt redigering (beskära, etc.)
      aspect: [1, 1], // Kvadratisk bild
      quality: 0.7, // Komprimera bilden
    });

    // Om användaren INTE avbröt
    if (!pickerResult.canceled) {
      const imageUri = pickerResult.assets[0].uri;
      // Ladda upp den valda bilden
      uploadImage(imageUri);
    }
  };

  // ---- NY FUNKTION: Ladda upp bild ----
  const uploadImage = async (uri) => {
    if (!userId) return;
    setUploading(true);

    try {
      // Konvertera bilden till en "blob" (data)
      // fetch är inbyggt i React Native
      const response = await fetch(uri);
      const blob = await response.blob();

      // Skapa en referens i Firebase Storage
      // Filen kommer heta /profilbilder/ANVÄNDAR-ID
      const storageRef = ref(storage, `profilbilder/${userId}`);

      // Starta uppladdningen
      const uploadTask = uploadBytesResumable(storageRef, blob);

      // Lyssna på uppladdningens status
      uploadTask.on('state_changed',
        (snapshot) => {
          // (Valfritt) Visa uppladdnings-progress här
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log('Upload is ' + progress + '% done');
        },
        (error) => {
          // Hantera misslyckad uppladdning
          console.error("Uppladdningsfel:", error);
          Alert.alert("Fel", "Kunde inte ladda upp bilden.");
          setUploading(false);
        },
        () => {
          // När uppladdningen är KLAR
          getDownloadURL(uploadTask.snapshot.ref).then(async (downloadURL) => {
            console.log('Fil tillgänglig på', downloadURL);

            // 1. Uppdatera Firestore-dokumentet med den nya URL:en
            const userDocRef = doc(db, 'users', userId);
            await updateDoc(userDocRef, {
              profilbildUrl: downloadURL
            });

            // 2. Uppdatera den lokala staten så bilden byts direkt
            const updatedProfile = { ...userProfile, profilbildUrl: downloadURL };
            setUserProfile(updatedProfile);
            setFormData(updatedProfile); // Uppdatera även formulärdatan

            setUploading(false);
            Alert.alert("Klart!", "Din profilbild är uppdaterad.");
          });
        }
      );
    } catch (e) {
      console.error(e);
      setUploading(false);
      Alert.alert("Fel", "Något gick fel vid konvertering av bilden.");
    }
  };


  // Hantera text-input
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Spara ändringar
  const handleSaveChanges = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const userDocRef = doc(db, 'users', userId);
      // Spara bara de fält som får redigeras
      await updateDoc(userDocRef, {
        fornamn: formData.fornamn || "",
        efternamn: formData.efternamn || "",
        smeknamn: formData.smeknamn || "",
      });
      setUserProfile(formData); // Uppdatera den "permanenta" staten
      Alert.alert("Sparat!", "Din profil har uppdaterats.");
    } catch (error) {
      console.error("Fel vid uppdatering:", error);
      Alert.alert("Fel", "Kunde inte spara ändringarna.");
    } finally {
      setLoading(false);
    }
  };

  // Logga ut
  const handleLogout = () => {
    signOut(auth).catch(error => console.error('Utloggning misslyckades', error));
  };

  // Laddnings-vy
  if (loading && !uploading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ea" />
      </SafeAreaView>
    );
  }

  // Fallback för initialer
  const initialer = (userProfile?.fornamn?.[0] || '') + (userProfile?.efternamn?.[0] || '');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        
        {/* Gör bilden klickbar */}
        <TouchableOpacity onPress={handleImagePick} disabled={uploading}>
          <Image
            style={styles.profileImage}
            // Använd formData.profilbildUrl så att den uppdateras direkt
            source={{
              uri: formData.profilbildUrl || `https://placehold.co/150x150/6200ea/ffffff?text=${initialer || '?'}`
            }}
          />
          {/* Visa en uppladdnings-overlay */}
          {uploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="large" color="#ffffff" />
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.changeImageText}>Tryck på bilden för att byta</Text>

        {/* Resten av formuläret */}
        <Text style={styles.label}>E-post (kan ej redigeras)</Text>
        <TextInput
          style={[styles.input, styles.disabledInput]}
          value={userProfile?.email} // Visa alltid original-email
          editable={false}
        />

        <Text style={styles.label}>Förnamn</Text>
        <TextInput
          style={styles.input}
          placeholder="Ditt förnamn"
          value={formData.fornamn}
          onChangeText={(text) => handleInputChange('fornamn', text)}
        />

        <Text style={styles.label}>Efternamn</Text>
        <TextInput
          style={styles.input}
          placeholder="Ditt efternamn"
          value={formData.efternamn}
          onChangeText={(text) => handleInputChange('efternamn', text)}
        />
        
        <Text style={styles.label}>Smeknamn</Text>
        <TextInput
          style={styles.input}
          placeholder="Ditt smeknamn"
          value={formData.smeknamn}
          onChangeText={(text) => handleInputChange('smeknamn', text)}
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleSaveChanges} disabled={uploading}>
          <Text style={styles.buttonText}>Spara ändringar</Text>
        </TouchableOpacity>

        {/* Navigationsknappar */}
        <View style={styles.navButtonGroup}>
          <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('Friends')} disabled={uploading}>
            <Text style={styles.buttonText}>Mina Vänner</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('Trophies')} disabled={uploading}>
            <Text style={styles.buttonText}>Mina Troféer</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.logoutButtonContainer}>
          <Button title="Logga ut" onPress={handleLogout} color="#c0392b" disabled={uploading} />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ---- UPPDATERAD STYLING ----
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  container: {
    alignItems: 'center',
    paddingBottom: 50, // Ge utrymme för sista knappen
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#e0e0e0',
    marginTop: 20,
  },
  // NYTT: Overlay för uppladdning
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject, // Täcker hela föräldern (bilden)
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 75,
  },
  changeImageText: {
    color: '#666',
    fontSize: 12,
    marginBottom: 20,
  },
  label: {
    width: '100%',
    fontSize: 14,
    color: '#666',
    marginTop: 15,
    marginBottom: 5,
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 10,
  },
  disabledInput: {
    backgroundColor: '#f0f0f0',
    color: '#888',
  },
  saveButton: {
    backgroundColor: '#6200ea', // Lila Spara-knapp
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  navButtonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  navButton: {
    backgroundColor: '#007AFF', // Blå navigations-knappar
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    width: '48%', // Två knappar sida-vid-sida
  },
  logoutButtonContainer: {
    width: '100%',
    marginTop: 40,
    marginBottom: 20, // Extra marginal i botten
  }
});

export default ProfileScreen;

