import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const LoginPromptContext = createContext(null);

export function LoginPromptProvider({ children }) {
  const [state, setState] = useState({ visible: false, returnScreen: null, returnParams: null });

  const show = useCallback((returnScreen, returnParams) => {
    setState({ visible: true, returnScreen: returnScreen || null, returnParams: returnParams || null });
  }, []);

  const hide = useCallback(() => {
    setState((s) => ({ ...s, visible: false }));
  }, []);

  const value = useMemo(
    () => ({ ...state, show, hide }),
    [state, show, hide]
  );

  return <LoginPromptContext.Provider value={value}>{children}</LoginPromptContext.Provider>;
}

export function useLoginPrompt() {
  const ctx = useContext(LoginPromptContext);
  if (!ctx) {
    throw new Error('useLoginPrompt måste användas inom en LoginPromptProvider');
  }
  return ctx;
}
