
import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export const SectionHeader = ({ title, right }) => {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.space.md }}>
      <Text style={{ fontSize: theme.type.size.lg, fontWeight: theme.type.weight.extraBold, color: theme.colors.text }}>
        {title}
      </Text>
      {right}
    </View>
  );
};
