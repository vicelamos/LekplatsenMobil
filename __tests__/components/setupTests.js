/**
 * @expo/vector-icons laddar sitt typsnitt asynkront och gör en setState när
 * det är klart. Det sker utanför testets act()-block och ger ett varningsbrus
 * som dränker riktiga fel. Ikonen ersätts därför med en enkel vy — testerna
 * bryr sig om etiketter och tryck, inte om glyfer.
 */
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Ikon = ({ name, ...rest }) => React.createElement(View, { testID: `icon-${name}`, ...rest });
  return { Ionicons: Ikon, MaterialIcons: Ikon, FontAwesome: Ikon };
});
