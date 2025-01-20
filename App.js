import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts, Roboto_400Regular, Roboto_700Bold } from '@expo-google-fonts/roboto';
import { getAuth, signInAnonymously } from 'firebase/auth'; // Import Firebase Auth
import HomeScreen from './HomeScreen';
import LobbyScreen from './LobbyScreen';
import GameScreen from './GameScreen';

const Stack = createNativeStackNavigator();

const App = () => {
  // Load fonts using useFonts hook
  let [fontsLoaded] = useFonts({
    Roboto_400Regular,
    Roboto_700Bold,
  });

  // Authenticate user on app start
  useEffect(() => {
    const auth = getAuth();
    signInAnonymously(auth)
      .then(() => {
        console.log('Signed in anonymously');
      })
      .catch((error) => {
        console.error('Error signing in anonymously:', error);
      });
  }, []); // Empty dependency array ensures this runs only once when the component mounts

  // Show a loading indicator while fonts are being loaded
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Lobby" component={LobbyScreen} />
        <Stack.Screen name="Game" component={GameScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
