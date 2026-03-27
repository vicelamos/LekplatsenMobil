// ProfileScreen.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  Modal,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from '../../firebase';
import { signOut, deleteUser, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Card } from '../../src/ui';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import { useCallback } from 'react';

function ProfileScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [trophyCount, setTrophyCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const userId = auth.currentUser?.uid;

  const fetchUserProfile = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const docSnap = await getDoc(doc(db, 'users', userId));
      if (docSnap.exists()) {
        setUserProfile(docSnap.data());
        setIsAdmin(!!docSnap.data()?.isAdmin);
      }
      const trophySnap = await getDocs(collection(db, 'users', userId, 'unlockedTrophies'));
      setTrophyCount(trophySnap.size);
    } catch (error) {
      console.error('Fel vid hämtning av profil:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Ladda om profilen varje gång skärmen fokuseras (t.ex. efter redigering)
  useFocusEffect(useCallback(() => { fetchUserProfile(); }, [fetchUserProfile]));


  const handleLogout = () => {
    signOut(auth).catch((error) => console.error('Utloggning misslyckades', error));
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword || deleteLoading) return;
    setDeleteLoading(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, deletePassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      // Radera underkollektioner
      const subcollections = ['unlockedTrophies', 'notifications', 'completedChallenges', 'klaradeUtmaningar'];
      for (const sub of subcollections) {
        const snap = await getDocs(collection(db, 'users', userId, sub));
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        if (!snap.empty) await batch.commit();
      }

      // Radera användardokumentet
      await deleteDoc(doc(db, 'users', userId));

      // Radera Firebase Auth-kontot
      await deleteUser(auth.currentUser);
      // onAuthStateChanged i App.js hanterar navigering automatiskt
    } catch (error) {
      setDeleteLoading(false);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        Alert.alert('Fel lösenord', 'Kontrollera ditt lösenord och försök igen.');
      } else {
        Alert.alert('Fel', 'Kunde inte radera kontot. Försök igen.');
      }
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  const initialer = (userProfile?.fornamn?.[0] || '') + (userProfile?.efternamn?.[0] || '');
  const fullName = `${userProfile?.fornamn || ''} ${userProfile?.efternamn || ''}`.trim();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={{ paddingBottom: theme.space.xl * 2, position: 'relative' }}>

        {/* Redigera-knapp uppe till höger */}
        <TouchableOpacity
          onPress={() => navigation.navigate('EditProfile')}
          style={{
            position: 'absolute',
            top: theme.space.md,
            right: theme.space.lg,
            zIndex: 10,
            padding: 8,
            borderRadius: 20,
            backgroundColor: theme.colors.card,
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil-outline" size={20} color={theme.colors.primary} />
        </TouchableOpacity>

        {/* Profilhuvud */}
        <View style={{ alignItems: 'center', marginTop: theme.space.xl, marginBottom: theme.space.lg }}>
          <Image
            style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: theme.colors.bgSoft }}
            source={{
              uri:
                userProfile?.profilbildUrl ||
                `https://placehold.co/150x150/6200ea/ffffff?text=${initialer || '?'}`,
            }}
          />
          <Text style={styles.smeknamn}>{userProfile?.smeknamn || 'Ingen profil'}</Text>
          {fullName.length > 0 && (
            <Text style={{ color: theme.colors.textMuted, marginTop: 2 }}>{fullName}</Text>
          )}

          {/* Stats-rad */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userProfile?.totalCheckinCount || 0}</Text>
              <Text style={styles.statLabel}>Incheckningar</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userProfile?.visitedPlaygroundIds?.length || 0}</Text>
              <Text style={styles.statLabel}>Besökta lekplatser</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{trophyCount}</Text>
              <Text style={styles.statLabel}>Troféer</Text>
            </View>
          </View>
        </View>

        {/* Navigeringskort */}
        <Card style={{ marginHorizontal: theme.space.lg, padding: 0, overflow: 'hidden' }}>
          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('Friends')}
            activeOpacity={0.7}
          >
            <View style={styles.navRowLeft}>
              <Ionicons name="people-outline" size={22} color={theme.colors.primary} />
              <Text style={styles.navRowText}>Mina Vänner</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('Trophies')}
            activeOpacity={0.7}
          >
            <View style={styles.navRowLeft}>
              <Ionicons name="trophy-outline" size={22} color={theme.colors.primary} />
              <Text style={styles.navRowText}>Mina Troféer</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('MyCheckins')}
            activeOpacity={0.7}
          >
            <View style={styles.navRowLeft}>
              <Ionicons name="location-outline" size={22} color={theme.colors.primary} />
              <Text style={styles.navRowText}>Mina incheckningar</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('MyVisitedPlaygrounds')}
            activeOpacity={0.7}
          >
            <View style={styles.navRowLeft}>
              <Ionicons name="map-outline" size={22} color={theme.colors.primary} />
              <Text style={styles.navRowText}>Besökta lekplatser</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>

          {isAdmin && (
            <>
              <View style={styles.separator} />
              <TouchableOpacity
                style={styles.navRow}
                onPress={() => navigation.navigate('Admin')}
                activeOpacity={0.7}
              >
                <View style={styles.navRowLeft}>
                  <Ionicons name="shield-outline" size={22} color={theme.colors.primary} />
                  <Text style={styles.navRowText}>Administration</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </>
          )}
        </Card>

        {/* Logga ut */}
        <View style={{ marginHorizontal: theme.space.lg, marginTop: theme.space.xl }}>
          <TouchableOpacity
            onPress={handleLogout}
            style={styles.logoutBtn}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#fff', fontWeight: '800' }}>Logga ut</Text>
          </TouchableOpacity>
          <Text style={{ textAlign: 'center', color: theme.colors.textMuted, fontSize: 12, marginTop: 16 }}>
            Version {Constants.expoConfig?.version ?? '–'}
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://firebasestorage.googleapis.com/v0/b/lekplatsen-907fb.firebasestorage.app/o/Policy%2FSekretesspolicy%20f%C3%B6r%20Lekplatsen.pdf?alt=media&token=e40b620d-4801-4f9c-918b-6c91d4bd19a1')}
            style={{ marginTop: 8, alignItems: 'center' }}
          >
            <Text style={{ color: theme.colors.textMuted, fontSize: 12, textDecorationLine: 'underline' }}>
              Sekretesspolicy
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setDeletePassword(''); setDeleteModalVisible(true); }}
            style={{ marginTop: 20, alignItems: 'center' }}
          >
            <Text style={{ color: theme.colors.danger, fontSize: 13 }}>Radera konto</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal: Radera konto */}
      <Modal visible={deleteModalVisible} transparent animationType="fade" onRequestClose={() => setDeleteModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDeleteModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { backgroundColor: theme.colors.cardBg }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.danger }]}>Radera konto</Text>
            <Text style={[styles.modalBody, { color: theme.colors.textMuted }]}>
              Detta raderar ditt konto och alla dina uppgifter permanent. Åtgärden kan inte ångras.{'\n\n'}Bekräfta med ditt lösenord:
            </Text>
            <TextInput
              style={[styles.passwordInput, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.bgSoft }]}
              placeholder="Lösenord"
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry
              value={deletePassword}
              onChangeText={setDeletePassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.deleteBtn, (!deletePassword || deleteLoading) && { opacity: 0.4 }]}
              onPress={handleDeleteAccount}
              disabled={!deletePassword || deleteLoading}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>{deleteLoading ? 'Raderar...' : 'Radera mitt konto'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setDeleteModalVisible(false)} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ color: theme.colors.textMuted }}>Avbryt</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    smeknamn: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.colors.text,
      marginTop: theme.space.sm,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: theme.space.md,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      paddingVertical: theme.space.sm,
      paddingHorizontal: theme.space.xl,
    },
    statItem: {
      alignItems: 'center',
      paddingHorizontal: theme.space.lg,
    },
    statNumber: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.text,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    statDivider: {
      width: 1,
      height: 32,
      backgroundColor: theme.colors.border,
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.md,
    },
    navRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    navRowText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginLeft: theme.space.sm,
    },
    separator: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginHorizontal: theme.space.md,
    },
    logoutBtn: {
      height: 48,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
    modalSheet: { borderRadius: 20, padding: 24 },
    modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
    modalBody: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
    passwordInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 16 },
    deleteBtn: { backgroundColor: '#ef4444', padding: 14, borderRadius: 12, alignItems: 'center' },
  });

export default ProfileScreen;
