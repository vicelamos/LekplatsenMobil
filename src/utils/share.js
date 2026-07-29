import { Share } from 'react-native';

/**
 * Dela en lekplats med andra.
 * @param {object} playground - { id, namn }
 */
export async function sharePlayground(playground) {
  try {
    await Share.share({
      title: playground.namn,
      message: `Kolla in ${playground.namn} på Lekplatsen Sverige! lekplatsen://playground/${playground.id}`,
    });
  } catch (e) {
    // Användaren avbröt delningen
  }
}

/**
 * Dela en incheckning med andra.
 * @param {object} checkin - { id, lekplatsNamn, kommentar }
 */
export async function shareCheckin(checkin) {
  try {
    const text = checkin.kommentar
      ? `${checkin.lekplatsNamn}: "${checkin.kommentar}" – Lekplatsen Sverige`
      : `Incheckning på ${checkin.lekplatsNamn} – Lekplatsen Sverige`;
    await Share.share({
      title: `Incheckning på ${checkin.lekplatsNamn}`,
      message: `${text} lekplatsen://checkin/${checkin.id}`,
    });
  } catch (e) {
    // Användaren avbröt delningen
  }
}
