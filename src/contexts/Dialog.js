import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Dialog } from '../ui/Dialog';

const DialogContext = createContext(null);

/**
 * Ersätter Alert.alert i hela appen.
 *
 * Alert är callbackbaserad och ritas av operativsystemet, vilket gör att
 * popuprutorna ser olika ut på iOS och Android och inte alls ut som appen.
 * Här är de löftesbaserade i stället, vilket också gör anropsställena kortare:
 *
 *   await dialog.alert({ title: 'Fel', message: 'Kunde inte spara.' });
 *
 *   if (await dialog.confirm({ title: 'Ta bort?', destructive: true })) { ... }
 *
 *   const val = await dialog.choose({
 *     title: 'Lägg till bild',
 *     options: [{ label: 'Kamera', value: 'camera' }],
 *   });
 */
export function DialogProvider({ children }) {
  const [request, setRequest] = useState(null);

  const close = useCallback((resolveWith) => {
    setRequest((current) => {
      current?.resolve(resolveWith);
      return null;
    });
  }, []);

  const öppna = useCallback((config) => (
    new Promise((resolve) => {
      // En dialog i taget. Öppnas en ny medan en annan står öppen avvisas den
      // gamla med sitt neutrala värde i stället för att hänga kvar oupplöst.
      setRequest((current) => {
        current?.resolve(current.neutralValue);
        return { ...config, resolve };
      });
    })
  ), []);

  const alert = useCallback(({ title, message, okLabel = 'OK' } = {}) => (
    öppna({
      title,
      message,
      neutralValue: undefined,
      actions: [{ label: okLabel, style: 'default', value: undefined }],
      dismissable: true,
      dismissValue: undefined,
    })
  ), [öppna]);

  const confirm = useCallback(({
    title,
    message,
    confirmLabel = 'OK',
    cancelLabel = 'Avbryt',
    destructive = false,
  } = {}) => (
    öppna({
      title,
      message,
      neutralValue: false,
      dismissValue: false,
      actions: [
        { label: confirmLabel, style: destructive ? 'destructive' : 'default', value: true },
        { label: cancelLabel, style: 'cancel', value: false },
      ],
    })
  ), [öppna]);

  const choose = useCallback(({
    title,
    message,
    options = [],
    cancelLabel = 'Avbryt',
  } = {}) => (
    öppna({
      title,
      message,
      neutralValue: null,
      dismissValue: null,
      actions: [
        ...options.map((o) => ({ label: o.label, style: o.style || 'default', value: o.value })),
        { label: cancelLabel, style: 'cancel', value: null },
      ],
    })
  ), [öppna]);

  const api = useMemo(() => ({ alert, confirm, choose }), [alert, confirm, choose]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      <Dialog
        visible={!!request}
        title={request?.title}
        message={request?.message}
        dismissable={request?.dismissable !== false}
        onRequestClose={() => close(request?.dismissValue)}
        actions={(request?.actions || []).map((action) => ({
          label: action.label,
          style: action.style,
          onPress: () => close(action.value),
        }))}
      />
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error('useDialog måste användas inuti en DialogProvider');
  }
  return ctx;
}
