import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Animerad skeleton-placeholder-komponent.
 * Användning: <Skeleton width={200} height={20} /> eller <Skeleton circle size={48} />
 */
export const Skeleton = ({ width, height = 16, borderRadius, circle, size, style }) => {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  const resolvedWidth = circle ? size : width;
  const resolvedHeight = circle ? size : height;
  const resolvedRadius = circle ? (size || 0) / 2 : (borderRadius ?? 6);

  return (
    <Animated.View
      style={[
        {
          width: resolvedWidth,
          height: resolvedHeight,
          borderRadius: resolvedRadius,
          backgroundColor: theme.colors.bgSoft,
          opacity,
        },
        style,
      ]}
    />
  );
};

/**
 * Feed-skeleton som matchar CheckInCard-layouten.
 */
export const FeedSkeleton = ({ count = 3 }) => {
  const { theme } = useTheme();
  return (
    <View style={{ padding: theme.space.lg }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            backgroundColor: theme.colors.cardBg,
            borderRadius: theme.radius.lg,
            padding: theme.space.lg,
            marginBottom: theme.space.md,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Skeleton circle size={40} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Skeleton width={120} height={14} />
              <Skeleton width={80} height={10} style={{ marginTop: 6 }} />
            </View>
          </View>
          <Skeleton width="100%" height={12} style={{ marginBottom: 8 }} />
          <Skeleton width="70%" height={12} style={{ marginBottom: 12 }} />
          <Skeleton width="100%" height={160} borderRadius={12} />
        </View>
      ))}
    </View>
  );
};
