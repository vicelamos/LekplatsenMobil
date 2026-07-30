import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { Dialog } from '../../src/ui/Dialog';
import { DialogProvider, useDialog } from '../../src/contexts/Dialog';

const wrap = (ui) => <ThemeProvider preferSystem={false}>{ui}</ThemeProvider>;

describe('Dialog – presentationen', () => {
  it('syns inte när visible är falskt', () => {
    const { queryByTestId } = render(wrap(<Dialog visible={false} title="Hej" />));
    expect(queryByTestId('dialog-title')).toBeNull();
  });

  it('visar titel och meddelande', () => {
    const { getByTestId } = render(
      wrap(<Dialog visible title="Radera konto" message="Detta går inte att ångra." />)
    );
    expect(getByTestId('dialog-title').props.children).toBe('Radera konto');
    expect(getByTestId('dialog-message').props.children).toBe('Detta går inte att ångra.');
  });

  it('renderar knappar och anropar rätt en', () => {
    const first = jest.fn();
    const second = jest.fn();
    const { getByLabelText } = render(
      wrap(
        <Dialog
          visible
          title="Ta bort"
          actions={[
            { label: 'Ta bort', style: 'destructive', onPress: first },
            { label: 'Avbryt', style: 'cancel', onPress: second },
          ]}
        />
      )
    );

    fireEvent.press(getByLabelText('Ta bort'));
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it('stängs vid tryck utanför när den får stängas', () => {
    const onRequestClose = jest.fn();
    const { getByTestId } = render(
      wrap(<Dialog visible title="Hej" onRequestClose={onRequestClose} />)
    );

    fireEvent.press(getByTestId('dialog-backdrop'));
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('stängs inte vid tryck utanför när dismissable är falskt', () => {
    const onRequestClose = jest.fn();
    const { getByTestId } = render(
      wrap(<Dialog visible title="Hej" dismissable={false} onRequestClose={onRequestClose} />)
    );

    fireEvent.press(getByTestId('dialog-backdrop'));
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it('stänger inte vid tryck inuti rutan', () => {
    const onRequestClose = jest.fn();
    const { getByTestId } = render(
      wrap(<Dialog visible title="Hej" onRequestClose={onRequestClose} />)
    );

    fireEvent.press(getByTestId('dialog'));
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it('kan innehålla egen komponent', () => {
    const { getByText } = render(
      wrap(<Dialog visible title="Filter"><Text>Eget innehåll</Text></Dialog>)
    );
    expect(getByText('Eget innehåll')).toBeTruthy();
  });
});

/** Liten testyta som anropar useDialog och visar resultatet. */
function Provkanin({ run }) {
  const dialog = useDialog();
  const [resultat, setResultat] = React.useState('inget');

  return (
    <>
      <TouchableOpacity
        accessibilityLabel="kör"
        onPress={async () => setResultat(String(await run(dialog)))}
      >
        <Text>kör</Text>
      </TouchableOpacity>
      <Text testID="resultat">{resultat}</Text>
    </>
  );
}

const renderMedProvider = (run) =>
  render(
    wrap(
      <DialogProvider>
        <Provkanin run={run} />
      </DialogProvider>
    )
  );

describe('useDialog – alert', () => {
  it('visar titel och meddelande och löser ut vid OK', async () => {
    const { getByLabelText, getByTestId } = renderMedProvider((d) =>
      d.alert({ title: 'Fel', message: 'Kunde inte spara.' }).then(() => 'klar')
    );

    fireEvent.press(getByLabelText('kör'));
    await waitFor(() => expect(getByTestId('dialog-title').props.children).toBe('Fel'));

    fireEvent.press(getByLabelText('OK'));
    await waitFor(() => expect(getByTestId('resultat').props.children).toBe('klar'));
  });
});

describe('useDialog – confirm', () => {
  it('ger true när användaren bekräftar', async () => {
    const { getByLabelText, getByTestId } = renderMedProvider((d) =>
      d.confirm({ title: 'Ta bort?', confirmLabel: 'Ta bort', destructive: true })
    );

    fireEvent.press(getByLabelText('kör'));
    await waitFor(() => expect(getByTestId('dialog-title')).toBeTruthy());

    fireEvent.press(getByLabelText('Ta bort'));
    await waitFor(() => expect(getByTestId('resultat').props.children).toBe('true'));
  });

  it('ger false när användaren avbryter', async () => {
    const { getByLabelText, getByTestId } = renderMedProvider((d) =>
      d.confirm({ title: 'Ta bort?' })
    );

    fireEvent.press(getByLabelText('kör'));
    await waitFor(() => expect(getByTestId('dialog-title')).toBeTruthy());

    fireEvent.press(getByLabelText('Avbryt'));
    await waitFor(() => expect(getByTestId('resultat').props.children).toBe('false'));
  });

  /** Tryck utanför är detsamma som att avbryta – aldrig som att bekräfta. */
  it('ger false när användaren trycker utanför', async () => {
    const { getByLabelText, getByTestId } = renderMedProvider((d) =>
      d.confirm({ title: 'Ta bort?' })
    );

    fireEvent.press(getByLabelText('kör'));
    await waitFor(() => expect(getByTestId('dialog-title')).toBeTruthy());

    fireEvent.press(getByTestId('dialog-backdrop'));
    await waitFor(() => expect(getByTestId('resultat').props.children).toBe('false'));
  });
});

describe('useDialog – choose', () => {
  it('ger det valda värdet', async () => {
    const { getByLabelText, getByTestId } = renderMedProvider((d) =>
      d.choose({
        title: 'Lägg till bild',
        options: [
          { label: 'Välj från galleri', value: 'galleri' },
          { label: 'Ta foto', value: 'kamera' },
        ],
      })
    );

    fireEvent.press(getByLabelText('kör'));
    await waitFor(() => expect(getByTestId('dialog-title')).toBeTruthy());

    fireEvent.press(getByLabelText('Ta foto'));
    await waitFor(() => expect(getByTestId('resultat').props.children).toBe('kamera'));
  });

  it('ger null när användaren avbryter', async () => {
    const { getByLabelText, getByTestId } = renderMedProvider((d) =>
      d.choose({ title: 'Lägg till bild', options: [{ label: 'Ta foto', value: 'kamera' }] })
    );

    fireEvent.press(getByLabelText('kör'));
    await waitFor(() => expect(getByTestId('dialog-title')).toBeTruthy());

    fireEvent.press(getByLabelText('Avbryt'));
    await waitFor(() => expect(getByTestId('resultat').props.children).toBe('null'));
  });
});

describe('useDialog – utan provider', () => {
  it('säger tydligt ifrån', () => {
    const Trasig = () => { useDialog(); return null; };
    const tyst = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(wrap(<Trasig />))).toThrow(/DialogProvider/);
    tyst.mockRestore();
  });
});
