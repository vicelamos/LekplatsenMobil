
import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export const Chip = ({ label, selected, onPress, style }) => {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        {
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: theme.radius.pill,
          borderWidth: 1,
          borderColor: selected ? theme.colors.primary : theme.colors.chipBorder,
          backgroundColor: selected ? theme.colors.chipSelectedBg : theme.colors.chipBg,
          marginRight: 8,
          marginBottom: 8,
        },
        style,
      ]}
    >
      <Text style={{ color: selected ? theme.colors.chipSelectedText : theme.colors.text, fontWeight: '700' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};
