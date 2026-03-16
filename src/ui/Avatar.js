// src/ui/Avatar.js
import React from 'react';
import { Image, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme';

export const Avatar = ({
  uri,
  name = '',
  size = 44,
  style,
  onPress,
  withShadow = false,
  accessibilityLabel = 'Profilbild',
}) => {
  const { theme } = useTheme();

  const initial = (name || '').trim().charAt(0).toUpperCase() || '?';
  const fallbackUrl = `https://placehold.co/${size}x${size}/e0e0e0/777?text=${encodeURIComponent(initial)}`;
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: theme.colors.bgSoft,
          padding: 0,   // viktigt för att inte “puffa”
          margin: 0,    // viktigt för att inte “puffa”
        },
        withShadow ? theme.shadow.floating : null,
        style,
      ]}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      <Image
        source={{ uri: uri || fallbackUrl }}
        style={{ width: '100%', height: '100%' }}
        resizeMode="cover"
      />
    </Wrapper>
  );
};