// src/theme/ThemeProvider.js
import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { Appearance } from 'react-native';
import { lightTheme, darkTheme } from './theme';

const ThemeContext = createContext({
  theme: lightTheme,
  mode: 'light',
  setMode: (_m) => {},
});

export const ThemeProvider = ({ children, preferSystem = true }) => {
  const system = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  const [mode, setMode] = useState(preferSystem ? system : 'light');

  useEffect(() => {
    if (!preferSystem) return;
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setMode(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => sub?.remove?.();
  }, [preferSystem]);

  const theme = useMemo(() => (mode === 'dark' ? darkTheme : lightTheme), [mode]);

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
