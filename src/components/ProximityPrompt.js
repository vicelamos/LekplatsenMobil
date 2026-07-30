import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ImageBackground, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { formatDistance } from '../../utils/geo';

/**
 * Appens huvudhandling: du står på en lekplats, du sätter ett betyg.
 *
 * Ett tryck på en stjärna ÄR incheckningen — inget formulär, ingen sparaknapp.
 * Allt annat (bild, kommentar, vänner) läggs till efteråt om användaren vill.
 *
 * Formen speglar kartans lekplatspopup med flit: samma gröna ram, samma radie,
 * samma bild med brickor ovanpå. Det ska kännas som samma sorts ruta.
 *
 * @param {object} props
 * @param {object|null} props.candidate - från pickProximityCandidate()
 * @param {(playground: object, rating: number) => void} props.onRate
 * @param {() => void} props.onDismiss - "jag är inte på någon av dessa"
 * @param {(playground: object) => void} props.onSelectAlternative
 */
export default function ProximityPrompt({
  candidate,
  onRate,
  onDismiss,
  onSelectAlternative,
}) {
  const { theme } = useTheme();
  const [submitted, setSubmitted] = useState(false);

  const playgroundId = candidate?.playground?.id;

  // Ny lekplats föreslagen – spärren släpper.
  useEffect(() => {
    setSubmitted(false);
  }, [playgroundId]);

  if (!candidate?.playground) return null;

  const { playground, distance, confident, alternatives = [] } = candidate;
  const snittbetyg = Number(playground.snittbetyg) || 0;
  const antal = Number(playground.antalIncheckningar) || 0;
  const avstand = formatDistance(distance);

  const bildUrl =
    playground.resolvedImageUrl || playground.bildUrl || playground.imageUrl || '';

  const press = (rating) => {
    // Skrivningen är asynkron. Utan spärr ger ett dubbeltryck två
    // incheckningar och fel snittbetyg på lekplatsen.
    if (submitted) return;
    setSubmitted(true);
    onRate?.(playground, rating);
  };

  /** Betyg och avstånd som brickor ovanpå bilden, precis som i kartans popup. */
  const brickor = (
    <>
      {snittbetyg > 0 && (
        <View
          testID="proximity-rating-summary"
          style={[styles.bricka, { top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)' }]}
        >
          <Ionicons name="star" size={12} color={theme.colors.star} />
          <Text style={{ color: theme.colors.buttonText, fontSize: 12, fontWeight: 'bold' }}>
            {`${snittbetyg.toFixed(1)}${antal > 0 ? ` (${antal})` : ''}`}
          </Text>
        </View>
      )}

      {!!avstand && (
        <View
          style={[styles.bricka, { bottom: 10, right: 10, backgroundColor: theme.colors.success }]}
        >
          <Ionicons name="navigate" size={10} color={theme.colors.buttonText} />
          <Text style={{ color: theme.colors.buttonText, fontSize: 11, fontWeight: 'bold' }}>
            {avstand}
          </Text>
        </View>
      )}
    </>
  );

  return (
    <View
      style={{
        backgroundColor: theme.colors.cardBg,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 3,
        borderColor: theme.colors.primary,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      }}
    >
      {bildUrl ? (
        <ImageBackground
          testID="proximity-image"
          source={{ uri: bildUrl }}
          style={{ width: '100%', height: 140, backgroundColor: theme.colors.bgSoft }}
          resizeMode="cover"
        >
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.2)' }]} />
          {brickor}
        </ImageBackground>
      ) : (
        <View
          testID="proximity-image-placeholder"
          style={{
            width: '100%',
            height: 140,
            backgroundColor: theme.colors.bgSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="image-outline" size={40} color={theme.colors.textMuted} />
          {brickor}
        </View>
      )}

      <View style={{ padding: theme.space.lg }}>
        <Text
          testID="proximity-heading"
          style={{ color: theme.colors.textMuted, fontSize: theme.type.size.sm }}
        >
          {confident ? 'Du är på' : 'Är du på'}
        </Text>

        <Text
          style={{
            color: theme.colors.text,
            fontSize: theme.type.size.xl,
            fontWeight: theme.type.weight.extraBold,
            marginTop: 2,
          }}
          numberOfLines={2}
        >
          {playground.namn}
        </Text>

        {/* Stjärnorna – stora nog för en tumme, med gott om tryckyta */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: theme.space.lg,
            opacity: submitted ? 0.5 : 1,
          }}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <TouchableOpacity
              key={n}
              onPress={() => press(n)}
              disabled={submitted}
              accessibilityRole="button"
              accessibilityLabel={`Sätt betyg ${n} av 5`}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              style={{ paddingVertical: theme.space.xs, paddingHorizontal: theme.space.sm }}
            >
              <Ionicons name="star-outline" size={40} color={theme.colors.star} />
            </TouchableOpacity>
          ))}
        </View>

        {alternatives.length > 0 && (
          <View testID="proximity-alternatives" style={{ marginTop: theme.space.lg }}>
            <Text style={{ color: theme.colors.textMuted, fontSize: theme.type.size.xs }}>
              Eller någon av dessa
            </Text>
            {alternatives.map((alt) => (
              <TouchableOpacity
                key={alt.id}
                onPress={() => onSelectAlternative?.(alt)}
                accessibilityRole="button"
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: theme.space.sm,
                }}
              >
                <Text style={{ color: theme.colors.text }}>{alt.namn}</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: theme.type.size.sm }}>
                  {formatDistance(alt.distance) || ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          testID="proximity-dismiss"
          onPress={() => onDismiss?.()}
          accessibilityRole="button"
          accessibilityLabel="Jag är inte här, visa kartan"
          style={{ marginTop: theme.space.md, alignSelf: 'flex-start' }}
        >
          <Text style={{ color: theme.colors.link, fontWeight: theme.type.weight.semi }}>
            Inte här? Visa kartan
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bricka: {
    position: 'absolute',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
});
