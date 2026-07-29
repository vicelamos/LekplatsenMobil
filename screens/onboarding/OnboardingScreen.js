import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Button } from '../../src/ui';

const { width } = Dimensions.get('window');

const ONBOARDING_KEY = '@lekplatsen_onboarding_done';

const slides = [
  {
    key: '1',
    icon: 'map-outline',
    title: 'Hitta lekplatser',
    description: 'Upptäck lekplatser nära dig med hjälp av kartan. Filtrera på avstånd, betyg och utrustning.',
  },
  {
    key: '2',
    icon: 'camera-outline',
    title: 'Checka in',
    description: 'Checka in på lekplatser du besöker. Ta bilder, skriv omdömen och dela dina upplevelser.',
  },
  {
    key: '3',
    icon: 'people-outline',
    title: 'Socialt',
    description: 'Följ vänner, se deras incheckningar och upptäck nya lekplatser genom deras äventyr.',
  },
  {
    key: '4',
    icon: 'trophy-outline',
    title: 'Samla troféer',
    description: 'Lås upp troféer genom att besöka fler lekplatser och slutföra utmaningar!',
  },
  {
    key: '5',
    icon: 'sparkles-outline',
    title: 'Inget konto krävs',
    description: 'Börja utforska lekplatser direkt! Skapa ett konto när du vill checka in, spara favoriter och följa vänner.',
  },
];

export default function OnboardingScreen({ onComplete }) {
  const { theme } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);

  const handleComplete = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    onComplete();
  };

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      handleComplete();
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const renderSlide = ({ item }) => (
    <View style={[styles.slide, { width }]}>
      <View style={[styles.iconContainer, { backgroundColor: theme.colors.primarySoft }]}>
        <Ionicons name={item.icon} size={72} color={theme.colors.primary} />
      </View>
      <Text style={[styles.title, { color: theme.colors.text }]}>{item.title}</Text>
      <Text style={[styles.description, { color: theme.colors.textMuted }]}>
        {item.description}
      </Text>
    </View>
  );

  const isLastSlide = currentIndex === slides.length - 1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        keyExtractor={(item) => item.key}
      />

      {/* Prickindikator */}
      <View style={styles.pagination}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor:
                  index === currentIndex ? theme.colors.primary : theme.colors.border,
                width: index === currentIndex ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      {/* Knappar */}
      <View style={styles.buttonContainer}>
        {!isLastSlide && (
          <TouchableOpacity onPress={handleComplete} style={styles.skipButton}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 16 }}>Hoppa över</Text>
          </TouchableOpacity>
        )}
        <Button
          title={isLastSlide ? 'Utforska lekplatser' : 'Nästa'}
          onPress={handleNext}
          style={{ flex: isLastSlide ? 1 : 0, minWidth: 140 }}
        />
      </View>
    </SafeAreaView>
  );
}

/** Kolla om onboarding redan visats */
export async function hasCompletedOnboarding() {
  const value = await AsyncStorage.getItem(ONBOARDING_KEY);
  return value === 'true';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
