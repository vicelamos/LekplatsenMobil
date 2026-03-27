import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// Tema & UI-komponenter
import { useTheme } from '../../src/theme';
import { Card, Button, Input, PatternBackground } from '../../src/ui';

// Firebase
import { auth } from '../../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

export default function ForgotPasswordScreen({ navigation }) {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert('E-post saknas', 'Skriv in din e-postadress för att få en återställningslänk.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert(
        'E-post skickad! 📧',
        'Kolla din inkorg (och skräppost) efter instruktioner för att välja ett nytt lösenord.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      let message = 'Ett fel inträffade.';
      if (error.code === 'auth/user-not-found') {
        message = 'Det finns inget konto registrerat med denna e-post.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'E-postadressen är felaktigt formaterad.';
      }
      Alert.alert('Kunde inte skicka', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <PatternBackground intensity={0.06}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 60 }}>
            
            {/* Tillbaka-knapp */}
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={{ marginBottom: 20, flexDirection: 'row', alignItems: 'center' }}
            >
              <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
              <Text style={{ marginLeft: 8, color: theme.colors.primary, fontWeight: '600' }}>Tillbaka</Text>
            </TouchableOpacity>

            <View style={{ marginBottom: 30 }}>
              <Text style={{ 
                fontSize: 28, 
                fontWeight: '800', 
                color: theme.colors.text,
                marginBottom: 10 
              }}>
                Glömt lösenord?
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 16, lineHeight: 22 }}>
                Ingen fara! Ange din e-postadress nedan så skickar vi en länk där du kan välja ett nytt lösenord.
              </Text>
            </View>

            <Card>
              <Text style={{ 
                color: theme.colors.text, 
                fontWeight: '700', 
                marginBottom: 8 
              }}>
                Din e-post
              </Text>
              <Input
                placeholder="namn@exempel.se"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                containerStyle={{ height: 50, marginBottom: 20 }}
              />

              <Button
                title={loading ? 'Skickar...' : 'Skicka återställningslänk'}
                onPress={handleReset}
                loading={loading}
              />
            </Card>

          </ScrollView>
        </KeyboardAvoidingView>
      </PatternBackground>
    </SafeAreaView>
  );
}