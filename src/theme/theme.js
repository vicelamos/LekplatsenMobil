// src/theme/theme.js
import { palette } from './palette';

export const radii = {
  xs: 6,
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const spacing = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
};

export const typography = {
  size: { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, '2xl': 26 },
  weight: { regular: '400', semi: '600', bold: '700', extraBold: '800' },
};

// 🗺️ Kartstil och styling
export const mapStyle = {
  // Custom Google Maps stil
  customMapStyle: [
    {
      "featureType": "poi",
      "elementType": "labels",
      "stylers": [{ "visibility": "off" }]
    },
    {
      "featureType": "poi.business",
      "stylers": [{ "visibility": "off" }]
    },
    {
      "featureType": "transit",
      "elementType": "labels.icon",
      "stylers": [{ "visibility": "off" }]
    },
    {
      "featureType": "water",
      "elementType": "geometry",
      "stylers": [{ "color": "#a2daf7" }]
    },
    {
      "featureType": "landscape.natural",
      "elementType": "geometry.fill",
      "stylers": [{ "color": "#e8f5e9" }]
    },
    {
      "featureType": "road",
      "elementType": "geometry.stroke",
      "stylers": [{ "color": "#ffffff" }]
    }
  ],
  // Styling för kartcontainrar
  containerStyle: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  // Färg för markörer
  markerColor: '#FF6B35',
};

// ☀️ Skuggor för ljust läge
const lightShadows = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2, // Ger djup på Android
  },
  floating: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
};

// 🌙 Skuggor för mörkt läge
const darkShadows = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.3, // Starkare opacitet eftersom bakgrunden är mörk
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 0, // Inaktiverar Androids automatiska ljusare ton i dark mode
  },
  floating: {
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 0,
  },
};

// ✅ Ljust tema
export const lightTheme = {
  name: 'light',
  colors: {
    bg: palette.vanilla100,
    bgSoft: palette.gray50,
    cardBg: palette.white,
    surface: palette.gray50,
    border: palette.gray100,
    text: palette.gray800,
    textMuted: palette.gray500,
    primary: palette.leaf500,
    primaryDark: palette.leaf700,
    primarySoft: palette.leaf50,
    primaryStrong: palette.leaf800,
    primaryTextOn: palette.white,
    accent: palette.sun400,
    info: palette.sky400,
    success: palette.leaf600,
    successSoft: '#E8F5E9',
    warning: palette.sun500,
    danger: palette.coral500,
    star: '#F59E0B',
    inputBg: palette.gray25,
    overlay: 'rgba(0,0,0,0.55)',
    overlayText: '#ffffff',
    chipBg: palette.white,
    chipBorder: palette.gray200,
    chipSelectedBg: palette.leaf100,
    chipSelectedText: palette.leaf800,
    link: palette.sky400,
  },
  radius: radii,
  space: spacing,
  type: typography,
  shadow: lightShadows,
};

// 🌙 Mörkt tema
export const darkTheme = {
  name: 'dark',
  colors: {
    bg: '#0E1214',
    bgSoft: '#181E24',
    cardBg: '#141A1E',
    surface: '#1A2028',
    border: '#20262C',
    text: '#ffffff',
    textMuted: '#A9B4C0',
    primary: palette.leaf400,
    primaryDark: palette.leaf600,
    primarySoft: '#1B2A20',
    primaryStrong: '#CDECCF',
    primaryTextOn: '#0E1214',
    accent: '#2B2F16',
    info: '#7FB0FF',
    success: '#80D39B',
    successSoft: '#1B2A20',
    warning: '#FFD47A',
    danger: '#FF8C6A',
    star: '#F59E0B',
    inputBg: '#181E24',
    overlay: 'rgba(0,0,0,0.7)',
    overlayText: '#ffffff',
    chipBg: '#12171B',
    chipBorder: '#20262C',
    chipSelectedBg: '#1B2A20',
    chipSelectedText: '#CDECCF',
    link: '#8EBBFF',
  },
  radius: radii,
  space: spacing,
  type: typography,
  shadow: darkShadows, // Använder de dämpade skuggorna här
};