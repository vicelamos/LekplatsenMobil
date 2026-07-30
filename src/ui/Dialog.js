import React from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Appens enda popup-ruta.
 *
 * Tidigare fanns fjorton handbyggda modaler med olika toning, radie, animation
 * och stängningsbeteende, plus 97 anrop till operativsystemets Alert. Allt går
 * numera via den här komponenten, så att en popup alltid ser ut som en popup —
 * och som den här appen.
 *
 * Presentationen är avsiktligt dum: den vet ingenting om löften eller köer.
 * Den logiken ligger i src/contexts/Dialog.js.
 */
export function Dialog({
  visible,
  title,
  message,
  actions = [],
  onRequestClose,
  dismissable = true,
  children,
  testID = 'dialog',
}) {
  const { theme } = useTheme();

  const stängIfrånBakgrund = () => {
    if (dismissable) onRequestClose?.();
  };

  const färgFörStil = (stil) => {
    if (stil === 'destructive') return theme.colors.danger;
    if (stil === 'cancel') return theme.colors.textMuted;
    return theme.colors.primary;
  };

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
      statusBarTranslucent
    >
      <Pressable
        testID={`${testID}-backdrop`}
        accessibilityLabel="Stäng dialogrutan"
        onPress={stängIfrånBakgrund}
        style={{
          flex: 1,
          backgroundColor: theme.colors.overlay,
          justifyContent: 'center',
          padding: theme.space.xl,
        }}
      >
        {/* Egen Pressable som slukar tryck, så att tryck i rutan inte stänger den */}
        <Pressable
          testID={testID}
          accessibilityViewIsModal
          accessibilityRole="alert"
          onPress={() => {}}
          style={{
            backgroundColor: theme.colors.cardBg,
            borderRadius: theme.radius.xl,
            padding: theme.space.xl,
            ...theme.shadow.floating,
          }}
        >
          {!!title && (
            <Text
              testID={`${testID}-title`}
              style={{
                color: theme.colors.text,
                fontSize: theme.type.size.lg,
                fontWeight: theme.type.weight.extraBold,
              }}
            >
              {title}
            </Text>
          )}

          {!!message && (
            <Text
              testID={`${testID}-message`}
              style={{
                color: theme.colors.textMuted,
                fontSize: theme.type.size.md,
                marginTop: title ? theme.space.xs : 0,
                lineHeight: 22,
              }}
            >
              {message}
            </Text>
          )}

          {children ? (
            <View style={{ marginTop: theme.space.md }}>{children}</View>
          ) : null}

          {actions.length > 0 && (
            <View style={{ marginTop: theme.space.xl }}>
              {actions.map((action, index) => (
                <TouchableOpacity
                  key={action.label ?? index}
                  testID={`${testID}-action-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  onPress={action.onPress}
                  style={{
                    paddingVertical: theme.space.md,
                    alignItems: 'center',
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: theme.colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: färgFörStil(action.style),
                      fontSize: theme.type.size.md,
                      fontWeight:
                        action.style === 'cancel'
                          ? theme.type.weight.semi
                          : theme.type.weight.bold,
                    }}
                  >
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
