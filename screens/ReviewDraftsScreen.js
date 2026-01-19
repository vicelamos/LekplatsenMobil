import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

function ReviewDraftsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Granska Utkast</Text>
      <Text>Här kommer admin att kunna granska nya lekplatser.</Text>
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

export default ReviewDraftsScreen;

