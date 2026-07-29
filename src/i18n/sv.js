/**
 * Svenska strängar för Lekplatsen Sverige.
 * Extraherade från auth- och profilskärmar som startpunkt.
 * Utöka successivt med fler skärmar.
 */
export default {
  // Generella
  cancel: 'Avbryt',
  save: 'Spara',
  delete: 'Radera',
  back: 'Tillbaka',
  error: 'Fel',
  loading: 'Laddar...',
  tryAgain: 'Försök igen',
  ok: 'OK',

  // Auth
  auth: {
    login: 'Logga in',
    signup: 'Skapa konto',
    logout: 'Logga ut',
    forgotPassword: 'Glömt lösenord?',
    resetPassword: 'Återställ lösenord',
    email: 'E-post',
    password: 'Lösenord',
    confirmPassword: 'Bekräfta lösenord',
    firstName: 'Förnamn',
    lastName: 'Efternamn',
    nickname: 'Smeknamn',
    alreadyHaveAccount: 'Har du redan ett konto?',
    noAccount: 'Har du inget konto?',
    createAccount: 'Gå med nu',
    creatingAccount: 'Skapar konto...',
    invalidEmail: 'Ange en giltig e-post.',
    enterFirstName: 'Ange förnamn.',
    chooseNickname: 'Välj ett smeknamn.',
    passwordMinLength: 'Minst 8 tecken.',
    passwordComplexity: 'Måste innehålla stora och små bokstäver samt en siffra.',
    passwordsMismatch: 'Lösenorden matchar inte.',
    emailInUse: 'E-posten används redan.',
    wrongPassword: 'Fel e-post eller lösenord.',
    couldNotCreateAccount: 'Kunde inte skapa konto.',
    nicknameTaken: 'Smeknamnet är upptaget.',
    termsCheckbox: 'Jag är 13 år eller äldre och godkänner',
    privacyPolicy: 'sekretesspolicyn',
    termsOfService: 'användarvillkoren',
    mustAcceptTerms: 'Du måste godkänna villkoren för att fortsätta.',
    resetEmailSent: 'E-post skickad',
    resetEmailSentMessage: 'Kolla din inkorg för att återställa lösenordet.',
  },

  // Tabbar
  tabs: {
    home: 'Hem',
    search: 'Sök',
    notifications: 'Notiser',
    profile: 'Profil',
  },

  // Profil
  profile: {
    checkins: 'Incheckningar',
    visitedPlaygrounds: 'Besökta lekplatser',
    trophies: 'Troféer',
    friends: 'Vänner',
    editProfile: 'Redigera profil',
    myCheckins: 'Mina incheckningar',
    myVisitedPlaygrounds: 'Mina besökta lekplatser',
    admin: 'Administration',
    deleteAccount: 'Radera konto',
    deleteAccountConfirm: 'Detta raderar ditt konto och alla dina uppgifter permanent. Åtgärden kan inte ångras.',
    confirmWithPassword: 'Bekräfta med ditt lösenord:',
    deleting: 'Raderar...',
    deleteMyAccount: 'Radera mitt konto',
    exportData: 'Exportera min data',
    exporting: 'Exporterar...',
    version: 'Version',
    privacyPolicy: 'Sekretesspolicy',
    termsOfService: 'Användarvillkor',
  },

  // Incheckning
  checkin: {
    title: 'Check In',
    done: 'Klart!',
    saved: 'Din incheckning är sparad.',
    couldNotCreate: 'Kunde inte skapa incheckningen. Försök igen.',
    rating: 'Betyg',
    comment: 'Kommentar',
    photo: 'Foto',
    addPhoto: 'Lägg till foto',
    gallery: 'Galleri',
    camera: 'Kamera',
    tagFriends: 'Tagga vänner',
    timeSpent: 'Tid på lekplatsen',
    share: 'Dela incheckning',
  },

  // Lekplatser
  playground: {
    search: 'Sök lekplatser',
    details: 'Lekplats',
    addNew: 'Lägg till Lekplats',
    distance: 'Avstånd',
    rating: 'Betyg',
    noResults: 'Inga lekplatser hittades.',
    sponsor: 'Sponsor',
    share: 'Dela lekplats',
    suggest: 'Skicka förslag',
    favorite: 'Favorit',
  },

  // Onboarding
  onboarding: {
    findPlaygrounds: 'Hitta lekplatser',
    findPlaygroundsDesc: 'Upptäck lekplatser nära dig med hjälp av kartan. Filtrera på avstånd, betyg och utrustning.',
    checkIn: 'Checka in',
    checkInDesc: 'Checka in på lekplatser du besöker. Ta bilder, skriv omdömen och dela dina upplevelser.',
    social: 'Socialt',
    socialDesc: 'Följ vänner, se deras incheckningar och upptäck nya lekplatser genom deras äventyr.',
    collectTrophies: 'Samla troféer',
    collectTrophiesDesc: 'Lås upp troféer genom att besöka fler lekplatser och slutföra utmaningar!',
    skip: 'Hoppa över',
    next: 'Nästa',
    getStarted: 'Kom igång!',
  },

  // Felmeddelanden
  errors: {
    network: 'Ingen internetanslutning',
    generic: 'Något gick fel',
    genericMessage: 'Ett oväntat fel uppstod. Försök igen eller starta om appen.',
    permissionDenied: 'Åtkomst nekad',
    photoPermission: 'Du måste ge appen tillåtelse att komma åt dina foton.',
    cameraPermission: 'Du måste ge appen tillåtelse att använda kameran.',
    locationPermission: 'Platstillstånd nekades',
  },
};
