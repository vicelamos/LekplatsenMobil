
import * as Sentry from '@sentry/react-native';
import React, { useState, useEffect } from 'react';
import { StyleSheet } from 'react-native';

import Constants from 'expo-constants';

Sentry.init({
  dsn: Constants.expoConfig?.extra?.sentryDsn || '',
  enabled: !__DEV__,
  sendDefaultPii: true,
  tracesSampleRate: 0.2,
});
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Tema
import { ThemeProvider, useTheme } from './src/theme';
import { usePushNotifications, registerPushToken } from './src/hooks/usePushNotifications';
import ErrorBoundary from './src/components/ErrorBoundary';
import { OfflineBanner } from './src/components/OfflineBanner';
import { LoginPromptProvider } from './src/contexts/LoginPrompt';
import { DialogProvider } from './src/contexts/Dialog';
import LoginRequiredModal from './src/components/LoginRequiredModal';
import { navigationRef } from './navigationRef';

// Skärmar
import LoginScreen from './screens/auth/LoginScreen';
import SignupScreen from './screens/auth/SignupScreen';
import ForgotPasswordScreen from './screens/auth/ForgotPasswordScreen';
import HomeScreen from './screens/social/HomeScreen';
import CheckInScreen from './screens/social/CheckInScreen';
import EditCheckInScreen from './screens/social/EditCheckInScreen';
import CommentsScreen from './screens/social/CommentsScreen';
import FriendsScreen from './screens/social/FriendsScreen';
import NotificationsScreen from './screens/social/NotificationsScreen';
import SearchScreen from './screens/playground/SearchScreen';
import PlaygroundDetailsScreen from './screens/playground/PlaygroundDetailsScreen';
import AddPlaygroundScreen from './screens/playground/AddPlaygroundScreen';
import ReviewDraftsScreen from './screens/playground/ReviewDraftsScreen';
import ProfileScreen from './screens/profile/ProfileScreen';
import EditProfileScreen from './screens/profile/EditProfileScreen';
import PublicProfileScreen from './screens/profile/PublicProfileScreen';
import MyCheckinsScreen from './screens/profile/MyCheckinsScreen';
import MyVisitedPlaygroundsScreen from './screens/profile/MyVisitedPlaygroundsScreen';
import TrophyScreen from './screens/profile/TrophyScreen';
import ManageSponsorsScreen from './screens/admin/ManageSponsorsScreen';
import AdminScreen from './screens/admin/AdminScreen';
import ManageNewsScreen from './screens/admin/ManageNewsScreen';
import ManageReportsScreen from './screens/admin/ManageReportsScreen';
import OnboardingScreen, { hasCompletedOnboarding } from './screens/onboarding/OnboardingScreen';



const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();


// Vi använder vanliga tabbar nu, ingen FAB-komponent behövs

/** Dina tabs – med FAB i mitten som öppnar CheckInScreen */

function AppTabs({ navigation }) {
  const { theme } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);

  const uid = auth.currentUser?.uid;
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'users', uid, 'notifications'),
      where('read', '==', false)
    );
    const unsub = onSnapshot(q, (snap) => {
      setUnreadCount(snap.size);
    });
    return unsub;
  }, [uid]);


  return (
    <Tab.Navigator
      // Kartan är startläget. Appens huvudhandling är att hitta och betygsätta
      // en lekplats man står vid — vännernas flöde är sekundärt.
      initialRouteName="Sök"
      screenOptions={{
        tabBarShowLabel: false,
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 25,
          left: 20,
          right: 20,
          elevation: 0,
          backgroundColor: theme.colors.cardBg,
          borderRadius: 15,
          height: 90,
          borderTopWidth: 0,
          ...styles.shadow,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        sceneStyle: {
          backgroundColor: theme.colors.bg,
          paddingBottom: 120, // give room for floating tab bar + extra gap
        },
      }}
    >
      {/* Sök – startskärmen */}
      <Tab.Screen
        name="Sök"
        component={SearchScreen}
        options={{
          tabBarAccessibilityLabel: 'Sök lekplatser',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'map' : 'map-outline'}
              size={30}
              color={focused ? theme.colors.primary : theme.colors.textMuted}
            />
          ),
        }}
      />

      {/* Hem */}
      <Tab.Screen
        name="Hem"
        component={HomeScreen}
        options={{
          tabBarAccessibilityLabel: 'Hem',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={30}
              color={focused ? theme.colors.primary : theme.colors.textMuted}
            />
          ),
        }}
      />

      {/* Notiser */}
      <Tab.Screen
        name="Notiser"
        component={NotificationsScreen}
        options={{
          tabBarAccessibilityLabel: unreadCount > 0 ? `Notiser, ${unreadCount} olästa` : 'Notiser',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'notifications' : 'notifications-outline'}
              size={30}
              color={focused ? theme.colors.primary : theme.colors.textMuted}
            />
          ),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />

      {/* Profil utan badge */}
      <Tab.Screen
        name="Profil"
        component={ProfileScreen}
        options={{
          tabBarAccessibilityLabel: 'Min profil',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={30}
              color={focused ? theme.colors.primary : theme.colors.textMuted}
            />
          ),
        }}
      />

    </Tab.Navigator>
  );
}


