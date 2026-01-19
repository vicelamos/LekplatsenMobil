import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform
} from 'react-native';

// Importera din firebase-konfiguration
// Sökvägen är UPP ETT STEG (../) från 'screens' mappen
import { auth } from '../firebase'; 
import { signInWithEmailAndPassword } from 'firebase/auth';

// Komponent för inloggningsskärmen
function LoginScreen({ navigation }) { // 'navigation' kommer vi använda senare
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Hanterar inloggning
  const handleLogin = async () => {
    if (loading) return;
    if (email === '' || password === '') {
      Alert.alert('Tomma fält', 'Vänligen fyll i både e-post och lösenord.');
      return;
    }
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Om lyckad, navigera till Huvud-appen (detta steg kommer senare)
      console.log('Inloggad!');
      // navigation.navigate('MainApp'); 
    } catch (error) {
      // Visa ett felmeddelande till användaren
      let friendlyMessage = 'Ett fel inträffade.';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        friendlyMessage = 'Fel e-post eller lösenord. Försök igen.';
      } else if (error.code === 'auth/invalid-email') {
        friendlyMessage = 'E-postadressen är felaktigt formaterad.';
      }
      Alert.alert('Inloggning misslyckades', friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <Text style={styles.title}>Välkommen!</Text>
        <Text style={styles.subtitle}>Logga in på Lekplatsen</Text>

        <TextInput
          style={styles.input}
          placeholder="E-post"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor="#888"
        />

        <TextInput
          style={styles.input}
          placeholder="Lösenord"
          value={password}
          onChangeText={setPassword}
          secureTextEntry // Döljer lösenordet
          placeholderTextColor="#888"
        />

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Loggar in...' : 'Logga in'}
          </Text>
        </TouchableOpacity>
        
        {/* TODO: Lägg till en knapp för "Skapa konto" */}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// StyleSheet för att styla komponenterna (ersätter CSS)
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#6A1B9A', // Mörklila bakgrund
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20, // Sido-marginal
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: '#E0E0E0',
    marginBottom: 40,
  },
  input: {
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)', // Genomskinlig vit
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 15,
    color: '#FFFFFF', // Vit text
  },
  button: {
    backgroundColor: '#FFD600', // Ljusgul knapp
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#333333', // Mörk text på knappen
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LoginScreen;

