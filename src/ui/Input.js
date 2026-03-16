// src/ui/Input.js
import React, { forwardRef } from 'react';
import { TextInput, View, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export const Input = forwardRef(
  (
    {
      // Value & events
      value,
      onChangeText,
      onSubmitEditing,
      onFocus,
      onBlur,

      // Text options
      placeholder,
      multiline = false,
      keyboardType = 'default',
      secureTextEntry = false,
      autoCapitalize = 'none',
      autoCorrect = false,
      textContentType,
      autoComplete,
      returnKeyType,
      blurOnSubmit,

      // Styling
      style,                // text field styling
      containerStyle,       // outer view styling
      placeholderTextColor, // optional override

      // Right-side icon (e.g. eye icon)
      rightIcon,
      onPressRight,

      // Any extra props should pass through to TextInput:
      ...rest
    },
    ref
  ) => {
    const { theme } = useTheme();

    return (
      <View
        style={[
          {
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
            // ✅ FIXAD: Använder nu temats färg istället för hårdkodad '#FAFAFA'
            backgroundColor: theme.colors.cardBg, 
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 50,
          },
          containerStyle,
        ]}
        pointerEvents="auto"
      >
        <TextInput
          ref={ref}
          style={[
            {
              flex: 1,
              color: theme.colors.text,
              fontSize: theme.type.size.md,
              paddingHorizontal: theme.space.md,
              paddingVertical: multiline ? theme.space.md : 0,
              // Säkerställ att texten inte är vit på vit bakgrund (eller tvärtom)
              textAlignVertical: multiline ? 'top' : 'center',
            },
            style,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor ?? theme.colors.textMuted}
          keyboardType={keyboardType}
          multiline={multiline}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          textContentType={textContentType}
          autoComplete={autoComplete}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
          onFocus={onFocus}
          onBlur={onBlur}
          allowFontScaling
          importantForAutofill="yes"
          disableFullscreenUI
          {...rest}
        />

        {rightIcon ? (
          <TouchableOpacity
            onPress={onPressRight}
            style={{
              paddingHorizontal: 12,
              height: '100%',
              justifyContent: 'center',
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            {rightIcon}
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }
);