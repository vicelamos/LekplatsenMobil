import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// Tema & UI-komponenter
import { useTheme } from '../src/theme';
import { Card, Button, Input, PatternBackground } from '../src/ui';

// Firebase
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

const hero = require('../assets/images/lekplatsen.png');

export default function SignupScreen({ navigation }) {
  const { theme } = useTheme();
  const screenWidth = Dimensions.get('window').width;

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fornamn, setFornamn] = useState('');
  const [efternamn, setEfternamn] = useState('');
  const [smeknamn, setSmeknamn] = useState('');

  // UI states
  const [loading, setLoading] = useState(false);
  const [secure, setSecure] = useState(true);
  const [errors, setErrors] = useState({});

  // Slumpa fram smeknamn
  const generateUsername = () => {
    const prefix = ["Modiga", "Glada", "Snabba", "Vilda", "Hoppiga", "Lugna"];
    const suffix = ["Kängurun", "Björnen", "Räven", "Ekorren", "Haren", "Ugglan"];
    const suggested = prefix[Math.floor(Math.random() * prefix.length)] + 
                      suffix[Math.floor(Math.random() * suffix.length)] + 
                      Math.floor(100 + Math.random() * 899);
    setSmeknamn(suggested);
    setErrors(prev => ({ ...prev, smeknamn: '' }));
  };

  // Kontrollera om smeknamnet är unikt
  const isUsernameUnique = async (name) => {
    const q = query(collection(db, "users"), where("smeknamn", "==", name));
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty;
  };

  // Validering
  const validate = () => {
    let nextErrors = {};
    let ok = true;

    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      nextErrors.email = 'Ange en giltig e-post.';
      ok = false;
    }
    if (!fornamn.trim()) {
      nextErrors.fornamn = 'Ange förnamn.';
      ok = false;
    }
    if (!smeknamn.trim()) {
      nextErrors.smeknamn = 'Välj ett smeknamn.';
      ok = false;
    }
    if (password.length < 6) {
      nextErrors.password = 'Minst 6 tecken.';
      ok = false;
    }
    if (password !== confirmPassword) {
      nextErrors.confirm = 'Lösenorden matchar inte.';
      ok = false;
    }

    setErrors(nextErrors);
    return ok;
  };

  // LOGIKEN FÖR ATT SKAPA KONTOT
  const handleSignup = async () => {
    if (loading) return;
    if (!validate()) return;

    setLoading(true);
    try {
      // 1. Kolla om smeknamnet är upptaget
      const unique = await isUsernameUnique(smeknamn.trim());
      if (!unique) {
        setErrors(prev => ({ ...prev, smeknamn: 'Smeknamnet är upptaget.' }));
        setLoading(false);
        return;
      }

      // 2. Skapa användaren i Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // 3. Spara datan i Firestore (matchar din bild)
      await setDoc(doc(db, "users", user.uid), {
        fornamn: fornamn.trim(),
        efternamn: efternamn.trim(),
        smeknamn: smeknamn.trim(),
        email: email.trim().toLowerCase(),
        skapades: serverTimestamp(),
        totalCheckinCount: 0,
        friends: [],
        visitedPlaygroundIds: [],
        profilbildUrl: "",
        trophyProgress: { 
          TOTAL_CHECKINS: 0, 
          UNIQUE_PLAYGROUNDS: 0 
        }
      });

      // App.js lyssnar på auth-ändringen och loggar in användaren automatiskt
    } catch (error) {
      let msg = 'Kunde inte skapa konto.';
      if (error.code === 'auth/email-already-in-use') msg = 'E-posten används redan.';
      Alert.alert('Fel', msg);
    } finally {
      setLoading(false);
    }
  };

  const inputContainerStyle = { height: 48 };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <PatternBackground intensity={0.06}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView 
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 40, paddingBottom: 100 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: theme.colors.text }}>Skapa konto</Text>
              <Image source={hero} resizeMode="contain" style={{ width: 120, height: 120, marginTop: 10 }} />
            </View>

            <Card>
              {/* Förnamn & Efternamn */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    placeholder="Förnamn"
                    value={fornamn}
                    onChangeText={setFornamn}
                    containerStyle={inputContainerStyle}
                  />
                  {errors.fornamn && <Text style={{color: 'red', fontSize: 10}}>{errors.fornamn}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    placeholder="Efternamn"
                    value={efternamn}
                    onChangeText={setEfternamn}
                    containerStyle={inputContainerStyle}
                  />
                </View>
              </View>

              {/* Smeknamn */}
              <View style={{ marginBottom: 15 }}>
                <Input
                  placeholder="Smeknamn"
                  value={smeknamn}
                  onChangeText={setSmeknamn}
                  autoCapitalize="none"
                  containerStyle={inputContainerStyle}
                  rightIcon={<Ionicons name="refresh-circle" size={24} color={theme.colors.primary} />}
                  onPressRight={generateUsername}
                />
                {errors.smeknamn && <Text style={{color: 'red', fontSize: 10}}>{errors.smeknamn}</Text>}
              </View>

              {/* E-post */}
              <View style={{ marginBottom: 15 }}>
                <Input
                  placeholder="E-post"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  containerStyle={inputContainerStyle}
                />
                {errors.email && <Text style={{color: 'red', fontSize: 10}}>{errors.email}</Text>}
              </View>

              {/* Lösenord */}
              <View style={{ marginBottom: 15 }}>
                <Input
                  placeholder="Lösenord"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={secure}
                  containerStyle={inputContainerStyle}
                  rightIcon={<Ionicons name={secure ? 'eye-off-outline' : 'eye-outline'} size={22} color={theme.colors.textMuted} />}
                  onPressRight={() => setSecure(!secure)}
                />
                {errors.password && <Text style={{color: 'red', fontSize: 10}}>{errors.password}</Text>}
              </View>

              {/* Bekräfta Lösenord */}
              <View style={{ marginBottom: 20 }}>
                <Input
                  placeholder="Bekräfta lösenord"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={secure}
                  containerStyle={inputContainerStyle}
                />
                {errors.confirm && <Text style={{color: 'red', fontSize: 10}}>{errors.confirm}</Text>}
              </View>

              <Button
                title={loading ? 'Skapar konto...' : 'Gå med nu'}
                onPress={handleSignup}
                loading={loading}
              />
            </Card>

            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20, alignItems: 'center' }}>
              <Text style={{ color: theme.colors.textMuted }}>
                Har du redan ett konto? <Text style={{ color: theme.colors.link, fontWeight: 'bold' }}>Logga in</Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </PatternBackground>
    </SafeAreaView>
  );
}