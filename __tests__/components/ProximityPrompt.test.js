import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import ProximityPrompt from '../../src/components/ProximityPrompt';

const lekplats = (id, namn, extra = {}) => ({ id, namn, ...extra });

const kandidat = (overrides = {}) => ({
  playground: lekplats('pg1', 'Slottsskogens lekplats', { snittbetyg: 4.2, antalIncheckningar: 18 }),
  distance: 120,
  confident: true,
  alternatives: [],
  ...overrides,
});

const renderPrompt = (props = {}) =>
  render(
    <ThemeProvider preferSystem={false}>
      <ProximityPrompt
        candidate={kandidat()}
        onRate={() => {}}
        onDismiss={() => {}}
        onSelectAlternative={() => {}}
        {...props}
      />
    </ThemeProvider>
  );

describe('ProximityPrompt – vad som visas', () => {
  it('renderar ingenting utan kandidat', () => {
    const { toJSON } = renderPrompt({ candidate: null });
    expect(toJSON()).toBeNull();
  });

  it('visar lekplatsens namn', () => {
    const { getByText } = renderPrompt();
    expect(getByText('Slottsskogens lekplats')).toBeTruthy();
  });

  it('visar avståndet i läsbar form', () => {
    const { getByText } = renderPrompt();
    expect(getByText(/120 m/)).toBeTruthy();
  });

  it('visar snittbetyg när lekplatsen har ett', () => {
    const { getByText } = renderPrompt();
    expect(getByText(/4[.,]2/)).toBeTruthy();
  });

  it('visar inget snittbetyg för en obetygsatt lekplats', () => {
    const { queryByTestId } = renderPrompt({
      candidate: kandidat({ playground: lekplats('pg2', 'Ny lekplats') }),
    });
    expect(queryByTestId('proximity-rating-summary')).toBeNull();
  });
});

describe('ProximityPrompt – bilden', () => {
  it('visar lekplatsens bild när den har en', () => {
    const { getByTestId, queryByTestId } = renderPrompt({
      candidate: kandidat({
        playground: lekplats('pg1', 'Slottsskogen', {
          resolvedImageUrl: 'https://exempel.se/lekplats.jpg',
        }),
      }),
    });

    expect(getByTestId('proximity-image').props.source).toEqual({
      uri: 'https://exempel.se/lekplats.jpg',
    });
    expect(queryByTestId('proximity-image-placeholder')).toBeNull();
  });

  it('faller tillbaka på bildUrl och imageUrl', () => {
    const { getByTestId, rerender } = renderPrompt({
      candidate: kandidat({
        playground: lekplats('pg1', 'A', { bildUrl: 'https://exempel.se/b.jpg' }),
      }),
    });
    expect(getByTestId('proximity-image').props.source).toEqual({
      uri: 'https://exempel.se/b.jpg',
    });

    rerender(
      <ThemeProvider preferSystem={false}>
        <ProximityPrompt
          candidate={kandidat({
            playground: lekplats('pg1', 'A', { imageUrl: 'https://exempel.se/c.jpg' }),
          })}
          onRate={() => {}}
          onDismiss={() => {}}
          onSelectAlternative={() => {}}
        />
      </ThemeProvider>
    );
    expect(getByTestId('proximity-image').props.source).toEqual({
      uri: 'https://exempel.se/c.jpg',
    });
  });

  /**
   * Ingen fjärrhämtad "bild saknas"-platshållare — en tom ruta med ikon är
   * snabbare och slipper ett nätverksanrop som ändå inte visar något.
   */
  it('visar en platshållare när bild saknas', () => {
    const { getByTestId, queryByTestId } = renderPrompt();
    expect(getByTestId('proximity-image-placeholder')).toBeTruthy();
    expect(queryByTestId('proximity-image')).toBeNull();
  });
});

