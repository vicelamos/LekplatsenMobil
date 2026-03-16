
import React from 'react';
import { ImageBackground, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

// Justera denna require till DIN faktiska sökväg.
// Lägg gärna filen här: assets/patterns/background-pattern.jpg
let patternSource;
try {
  patternSource = require('../../assets/patterns/background-pattern.jpg');
} catch (e) {
  patternSource = null;
}

export const PatternBackground = ({ children, intensity = 0.06 }) => {
  const { theme } = useTheme();

  if (!patternSource) {
    // Fallback om bilden saknas
    return <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>{children}</View>;
  }

  return (
    <ImageBackground
      source={patternSource}
      resizeMode="cover"
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      imageStyle={{ opacity: intensity }}
    >
      <View style={{ flex: 1 }}>{children}</View>
    </ImageBackground>
  );
};
