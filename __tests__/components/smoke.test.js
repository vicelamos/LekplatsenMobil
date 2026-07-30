import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

/**
 * Kanariefågel för testmiljön.
 *
 * Uppsättningen av jest-expo är känslig: presetens transformIgnorePatterns
 * måste ärvas orörd, och expos lata globaler måste laddas i setupEnv.js.
 * Går något av det sönder failar det här testet först och tydligast, i stället
 * för att komponenttesterna kraschar med ett svårtytt scope-fel.
 */
it('testmiljön kan rendera en React Native-komponent', () => {
  const { getByText } = render(<Text>hej</Text>);
  expect(getByText('hej')).toBeTruthy();
});