describe('ProximityPrompt – GPS-osäkerhet', () => {
  it('slår fast när positionen är säker', () => {
    const { getByTestId } = renderPrompt();
    expect(getByTestId('proximity-heading').props.children).toBe('Du är på');
  });

  /**
   * Med dålig GPS får appen inte påstå var användaren står. Att fråga i
   * stället är skillnaden mellan hjälpsam och creepy.
   */
  it('frågar när positionen är osäker', () => {
    const { getByTestId } = renderPrompt({ candidate: kandidat({ confident: false }) });
    expect(getByTestId('proximity-heading').props.children).toBe('Är du på');
  });
});

describe('ProximityPrompt – betygsättning', () => {
  it('har fem stjärnor med läsbara etiketter', () => {
    const { getByLabelText } = renderPrompt();
    for (let n = 1; n <= 5; n++) {
      expect(getByLabelText(`Sätt betyg ${n} av 5`)).toBeTruthy();
    }
  });

  it('ett tryck på tredje stjärnan betygsätter med 3', () => {
    const onRate = jest.fn();
    const { getByLabelText } = renderPrompt({ onRate });

    fireEvent.press(getByLabelText('Sätt betyg 3 av 5'));

    expect(onRate).toHaveBeenCalledTimes(1);
    expect(onRate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pg1' }),
      3
    );
  });

  /**
   * Skrivningen är asynkron. Utan spärr skapar ett dubbeltryck två
   * incheckningar, och lekplatsens snittbetyg blir fel.
   */
  it('dubbeltryck skapar bara en incheckning', () => {
    const onRate = jest.fn();
    const { getByLabelText } = renderPrompt({ onRate });

    const stjarna = getByLabelText('Sätt betyg 5 av 5');
    fireEvent.press(stjarna);
    fireEvent.press(stjarna);
    fireEvent.press(getByLabelText('Sätt betyg 2 av 5'));

    expect(onRate).toHaveBeenCalledTimes(1);
    expect(onRate).toHaveBeenCalledWith(expect.anything(), 5);
  });

  it('går att betygsätta igen när kandidaten byts ut', () => {
    const onRate = jest.fn();
    const { getByLabelText, rerender } = renderPrompt({ onRate });

    fireEvent.press(getByLabelText('Sätt betyg 4 av 5'));

    rerender(
      <ThemeProvider preferSystem={false}>
        <ProximityPrompt
          candidate={kandidat({ playground: lekplats('pg9', 'Annan lekplats') })}
          onRate={onRate}
          onDismiss={() => {}}
          onSelectAlternative={() => {}}
        />
      </ThemeProvider>
    );

    fireEvent.press(getByLabelText('Sätt betyg 1 av 5'));

    expect(onRate).toHaveBeenCalledTimes(2);
    expect(onRate).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'pg9' }),
      1
    );
  });
});

describe('ProximityPrompt – när det är fel lekplats', () => {
  it('avfärdar prompten', () => {
    const onDismiss = jest.fn();
    const { getByTestId } = renderPrompt({ onDismiss });

    fireEvent.press(getByTestId('proximity-dismiss'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('visar andra lekplatser inom räckhåll', () => {
    const { getByText } = renderPrompt({
      candidate: kandidat({
        alternatives: [
          { ...lekplats('pg2', 'Plikta'), distance: 90 },
          { ...lekplats('pg3', 'Björngårdsvillan'), distance: 140 },
        ],
      }),
    });

    expect(getByText('Plikta')).toBeTruthy();
    expect(getByText('Björngårdsvillan')).toBeTruthy();
  });

  it('byter lekplats när ett alternativ väljs', () => {
    const onSelectAlternative = jest.fn();
    const { getByText } = renderPrompt({
      onSelectAlternative,
      candidate: kandidat({
        alternatives: [{ ...lekplats('pg2', 'Plikta'), distance: 90 }],
      }),
    });

    fireEvent.press(getByText('Plikta'));

    expect(onSelectAlternative).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pg2' })
    );
  });

  it('visar ingen alternativlista när det inte finns några', () => {
    const { queryByTestId } = renderPrompt();
    expect(queryByTestId('proximity-alternatives')).toBeNull();
  });
});
