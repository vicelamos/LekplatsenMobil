/**
 * Ren logik för att koppla ihop lekplatser med sin sponsordata.
 *
 * Låg i två identiska kopior inne i HomeScreen och SearchScreen tidigare.
 * Ingen firebase-import — testbar utan emulator.
 */

/**
 * @param {object[]} playgrounds
 * @param {object[]} sponsors
 * @returns {object[]} kopior med `sponsorData` och `sponsorName` påsatta
 */
export function joinSponsorData(playgrounds = [], sponsors = []) {
  const sponsorById = new Map((sponsors || []).map((s) => [s.id, s]));

  return (playgrounds || []).map((pg) => {
    const sponsring = pg?.sponsorship;
    const sponsorData =
      sponsring?.active && sponsring?.sponsorId
        ? sponsorById.get(sponsring.sponsorId) || null
        : null;

    return {
      ...pg,
      sponsorData,
      sponsorName: sponsorData?.name || null,
    };
  });
}
