import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

function AddPlaygroundScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Lägg till ny lekplats</Text>
      <Text>Här kommer ett formulär för att lägga till lekplatser.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  }
});

export default AddPlaygroundScreen;

