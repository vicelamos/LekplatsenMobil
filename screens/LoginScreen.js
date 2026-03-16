import React, { useState, useRef } from 'react';
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
import { useTheme } from '../src/theme'; // eller '../src/theme/ThemeProvider'
import { Card, Button, Input, PatternBackground } from '../src/ui';

// Firebase
import { auth } from '../firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

// Lokalt asset
const hero = require('../assets/images/lekplatsen.png');

export default function LoginScreen({ navigation }) {
  const { theme } = useTheme();
  const screenWidth = Dimensions.get('window').width;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [secure, setSecure] = useState(true);
  const [errors, setErrors] = useState({ email: '', password: '' });

  const pwdRef = useRef(null);

  const validate = () => {
    let ok = true;
    const next = { email: '', password: '' };

    if (!email.trim()) {
      next.email = 'Ange din e-postadress.';
      ok = false;
    } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      next.email = 'Ogiltig e-postadress.';
      ok = false;
    }
    if (!password) {
      next.password = 'Ange ditt lösenord.';
      ok = false;
    }
    setErrors(next);
    return ok;
  };

  const handleLogin = async () => {
    if (loading) return;
    if (!validate()) return;

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      console.log('Inloggad!');
      // navigation.replace('MainApp');
    } catch (error) {
      let friendlyMessage = 'Ett fel inträffade – försök igen.';
      if (
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/user-not-found'
      ) {
        friendlyMessage = 'Fel e-post eller lösenord.';
      } else if (error.code === 'auth/invalid-email') {
        friendlyMessage = 'E-postadressen är felaktigt formaterad.';
      } else if (error.code === 'auth/too-many-requests') {
        friendlyMessage = 'För många försök. Vänta en stund och prova igen.';
      }
      Alert.alert('Inloggning misslyckades', friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = () => {
    navigation.navigate('ForgotPassword');
  };

  const goToSignup = () => {
    navigation.navigate('Signup');
  };

  const toggleSecure = () => {
    setSecure((s) => !s);
    requestAnimationFrame(() => {
      const len = password?.length ?? 0;
      pwdRef.current?.setNativeProps?.({ selection: { start: len, end: len } });
    });
  };

  // === Layout för bilden (minskad maxbredd + luft mot kanter) ===
  const horizontalPadding = theme.space.xl;
  const maxHeroWidth = 300; // justera här om du vill ha ännu mindre (t.ex. 280)
  const imageWidth = Math.min(screenWidth - horizontalPadding * 2, maxHeroWidth);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <PatternBackground intensity={0.06}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: horizontalPadding,
              paddingTop: theme.space['2xl'],
              paddingBottom: theme.space['2xl'],
            }}
            keyboardShouldPersistTaps="handled"
          >
            {/* ====== Titel/Brand (utan smailgubben) ====== */}
            <View style={{ alignItems: 'center', marginBottom: theme.space.md }}>
              <Text
                style={{
                  fontSize: theme.type.size['2xl'],
                  fontWeight: theme.type.weight.extraBold,
                  color: theme.colors.text,
                  textAlign: 'center',
                }}
              >
                Välkommen!
              </Text>
            </View>

            {/* ====== Hero-bild ====== */}
            <View style={{ alignItems: 'center' }}>
              <Image
                source={hero}
                resizeMode="contain"
                accessible
                accessibilityLabel="Lekplatsen – illustration med gungställning och rutschkana"
                style={{
                  width: imageWidth,
                  height: undefined,
                  aspectRatio: 1,
                  borderRadius: theme.radius.lg,
                  marginHorizontal: theme.space.sm,
                }}
              />
            </View>

            {/* ====== Underrubrik under bilden ====== */}
            <View style={{ alignItems: 'center', marginTop: theme.space.md, marginBottom: theme.space['2xl'] }}>
              <Text
                style={{
                  fontSize: theme.type.size.md,
                  color: theme.colors.textMuted,
                  textAlign: 'center',
                }}
              >
                Logga in till Lekplatsen
              </Text>
            </View>

            {/* ====== Formkort ====== */}
            <Card style={{ backgroundColor: theme.colors.cardBg }}>
              {/* Email */}
              <Text
                style={{
                  color: theme.colors.text,
                  fontWeight: theme.type.weight.bold,
                  marginBottom: theme.space.xs,
                }}
              >
                E‑post
              </Text>
              <Input
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (errors.email) setErrors((s) => ({ ...s, email: '' }));
                }}
                placeholder="namn@exempel.se"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                autoComplete="email"
                containerStyle={{ height: 48 }}   // en rad
                multiline={false}
                numberOfLines={1}
                style={{ marginBottom: errors.email ? 4 : theme.space.md }}
                returnKeyType="next"
                blurOnSubmit={false}
              />
              {errors.email ? (
                <Text style={{ color: theme.colors.danger, marginBottom: theme.space.md }}>
                  {errors.email}
                </Text>
              ) : null}

              {/* Password */}
              <Text
                style={{
                  color: theme.colors.text,
                  fontWeight: theme.type.weight.bold,
                  marginBottom: theme.space.xs,
                }}
              >
                Lösenord
              </Text>

              <Input
                ref={pwdRef}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (errors.password) setErrors((s) => ({ ...s, password: '' }));
                }}
                placeholder="••••••••"
                containerStyle={{ height: 48 }}   // en rad
                style={{ paddingRight: 44, marginBottom: errors.password ? 4 : theme.space.md }}
                keyboardType="default"
                multiline={false}
                numberOfLines={1}
                secureTextEntry={secure}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                autoComplete="password"
                returnKeyType="done"
                rightIcon={
                  <Ionicons
                    name={secure ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={theme.colors.textMuted}
                  />
                }
                onPressRight={toggleSecure}
              />

              {errors.password ? (
                <Text style={{ color: theme.colors.danger, marginBottom: theme.space.md }}>
                  {errors.password}
                </Text>
              ) : null}

              {/* Hjälplänk */}

              <TouchableOpacity onPress={handleForgot} style={{ alignSelf: 'flex-end' }}>
                <Text
                  style={{
                    color: theme.colors.link,
                    fontWeight: theme.type.weight.semi,
                    marginBottom: theme.space.md,
                  }}
                >
                  Glömt lösenord?
                </Text>
              </TouchableOpacity>

              {/* CTA */}
              <Button
                title={loading ? 'Loggar in…' : 'Logga in'}
                onPress={handleLogin}
                loading={loading}
              />
            </Card>

            {/* Sekundära actions */}
            <View
              style={{
                alignItems: 'center',
                marginTop: theme.space.lg,
                gap: 10,
              }}
            >
              <Text style={{ color: theme.colors.textMuted }}>Har du inget konto?</Text>
              <Button title="Skapa konto" variant="secondary" onPress={goToSignup} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </PatternBackground>
    </SafeAreaView>
  );
}