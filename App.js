
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
// permissions for notifications are handled by expo-notifications itself
import { doc, setDoc } from 'firebase/firestore';

// Tema
import { ThemeProvider, useTheme } from './src/theme';

// Konfigurera hur notifieringar visas när appen är i förgrunden
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Skärmar
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import SearchScreen from './screens/SearchScreen'; 
import TrophyScreen from './screens/TrophyScreen';
import FriendsScreen from './screens/FriendsScreen';
import CommentsScreen from './screens/CommentsScreen';
import PlaygroundDetailsScreen from './screens/PlaygroundDetailsScreen';
import AddPlaygroundScreen from './screens/AddPlaygroundScreen';
import ReviewDraftsScreen from './screens/ReviewDraftsScreen';
import CheckInScreen from './screens/CheckInScreen';
import SignupScreen from './screens/SignupScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import PublicProfileScreen from './screens/PublicProfileScreen';



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
      {/* Hem */}
      <Tab.Screen
        name="Hem"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={30}
              color={focused ? theme.colors.primary : theme.colors.textMuted}
            />
          ),
        }}
      />

      {/* Sök */}
      <Tab.Screen
        name="Sök"
        component={SearchScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'search' : 'search-outline'}
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
// navigation ref used for navigating from outside components (e.g. notification handlers)
const navigationRef = React.createRef();

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

  return <NavigationContainer ref={navigationRef} theme={navTheme}>{children}</NavigationContainer>;
}

/** Huvud-App */
export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const registerForPushNotificationsAsync = async (uid) => {
      try {
        // Be om tillstånd för push-notifieringar
        let { status: existingStatus } = await Notifications.getPermissionsAsync();
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          existingStatus = status;
        }
        if (existingStatus !== 'granted') {
          console.log('Push-notifieringstillstånd nekades');
          return;
        }

        // Hämta Expo push token
        const token = (await Notifications.getExpoPushTokenAsync({
          projectId: 'ea779f71-c184-4011-b809-4514ebcda658',
        })).data;
        console.log('Expo Push Token:', token);

        // Spara token i Firestore
        if (uid && token) {
          const userRef = doc(db, 'users', uid);
          await setDoc(userRef, { expoPushToken: token }, { merge: true });
          console.log('Push token sparad i Firestore');
        }

        // Konfigurera för Android
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#4CAF50',
          });
        }
      } catch (e) {
        console.warn('Kunde inte registrera push-token:', e);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) registerForPushNotificationsAsync(u.uid);
      if (initializing) setInitializing(false);
    });

    const receivedSub = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notis mottagen i förgrunden', notification);
      // Notifikationen visas automatiskt tack vare setNotificationHandler ovan
    });
    
    const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Användaren öppnade notis', response);
      const data = response.notification.request.content.data;
      
      // Hantera olika typer av notifikationer
      if (data?.type === 'like' || data?.type === 'comment') {
        if (data.checkinId) {
          navigationRef.current?.navigate('Comments', { 
            checkInId: data.checkinId,
            checkInComment: '' 
          });
        }
      } else if (data?.type === 'TROPHY') {
        navigationRef.current?.navigate('Trophies');
      } else if (data?.type === 'COMMENT' || data?.type === 'MENTION') {
        // Hantera länkar från updateCommentCount-funktionen
        const link = data.link || '';
        const checkinMatch = link.match(/\/incheckning\/(.+)/);
        if (checkinMatch) {
          navigationRef.current?.navigate('Comments', { 
            checkInId: checkinMatch[1],
            checkInComment: '' 
          });
        }
      }
    });

    return () => {
      unsubscribe();
      receivedSub.remove();
      responseSub.remove();
    };
  }, [initializing]);

  if (initializing) {
    return null; // eller en Splash-komponent
  }

  return (
    <ThemeProvider>
      <ThemedNavigationContainer>
        <Stack.Navigator>
          {user ? (
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
                name="ReviewDrafts"
                component={ReviewDraftsScreen}
                options={{ title: 'Granska Utkast' }}
              />
              <Stack.Screen
                name="PlaygroundDetails"
                component={PlaygroundDetailsScreen}
                options={{ title: 'Lekplats' }}
              />
              <Stack.Screen
                name="Comments"
                component={CommentsScreen}
                options={{ title: 'Kommentarer' }}
              />
            </>
          ) : (
            // Utloggad: bara login
            <>
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
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
});
