import React, { useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeProvider';
import { useLoginPrompt } from '../contexts/LoginPrompt';
import { navigationRef } from '../../navigationRef';

export default function LoginRequiredModal() {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { visible, returnScreen, returnParams, hide } = useLoginPrompt();

  const goToLogin = async () => {
    if (returnScreen) {
      try {
        await AsyncStorage.setItem(
          '@lekplatsen_return_to',
          JSON.stringify({ screen: returnScreen, params: returnParams })
        );
      } catch (_) {}
    }
    hide();
    navigationRef.current?.navigate('Login', { returnTo: returnScreen, returnParams });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={hide}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={hide}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <TouchableOpacity onPress={hide} style={styles.closeBtn} hitSlop={10}>
            <Ionicons name="close" size={22} color={theme.colors.textMuted} />
          </TouchableOpacity>

          <Text style={styles.title}>Logga in för att fortsätta</Text>
          <Text style={styles.subtitle}>
            För att komma åt den här funktionen behöver du logga in eller skapa ett konto.
          </Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={goToLogin}>
            <Text style={styles.primaryBtnText}>Logga in / Registrera dig</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={hide}>
            <Text style={styles.linkText}>Inte just nu</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: 24,
    },
    sheet: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: 20,
      padding: 24,
    },
    closeBtn: {
      position: 'absolute',
      top: 12,
      right: 12,
      padding: 4,
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.text,
      marginBottom: 8,
      marginTop: 4,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.textMuted,
      lineHeight: 20,
      marginBottom: 20,
    },
    primaryBtn: {
      height: 50,
      borderRadius: 999,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    primaryBtnText: {
      color: theme.colors.primaryTextOn,
      fontWeight: '800',
      fontSize: 16,
    },
    linkBtn: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    linkText: {
      color: theme.colors.link,
      fontWeight: '600',
      fontSize: 14,
    },
  });
