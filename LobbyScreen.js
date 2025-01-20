import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { collection, addDoc, doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { getRandomInfluence } from './utils/gameUtils'; // Importing the utility function

const LobbyScreen = ({ route, navigation }) => {
  const { roomCode, playerName, isHost } = route.params;
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    // Listen to real-time updates for the players in this room
    const roomRef = collection(db, 'rooms', roomCode, 'players');
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      const updatedPlayers = snapshot.docs.map((doc) => doc.data());
      setPlayers(updatedPlayers);
    });

    // Add the current player to the room
    const addPlayer = async () => {
      try {
        await addDoc(roomRef, { name: playerName });
      } catch (error) {
        console.error('Error adding player:', error);
      }
    };
    addPlayer();

    return () => unsubscribe();
  }, []);

  const startGame = async () => {
    try {
      const roomRef = doc(db, 'rooms', roomCode); // Reference to the room document

      // Fetch the room document to check if it exists
      const roomDoc = await getDoc(roomRef);

      if (!roomDoc.exists()) {
        // If room doesn't exist, create it
        const initialPlayers = players.map((player) => ({
          name: player.name,
          influence: getRandomInfluence(), // Assign random influence to each player
          coins: 2, // Starting coins for each player
        }));

        await setDoc(roomRef, {
          players: initialPlayers, // Set the players with their influence and coins
          currentTurn: players[0].name, // First player starts
          lastAction: null,
          gameStarted: true,
        });
      } else {
        // If room exists, just update it to indicate the game started
        await updateDoc(roomRef, { gameStarted: true });
      }

      // Navigate to the game screen
      navigation.navigate('Game', { roomCode, playerName: players[0].name });
    } catch (error) {
      console.error('Error starting game:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Room Code: {roomCode}</Text>
      <Text style={styles.subtitle}>Players in the room:</Text>
      <FlatList
        data={players}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <Text style={styles.playerName}>{item.name}</Text>
        )}
      />
      {isHost && (
        <TouchableOpacity style={styles.button} onPress={startGame}>
          <Text style={styles.buttonText}>Start Game</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Roboto_700Bold',
    color: '#333',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: 'Roboto_400Regular',
    color: '#666',
    marginBottom: 10,
  },
  playerName: {
    fontSize: 16,
    fontFamily: 'Roboto_400Regular',
    color: '#333',
    padding: 5,
  },
  button: {
    width: '80%',
    padding: 15,
    marginVertical: 20,
    backgroundColor: '#333',
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 16,
    color: '#fff',
  },
});

export default LobbyScreen;
