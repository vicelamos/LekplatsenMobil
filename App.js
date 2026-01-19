import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase'; 
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, TouchableOpacity } from 'react-native';

// Importera alla dina skärmar
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import SearchScreen from './screens/SearchScreen';
import TrophyScreen from './screens/TrophyScreen';
import FriendsScreen from './screens/FriendsScreen';
import CommentsScreen from './screens/CommentsScreen'; 
// --- NYA SKÄRMAR FÖR SÖK-FUNKTIONEN ---
import AddPlaygroundScreen from './screens/AddPlaygroundScreen';
import ReviewDraftsScreen from './screens/ReviewDraftsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// (Denna del är oförändrad)
const CustomTabBarButton = ({ children, onPress }) => (
  <TouchableOpacity
    style={{
      top: -30, 
      justifyContent: 'center',
      alignItems: 'center',
      ...styles.shadow 
    }}
    onPress={onPress}
  >
    <View style={{
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: '#6200ea'
    }}>
      {children}
    </View>
  </TouchableOpacity>
);

// (Denna del är oförändrad)
function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarShowLabel: false,
        tabBarStyle: { 
          position: 'absolute',
          bottom: 25,
          left: 20,
          right: 20,
          elevation: 0,
          backgroundColor: '#ffffff',
          borderRadius: 15,
          height: 90,
          ...styles.shadow
        }
      }}
    >
      <Tab.Screen 
        name="Hem" 
        component={HomeScreen} 
        options={{
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={focused ? "home" : "home-outline"} size={30} color={focused ? '#6200ea' : '#748c94'} />
            </View>
          ),
        }} 
      />
      <Tab.Screen 
        name="Sök" 
        component={SearchScreen}
        options={{
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <Ionicons name="search" size={30} color="#ffffff" />
          ),
          tabBarButton: (props) => (
            <CustomTabBarButton {...props} />
          )
        }}
      />
      <Tab.Screen 
        name="Profil" 
        component={ProfileScreen} 
        options={{
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={focused ? "person" : "person-outline"} size={30} color={focused ? '#6200ea' : '#748c94'} />
            </View>
          ),
        }} 
      />
    </Tab.Navigator>
  );
}

// Huvud-App (UPPDATERAD med AddPlayground och ReviewDrafts)
export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (initializing) {
        setInitializing(false);
      }
    });
    return unsubscribe;
  }, []);

  if (initializing) {
    return null; 
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          // Om INLOGGAD, visa alla app-skärmar
          <>
            <Stack.Screen 
              name="AppTabs" 
              component={AppTabs} 
              options={{ headerShown: false }} // Göm huvud-rubriken
            />
            {/* Skärmar som visas OVANPÅ flikarna */}
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
              name="Comments" 
              component={CommentsScreen}
              options={{ title: 'Kommentarer' }}
            />
            
            {/* --- NYA SKÄRMAR TILLAGDA HÄR --- */}
            <Stack.Screen 
              name="AddPlayground" 
              component={AddPlaygroundScreen} 
              options={{ title: 'Lägg till Lekplats' }} 
            />
            <Stack.Screen 
              name="ReviewDrafts" 
              component={ReviewDraftsScreen} 
              options={{ title: 'Granska Utkast' }} 
            />
          </>
        ) : (
          // Om UTLOGGAD, visa bara LoginScreen
          <Stack.Screen 
            name="Login" 
            component={LoginScreen} 
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// (Denna del är oförändrad)
const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#7F5DF0',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.5,
    elevation: 5
  }
});