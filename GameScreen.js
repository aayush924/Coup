import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { db } from './firebase';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';

const GameScreen = ({ route }) => {
  const { roomCode, playerName } = route.params;
  const [gameState, setGameState] = useState(null);
  const [playerActions, setPlayerActions] = useState([]);

  useEffect(() => {
    const roomRef = doc(db, 'rooms', roomCode);

    // Listen for game state changes
    const unsubscribe = onSnapshot(roomRef, (doc) => {
      if (doc.exists()) {
        setGameState(doc.data());
      }
    });

    return () => unsubscribe();
  }, []);

  const performAction = async (action) => {
    try {
      const roomRef = doc(db, 'rooms', roomCode);
      const currentState = (await getDoc(roomRef)).data();

      // Logic to perform the action (e.g., Income, Coup, etc.)
      // Placeholder: Update the game state with the action
      await updateDoc(roomRef, {
        lastAction: `${playerName} performed ${action}`,
      });
    } catch (error) {
      console.error('Error performing action:', error);
    }
  };

  if (!gameState) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Loading game...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Room Code: {roomCode}</Text>
      <Text style={styles.subtitle}>Current Turn: {gameState.currentTurn}</Text>
      <Text style={styles.subtitle}>Last Action: {gameState.lastAction || 'None'}</Text>

      <FlatList
        data={gameState.players}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => (
          <View style={styles.playerInfo}>
            <Text style={styles.playerName}>
              {item.name} - Influence: {item.influence} - Coins: {item.coins}
            </Text>
          </View>
        )}
      />

      <View style={styles.actionsContainer}>
        {['Income', 'Foreign Aid', 'Coup'].map((action) => (
          <TouchableOpacity
            key={action}
            style={styles.button}
            onPress={() => performAction(action)}
          >
            <Text style={styles.buttonText}>{action}</Text>
          </TouchableOpacity>
        ))}
      </View>
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
  playerInfo: {
    marginVertical: 5,
  },
  playerName: {
    fontSize: 16,
    fontFamily: 'Roboto_400Regular',
    color: '#333',
  },
  actionsContainer: {
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
  },
  button: {
    width: '80%',
    padding: 15,
    marginVertical: 10,
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

export default GameScreen;