/** NavigationContainer med temats färger (för header/card) */
function ThemedNavigationContainer({ children }) {
  const { theme, mode } = useTheme();

  const navTheme = mode === 'dark'
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: theme.colors.bg,
          card: theme.colors.cardBg,
          text: theme.colors.text,
          border: theme.colors.border,
          primary: theme.colors.primary,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: theme.colors.bg,
          card: theme.colors.cardBg,
          text: theme.colors.text,
          border: theme.colors.border,
          primary: theme.colors.primary,
        },
      };

  const linking = {
    prefixes: ['lekplatsen://'],
    config: {
      screens: {
        AppTabs: {
          screens: {
            Hem: 'home',
            'Sök': 'search',
            Notiser: 'notifications',
            Profil: 'profile',
          },
        },
        GuestTabs: {
          screens: {
            'Sök': 'search',
          },
        },
        PlaygroundDetails: 'playground/:lekplatsId',
        Comments: 'checkin/:checkInId',
        PublicProfile: 'user/:userId',
        Trophies: 'trophies',
      },
    },
  };

  return <NavigationContainer ref={navigationRef} theme={navTheme} linking={linking}>{children}</NavigationContainer>;
}

/** Gäst-tabbar – sök + "logga in"-flik för utloggade användare */
function GuestTabs() {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarShowLabel: false,
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 25,
          left: 20,
          right: 20,
          elevation: 0,
          backgroundColor: theme.colors.cardBg,
          borderRadius: 15,
          height: 90,
          borderTopWidth: 0,
          ...styles.shadow,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        sceneStyle: {
          backgroundColor: theme.colors.bg,
          paddingBottom: 120,
        },
      }}
    >
      {/* Sök – startsidan för gäster */}
      <Tab.Screen
        name="Sök"
        component={SearchScreen}
        options={{
          tabBarAccessibilityLabel: 'Sök lekplatser',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'search' : 'search-outline'}
              size={30}
              color={focused ? theme.colors.primary : theme.colors.textMuted}
            />
          ),
        }}
      />

      {/* Logga in-flik */}
      <Tab.Screen
        name="LoggaIn"
        component={LoginScreen}
        options={{
          tabBarAccessibilityLabel: 'Logga in',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'log-in' : 'log-in-outline'}
              size={30}
              color={focused ? theme.colors.primary : theme.colors.textMuted}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

/** Huvud-App */
function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  usePushNotifications(navigationRef);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      // Anonyma användare (gäst-incheckning) behandlas som gäster
      if (u && !u.isAnonymous) {
        registerPushToken(u.uid);
        const done = await hasCompletedOnboarding();
        setShowOnboarding(!done);

        // Hantera returnTo efter inloggning
        try {
          const returnToJson = await AsyncStorage.getItem('@lekplatsen_return_to');
          if (returnToJson) {
            await AsyncStorage.removeItem('@lekplatsen_return_to');
            const { screen, params } = JSON.parse(returnToJson);
            // Kort fördröjning för att navigationsträdet ska hinna mountas
            setTimeout(() => {
              navigationRef.current?.navigate(screen, params);
            }, 100);
          }
        } catch (e) {
          console.warn('Kunde inte hantera returnTo:', e);
        }
      } else {
        // Visa onboarding även för gäster första gången
        const done = await hasCompletedOnboarding();
        setShowOnboarding(!done);
      }
      if (initializing) setInitializing(false);
    });

    return unsubscribe;
  }, [initializing]);

  if (initializing) {
    return null;
  }

  // Onboarding visas för alla nya användare (gäst eller inloggad)
  if (showOnboarding) {
    return (
      <ThemeProvider>
        <OnboardingScreen onComplete={() => setShowOnboarding(false)} />
      </ThemeProvider>
    );
  }

  return (
    <ErrorBoundary>
    <ThemeProvider>
      <DialogProvider>
      <LoginPromptProvider>
      <OfflineBanner />
      <ThemedNavigationContainer>
        <Stack.Navigator>
          {user && !user.isAnonymous ? (
            <>
              {/* Flik-navigatorn */}
              <Stack.Screen
                name="AppTabs"
                component={AppTabs}
                options={{ headerShown: false }}
              />

              {/* Skärmar som ligger ovanpå tabbarna */}
              <Stack.Screen
                name="Trophies"
                component={TrophyScreen}
                options={{ title: 'Mina Troféer' }}
              />
              <Stack.Screen
                name="Friends"
                component={FriendsScreen}
                options={{ title: 'Mina Vänner' }}
              />
              <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ title: 'Notiser' }}
               />

              <Stack.Screen
                name="PublicProfile"
                component={PublicProfileScreen}
                options={{ title: 'Profil' }}
              />
              <Stack.Screen
                name="EditProfile"
                component={EditProfileScreen}
                options={{ title: 'Redigera profil' }}
              />
              <Stack.Screen
                name="MyCheckins"
                component={MyCheckinsScreen}
                options={{ title: 'Mina incheckningar' }}
              />
              <Stack.Screen
                name="MyVisitedPlaygrounds"
                component={MyVisitedPlaygroundsScreen}
                options={{ title: 'Besökta lekplatser' }}
              />
              <Stack.Screen
                name="ManageSponsors"
                component={ManageSponsorsScreen}
                options={{ title: 'Sponsorer' }}
              />
              <Stack.Screen
                name="ManageNews"
                component={ManageNewsScreen}
                options={{ title: 'Nyheter' }}
              />
              <Stack.Screen
                name="ManageReports"
                component={ManageReportsScreen}
                options={{ title: 'Rapporter' }}
              />
              <Stack.Screen
                name="Admin"
                component={AdminScreen}
                options={{ title: 'Administration' }}
              />
              <Stack.Screen
                name="AddPlayground"
                component={AddPlaygroundScreen}
                options={{ title: 'Lägg till Lekplats' }}
              />
              <Stack.Screen
               name="CheckIn"
               component={CheckInScreen}
               options={{ title: 'Check In' }}
               />
              <Stack.Screen
                name="EditCheckin"
                component={EditCheckInScreen}
                options={{ title: 'Redigera incheckning' }}
              />
              <Stack.Screen
                name="ReviewDrafts"
                component={ReviewDraftsScreen}
                options={{ title: 'Granska Utkast' }}
              />
              <Stack.Screen
                name="PlaygroundDetails"
                component={PlaygroundDetailsScreen}
                options={{ title: 'Lekplats', headerBackTitle: '' }}
              />
              <Stack.Screen
                name="Comments"
                component={CommentsScreen}
                options={{ title: 'Kommentarer' }}
              />
            </>
          ) : (
            <>
              {/* Gäst-tabbar: sök + logga in */}
              <Stack.Screen
                name="GuestTabs"
                component={GuestTabs}
                options={{ headerShown: false }}
              />

              {/* Lekplatsdetaljer tillgängliga för gäster */}
              <Stack.Screen
                name="PlaygroundDetails"
                component={PlaygroundDetailsScreen}
                options={{ title: 'Lekplats', headerBackTitle: '' }}
              />

              {/* Gäst-incheckning (anonym Firebase-auth) */}
              <Stack.Screen
                name="CheckIn"
                component={CheckInScreen}
                options={{ title: 'Checka in som gäst' }}
              />

              {/* Auth-skärmar */}
              <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Signup"
                component={SignupScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="ForgotPassword"
                component={ForgotPasswordScreen}
                options={{ title: 'Återställ lösenord', headerShown: true }}
              />
            </>
          )}
        </Stack.Navigator>
      </ThemedNavigationContainer>
      <LoginRequiredModal />
      </LoginPromptProvider>
      </DialogProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}

export default Sentry.wrap(App);

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
});
