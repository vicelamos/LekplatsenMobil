
import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export const Button = ({ title, onPress, loading, disabled, variant = 'primary', style }) => {
  const { theme } = useTheme();

  const bg = {
    primary: theme.colors.primary,
    secondary: theme.colors.cardBg,
    danger: theme.colors.danger,
  }[variant];

  const borderColor = variant === 'secondary' ? theme.colors.text : 'transparent';
  const textColor = variant === 'secondary' ? theme.colors.text : theme.colors.primaryTextOn;

  return (
    <TouchableOpacity
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        {
          height: 52,
          borderRadius: theme.radius.pill,
          backgroundColor: bg,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: theme.space.xl,
          opacity: disabled ? 0.6 : 1,
          transform: [{ translateY: loading ? 1 : 0 }],
        },
        style,
      ]}
      activeOpacity={0.9}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={{ color: textColor, fontWeight: '800', fontSize: theme.type.size.md }}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};
