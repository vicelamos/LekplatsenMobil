
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export const Card = ({ children, style }) => {
  const { theme, mode } = useTheme(); // Hämta 'mode' (light/dark) om det finns
  
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.cardBg,
          borderRadius: theme.radius.lg,
          borderWidth: mode === 'dark' ? 1 : 0, // Visa kantlinje i dark mode för tydlighet
          borderColor: theme.colors.border,
          padding: theme.space.lg,
          // Om skuggan ser konstig ut i mörkt läge, kan du dölja den här:
          ...(mode === 'dark' ? {} : theme.shadow.card),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};
