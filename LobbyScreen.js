// LobbyScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import {
  collection,
  addDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { getRandomInfluence } from './utils/gameUtils';

const LobbyScreen = ({ route, navigation }) => {
  const { roomCode, playerName, isHost } = route.params;
  const [players, setPlayers] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    const roomRef = doc(db, 'rooms', roomCode);
    
    // Listen for players joining (from the subcollection)
    const playersRef = collection(db, 'rooms', roomCode, 'players');
    const unsubscribePlayers = onSnapshot(playersRef, (snapshot) => {
      const updatedPlayers = snapshot.docs.map((doc) => doc.data());
      setPlayers(updatedPlayers);
    });
    
    // Listen for gameStarted state changes in the room document
    const unsubscribeGame = onSnapshot(roomRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        setGameStarted(data.gameStarted);
        if (data.gameStarted) {
          navigation.navigate('Game', { roomCode, playerName });
        }
      }
    });

    // Add the current player to the players subcollection.
    // (You might wish to add logic so that a player isn’t added twice.)
    const addPlayer = async () => {
      try {
        await addDoc(playersRef, { name: playerName });
      } catch (error) {
        console.error('Error adding player:', error);
      }
    };
    addPlayer();

    return () => {
      unsubscribePlayers();
      unsubscribeGame();
    };
  }, []);

  // When the host starts the game, fetch all players from the subcollection,
  // assign each one starting influence and coins, and write them into the room doc.
  const startGame = async () => {
    try {
      const roomRef = doc(db, 'rooms', roomCode);
      const playersRef = collection(db, 'rooms', roomCode, 'players');
      // Get all players from the players subcollection.
      const playersSnapshot = await getDocs(playersRef);
      const playersList = playersSnapshot.docs.map((doc) => doc.data());
      // For every player, assign starting influence and coins.
      const initialPlayers = playersList.map((player) => ({
        name: player.name,
        influence: getRandomInfluence(), // e.g. returns 2 random cards
        coins: 2,
        revealed: [],
      }));
      // Create (or override) the room document with complete player data.
      await setDoc(roomRef, {
        players: initialPlayers,
        currentTurn: initialPlayers[0].name,
        lastAction: null,
        gameStarted: true,
      });
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
        <TouchableOpacity
          style={styles.button}
          onPress={startGame}
          disabled={gameStarted}
        >
          <Text style={styles.buttonText}>
            {gameStarted ? 'Game Started' : 'Start Game'}
          </Text>
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
