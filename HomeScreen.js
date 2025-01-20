// HomeScreen.js
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

const HomeScreen = ({ navigation }) => {
  const [roomCode, setRoomCode] = React.useState('');
  const [playerName, setPlayerName] = React.useState('');

  const createGame = () => {
    if (!playerName) return alert('Please enter your name');
    navigation.navigate('Lobby', { roomCode: generateRoomCode(), playerName, isHost: true });
  };

  const joinGame = () => {
    if (!roomCode || !playerName) return alert('Please enter all details');
    navigation.navigate('Lobby', { roomCode, playerName, isHost: false });
  };

  const generateRoomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Coup</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your name"
        placeholderTextColor="#666"
        value={playerName}
        onChangeText={setPlayerName}
      />
      <TextInput
        style={styles.input}
        placeholder="Room Code (if joining)"
        placeholderTextColor="#666"
        value={roomCode}
        onChangeText={setRoomCode}
      />
      <TouchableOpacity style={styles.button} onPress={createGame}>
        <Text style={styles.buttonText}>Create Game</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={joinGame}>
        <Text style={styles.buttonText}>Join Game</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5', // Light monochrome background
  },
  title: {
    fontSize: 48,
    fontFamily: 'Roboto_700Bold',
    color: '#333', // Dark monochrome color for text
    marginBottom: 40,
  },
  input: {
    width: '80%',
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    fontFamily: 'Roboto_400Regular',
    fontSize: 16,
    color: '#333',
  },
  button: {
    width: '80%',
    padding: 15,
    marginVertical: 10,
    backgroundColor: '#333', // Dark monochrome color
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 16,
    color: '#fff', // White text for contrast
  },
});

export default HomeScreen;
