import React, { createContext, useContext } from 'react';
import sv from './sv';

/**
 * Enkel i18n-lösning. Stöder framtida utökning med fler språk.
 * Använd: const { t } = useI18n();
 *         <Text>{t.auth.login}</Text>
 */

const translations = { sv };
const I18nContext = createContext(sv);

export function I18nProvider({ locale = 'sv', children }) {
  const strings = translations[locale] || sv;
  return <I18nContext.Provider value={strings}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
