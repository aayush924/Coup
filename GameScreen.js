// GameScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  Modal,
} from 'react-native';
import { doc, updateDoc, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from './firebase';
// import { getRandomInfluence, getRandomCard } from './utils/gameUtils';

// Helper for Exchange: returns two random cards from the remaining deck.
const getExchangeExtraCards = () => {
  // Using 4 of each card type for a 20-card deck
  const cardTypes = ['Duke', 'Assassin', 'Captain', 'Contessa', 'Ambassador'];
  
  // Calculate what should remain in the deck
  // We'd need to track the actual deck, but this is a simplification
  const extra = [];
  for (let i = 0; i < 2; i++) {
    const randomIndex = Math.floor(Math.random() * cardTypes.length);
    extra.push(cardTypes[randomIndex]);
  }
  return extra;
};

const GameScreen = ({ route, navigation }) => {
  const { roomCode, playerName } = route.params;
  const [gameData, setGameData] = useState(null);
  const [influenceSelection, setInfluenceSelection] = useState(null);
  const [exchangeSelection, setExchangeSelection] = useState(null);

  useEffect(() => {
    const roomRef = doc(db, 'rooms', roomCode);
    const unsubscribe = onSnapshot(roomRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        setGameData(data);
        console.log('Game data updated:', data);
      }
    });
    return () => unsubscribe();
  }, [roomCode]);

  // Automatically prompt the player to lose an influence when needed
  useEffect(() => {
    if (!gameData || !gameData.pendingAction || influenceSelection) return;
    
    // CASE 1: Target of coup or assassination needs to lose influence
    if ((gameData.pendingAction.type === 'coup' || 
         gameData.pendingAction.type === 'assassinate' || 
         gameData.pendingAction.type === 'assassination_target') && 
        gameData.pendingAction.target === playerName) {
      const targetPlayer = gameData.players.find((p) => p.name === playerName);
      if (targetPlayer && targetPlayer.influence.length > 0) {
        promptInfluenceLoss(playerName, targetPlayer.influence, (lostCard) => {
          // First update player's cards locally
          const updatedPlayer = {
            ...targetPlayer,
            influence: targetPlayer.influence.filter(card => card !== lostCard),
            revealed: [...(targetPlayer.revealed || []), lostCard]
          };
          
          // Store the action type before any state updates
          const actionType = gameData.pendingAction.type;
          
          // Get fresh state
          let freshState = { ...gameData };
          
          // Make sure we're still in the same game state
          if (freshState.pendingAction && 
              (freshState.pendingAction.type === 'coup' || 
               freshState.pendingAction.type === 'assassinate' || 
               freshState.pendingAction.type === 'assassination_target') && 
              freshState.pendingAction.target === playerName) {
              
            // Update the player in the state
            const playerIndex = freshState.players.findIndex(p => p.name === playerName);
            if (playerIndex !== -1) {
              freshState.players[playerIndex] = updatedPlayer;
            }
            
            // Clear pending action and update message
            freshState.pendingAction = null;
            
            // Set appropriate message
            let message = '';
            if (actionType === 'coup') {
              message = `${playerName} lost ${lostCard} due to a Coup.`;
            } else if (actionType === 'assassinate' || actionType === 'assassination_target') {
              message = `${playerName} lost ${lostCard} due to Assassination.`;
            }
            
            if (message) {
              freshState.lastAction.message = message;
            }
            
            // Move to next turn and update game state
            freshState = moveToNextTurn(freshState);
            updateGameState(freshState);
            // Check game end condition
            checkGameEnd(freshState);
          } else {
            console.log('Game state changed, not updating');
          }
          
          // Always clear the selection
          setInfluenceSelection(null);
        });
      }
    }
    
    // CASE 2: Actor who failed a bluff needs to lose influence
    else if (gameData.pendingAction.type === 'bluff_loss' && 
             gameData.pendingAction.actor === playerName) {
      const player = gameData.players.find(p => p.name === playerName);
      if (player && player.influence.length > 0) {
        promptInfluenceLoss(playerName, player.influence, (lostCard) => {
          // First make sure we clear the influence selection to hide the modal
          setInfluenceSelection(null);
          
          // Update player's cards locally
          const updatedPlayer = {
            ...player,
            influence: player.influence.filter(card => card !== lostCard),
            revealed: [...(player.revealed || []), lostCard]
          };
          
          // Get the original action before any state updates
          const originalAction = gameData.pendingAction.originalAction;
          
          // Get fresh state
          let freshState = { ...gameData };
          
          // Safety check - only proceed if the bluff_loss is still pending
          if (freshState.pendingAction && freshState.pendingAction.type === 'bluff_loss') {
            // Update the player in the state
            const playerIndex = freshState.players.findIndex(p => p.name === playerName);
            if (playerIndex !== -1) {
              freshState.players[playerIndex] = updatedPlayer;
            }
            
            // Clear pending action
            freshState.pendingAction = null;
            
            // If this was an assassination, refund the coins
            if (originalAction === 'assassinate' && playerIndex !== -1) {
              freshState.players[playerIndex].coins += 3; // Refund the cost
              freshState.lastAction.message += ` ${playerName} gets 3 coins back.`;
            }
            
            // Move to next turn and update game state
            freshState = moveToNextTurn(freshState);
            updateGameState(freshState);
          }
        });
      }
    }
    
    // CASE 3: Blocker who failed a block needs to lose influence
    else if (gameData.pendingAction.type === 'failed_block' && 
             gameData.pendingAction.target === playerName) {
      const player = gameData.players.find(p => p.name === playerName);
      if (player && player.influence.length > 0) {
        promptInfluenceLoss(playerName, player.influence, (lostCard) => {
          // First update player's cards locally
          const updatedPlayer = {
            ...player,
            influence: player.influence.filter(card => card !== lostCard),
            revealed: [...(player.revealed || []), lostCard]
          };
          
          // Get information before any state updates
          const blockerName = gameData.pendingAction.blocker;
          const originalAction = gameData.pendingAction.originalAction;
          const secondLoss = gameData.pendingAction.secondLoss;
          const actorName = gameData.pendingAction.actor;
          
          // Get fresh state
          let freshState = { ...gameData };
          
          // Update the player in the state
          const playerIndex = freshState.players.findIndex(p => p.name === playerName);
          if (playerIndex !== -1) {
            freshState.players[playerIndex] = updatedPlayer;
          }
          
          freshState.lastAction.message += ` ${playerName} lost ${lostCard}.`;
          
          // If this was an assassination and needs a second loss (assassination itself)
          if (secondLoss && player.influence.length > 0) {
            // Set up for the second loss (due to assassination)
            freshState.pendingAction = {
              type: 'assassination_target',
              actor: actorName,
              target: playerName,
              secondLoss: true,
              timestamp: Date.now()
            };
            
            freshState.lastAction.message += ` ${playerName} must now lose another influence due to the assassination.`;
          } else {
            // Otherwise, just clear the pending action and move to next turn
            freshState.pendingAction = null;
            freshState = moveToNextTurn(freshState);
          }
          
          // Update game state
          updateGameState(freshState);
          setInfluenceSelection(null);
        });
      }
    }
    // CASE 4: Challenger who was wrong needs to lose influence
    else if (gameData.pendingAction.type === 'challenger_loss' && 
             gameData.pendingAction.challenger === playerName) {
      const player = gameData.players.find(p => p.name === playerName);
      if (player && player.influence.length > 0) {
        promptInfluenceLoss(playerName, player.influence, (lostCard) => {
          // First update player's cards locally
          const updatedPlayer = {
            ...player,
            influence: player.influence.filter(card => card !== lostCard),
            revealed: [...(player.revealed || []), lostCard]
          };
          
          // Get information before any state updates
          const originalAction = gameData.pendingAction.originalAction;
          const actor = gameData.pendingAction.actor;
          
          // Get fresh state
          let freshState = { ...gameData };
          
          // Update the player in the state
          const playerIndex = freshState.players.findIndex(p => p.name === playerName);
          if (playerIndex !== -1) {
            freshState.players[playerIndex] = updatedPlayer;
          }
          
          // Clear pending action
          freshState.pendingAction = null;
          
          // Continue with original action
          if (originalAction === 'tax') {
            // Tax action: actor gets 3 coins
            const actorIndex = freshState.players.findIndex(p => p.name === actor);
            if (actorIndex !== -1) {
              freshState.players[actorIndex].coins += 3;
            }
            freshState.lastAction.message += ` ${actor} collected 3 coins from tax.`;
            freshState = moveToNextTurn(freshState);
          } else if (originalAction === 'assassinate' || originalAction === 'steal') {
            // Prepare for block phase
            freshState.blockingPhase = {
              action: originalAction,
              allowedBlockers: originalAction === 'assassinate' ? 
                [freshState.lastAction.target] : 
                [freshState.lastAction.target],
              blockResponses: {}
            };
            freshState.lastAction.message += ` Block phase initiated.`;
          } else if (originalAction === 'exchange') {
            // Set up exchange state
            const actorPlayer = freshState.players.find(p => p.name === actor);
            if (actorPlayer && actorPlayer.influence.length > 0) {
              freshState.specialState = {
                type: 'exchange',
                player: actor,
                options: [...actorPlayer.influence, ...getExchangeExtraCards()],
                originalCount: actorPlayer.influence.length
              };
              freshState.lastAction.message += ` ${actor} should now exchange cards.`;
            } else {
              freshState = moveToNextTurn(freshState);
            }
          }
          
          // Update game state
          updateGameState(freshState);
          setInfluenceSelection(null);
        });
      }
    }

    // Check for any special states like exchange
    if (gameData && gameData.specialState && gameData.specialState.type === 'exchange' && 
        gameData.specialState.player === playerName && !exchangeSelection) {
      const { options, originalCount } = gameData.specialState;
      promptExchangeSelection(playerName, options, originalCount, (selectedCards) => {
        let updatedGameState = { ...gameData };
        const updatedActor = updatedGameState.players.find((p) => p.name === playerName);
        if (updatedActor) {
          updatedActor.influence = selectedCards;
          updatedGameState.lastAction.message = `${playerName} exchanged influences and returned ${options.length - selectedCards.length} cards to the deck.`;
          updatedGameState.specialState = null; // Clear the special state
          updatedGameState = moveToNextTurn(updatedGameState);
          updateGameState(updatedGameState);
          checkGameEnd(updatedGameState);
        }
      });
    }
  }, [gameData, playerName, influenceSelection, exchangeSelection]);

  // Advance turn to the next player with at least one influence.
  const moveToNextTurn = (updatedGameState) => {
    const alivePlayers = updatedGameState.players.filter(
      (p) => p.influence && p.influence.length > 0
    );
    if (alivePlayers.length === 0) return updatedGameState;
    const currentIndex = updatedGameState.players.findIndex(
      (p) => p.name === updatedGameState.currentTurn
    );
    let nextIndex = (currentIndex + 1) % updatedGameState.players.length;
    while (
      updatedGameState.players[nextIndex].influence.length === 0 &&
      nextIndex !== currentIndex
    ) {
      nextIndex = (nextIndex + 1) % updatedGameState.players.length;
    }
    updatedGameState.currentTurn = updatedGameState.players[nextIndex].name;
    return updatedGameState;
  };

  const checkGameEnd = async (updatedGameState) => {
    const alivePlayers = updatedGameState.players.filter(
      (p) => p.influence && p.influence.length > 0
    );
    if (alivePlayers.length === 1) {
      Alert.alert('Game Over', `${alivePlayers[0].name} wins!`, [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Home'),
        },
      ]);
    }
  };

  const updateGameState = async (updatedGameState) => {
    const roomRef = doc(db, 'rooms', roomCode);
    await updateDoc(roomRef, updatedGameState);
  };

  // Prompt the given player (only visible to that player) to choose an influence to lose.
  const promptInfluenceLoss = (losingPlayer, options, onSelect) => {
    // Clear any existing selection first to prevent multiple modals
    setInfluenceSelection(null);
    
    // Delay slightly to ensure state is updated before showing the new modal
    setTimeout(() => {
      setInfluenceSelection({ player: losingPlayer, options, callback: onSelect });
    }, 100);
  };

  // For Exchange: prompt the actor to select exactly count cards from the provided options.
  const promptExchangeSelection = (player, options, count, onSelect) => {
    setExchangeSelection({ player, options, count, callback: onSelect, selected: [] });
  };

  // This function is deprecated, influence loss is now handled directly in the useEffect
  // to prevent race conditions and double card loss
  const handleInfluenceLoss = async (losingPlayer, lostCard) => {
    // Only used for backward compatibility
    console.log(`Player ${losingPlayer} lost ${lostCard}`);
    return Promise.resolve();
  };

  // ------------------ PERFORM ACTIONS ------------------
  const performAction = async (action, targetPlayer = null) => {
    if (!gameData) return;
    if (gameData.currentTurn !== playerName) {
      Alert.alert('Not Your Turn', 'Please wait for your turn.');
      return;
    }
    let updatedGameState = { ...gameData };
    const actor = updatedGameState.players.find((p) => p.name === playerName);

    // Validate coin requirements.
    if (action === 'assassinate' && actor.coins < 3) {
      Alert.alert('Not Enough Coins', 'You need 3 coins for Assassination.');
      return;
    }
    if (action === 'coup' && actor.coins < 7) {
      Alert.alert('Not Enough Coins', 'You need 7 coins for a Coup.');
      return;
    }

    if (action === 'income') {
      actor.coins += 1;
      updatedGameState.lastAction = {
        player: playerName,
        action,
        message: `${playerName} took Income.`,
      };
      updatedGameState = moveToNextTurn(updatedGameState);
      await updateGameState(updatedGameState);
      return;
    }

    // Coup: deduct coins and set pending action for target influence loss.
    // Cannot be challenged or blocked.
    if (action === 'coup') {
      // Verify the player has enough coins
      if (actor.coins < 7) {
        Alert.alert('Not Enough Coins', 'You need 7 coins for a Coup.');
        return;
      }
      
      // Deduct the cost
      actor.coins -= 7;
      
      if (!targetPlayer) {
        Alert.alert('Select Target', 'You must select a player for a Coup.');
        return;
      }
      
      // Check if the target has any influence left
      const target = updatedGameState.players.find(p => p.name === targetPlayer);
      if (!target || target.influence.length === 0) {
        Alert.alert('Invalid Target', 'Selected player has no influence left.');
        return;
      }
      
      updatedGameState.lastAction = {
        player: playerName,
        action,
        target: targetPlayer,
        message: `${playerName} launched a Coup on ${targetPlayer}. ${targetPlayer}, choose an influence to lose.`,
      };
      
      // Set the pending action - Coup cannot be challenged or blocked
      updatedGameState.pendingAction = { 
        type: 'coup', 
        actor: playerName,
        target: targetPlayer,
        // Add timestamp to ensure this is a fresh state
        timestamp: Date.now()
      };
      
      await updateGameState(updatedGameState);
      return;
    }

    // Assassinate: deduct coins and set a pending action for challenge phase first
    if (action === 'assassinate') {
      actor.coins -= 3;
      if (!targetPlayer) {
        Alert.alert('Select Target', 'You must select a player for Assassination.');
        return;
      }
      updatedGameState.lastAction = {
        player: playerName,
        action,
        target: targetPlayer,
        message: `${playerName} attempts Assassination on ${targetPlayer}. Waiting for challenge responses...`,
      };
      // Set pendingAction for the challenge phase with proper fields
      updatedGameState.pendingAction = {
        type: 'action', // Use 'action' type for challenge phase
        player: playerName,
        action: 'assassinate',
        target: targetPlayer,
        challengeResponses: {},
      };
      await updateGameState(updatedGameState);
      return;
    }

    // For challengeable actions: tax, steal, exchange.
    if (action === 'tax' || action === 'steal' || action === 'exchange') {
      updatedGameState.lastAction = {
        player: playerName,
        action,
        target: targetPlayer,
        message: `${playerName} attempts ${action}${targetPlayer ? ' on ' + targetPlayer : ''}. Waiting for challenge responses...`,
      };
      updatedGameState.pendingAction = {
        type: 'action',
        player: playerName,
        action,
        target: targetPlayer,
        challengeResponses: {},
      };
      await updateGameState(updatedGameState);
      return;
    }

    // Foreign Aid: skip challenge phase; go directly to block phase.
    if (action === 'foreign_aid') {
      updatedGameState.lastAction = {
        player: playerName,
        action,
        message: `${playerName} attempts Foreign Aid. Waiting for block responses...`,
      };
      updatedGameState.blockingPhase = {
        allowedBlockers: updatedGameState.players
          .filter((p) => p.name !== playerName)
          .map((p) => p.name),
        blockResponses: {},
      };
      await updateGameState(updatedGameState);
      return;
    }
  };

  // ------------------ CHALLENGE PHASE ------------------
  const recordChallengeResponse = async (response) => {
    if (
      !gameData ||
      !gameData.pendingAction ||
      gameData.pendingAction.player === playerName
    )
      return;
    let updatedGameState = { ...gameData };
    if (!updatedGameState.pendingAction.challengeResponses) {
      updatedGameState.pendingAction.challengeResponses = {};
    }
    if (
      updatedGameState.pendingAction.challengeResponses[playerName] === undefined
    ) {
      updatedGameState.pendingAction.challengeResponses[playerName] = response;
      await updateGameState(updatedGameState);
    }
    checkChallengeResponses(updatedGameState);
  };

  const checkChallengeResponses = async (updatedGameState) => {
    const eligibleCount = updatedGameState.players.length - 1;
    const responses = updatedGameState.pendingAction.challengeResponses;
    if (Object.keys(responses).length < eligibleCount) return;
    const challenger = Object.keys(responses).find((p) => responses[p] === true);
    if (challenger) {
      await resolveActionChallenge(updatedGameState, challenger);
    } else {
      // No one challenged—clear pending action and, if the action is blockable, initiate block phase.
      const action = updatedGameState.pendingAction.action;
      const actorName = updatedGameState.pendingAction.player;
      updatedGameState.pendingAction = null;
      await updateGameState(updatedGameState);
      
      // Blockable actions: foreign_aid, assassinate, steal
      if (action === 'assassinate' || action === 'steal') {
        await initiateBlockPhase(action, updatedGameState);
      } else if (action === 'exchange') {
        // If Exchange is not challenged, set up the state for exchange
        const exchangeActor = updatedGameState.players.find((p) => p.name === actorName);
        
        if (exchangeActor && exchangeActor.influence.length > 0) {
          const originalCount = exchangeActor.influence.length;
          const extraCards = getExchangeExtraCards();
          
          updatedGameState.specialState = {
            type: 'exchange',
            player: actorName,
            options: [...exchangeActor.influence, ...extraCards],
            originalCount: originalCount
          };
          
          updatedGameState.lastAction.message += ` ${actorName} should now exchange cards.`;
          await updateGameState(updatedGameState);
          
          // If this player is the actor, trigger the exchange UI
          if (actorName === playerName) {
            setTimeout(() => performExchange(), 500); // Small delay to ensure state is updated
          }
        } else {
          // Move to next turn if actor has no influence
          let newState = moveToNextTurn(updatedGameState);
          await updateGameState(newState);
        }
      } else if (action === 'tax') {
        await finalizeAction(action, updatedGameState);
      }
    }
  };

  // Resolve a challenge on an action.
  // If the actor is challenged and is wrong, they lose one influence;
  // if the challenge is incorrect, the challenger loses one influence.
  const resolveActionChallenge = async (updatedGameState, challenger) => {
    const actorName = updatedGameState.pendingAction.player;
    const action = updatedGameState.pendingAction.action;
    let requiredInfluence = null;
    if (action === 'tax') requiredInfluence = 'Duke';
    else if (action === 'assassinate') requiredInfluence = 'Assassin';
    else if (action === 'steal') requiredInfluence = 'Captain';
    else if (action === 'exchange') requiredInfluence = 'Ambassador';
    
    const actor = updatedGameState.players.find((p) => p.name === actorName);
    if (!actor) return; // Safety check
    
    const actorHasCard = requiredInfluence
      ? actor.influence.includes(requiredInfluence)
      : true;

    // Store the action information before making changes
    const actionInfo = { ...updatedGameState.pendingAction };

    if (actorHasCard) {
      // SUCCESSFUL BLUFF: actor had the card, challenger loses influence
      // First clear pending action but keep a record of the challenge
      updatedGameState.pendingAction = {
        type: 'challenger_loss',
        challenger: challenger,
        originalAction: action,
        actor: actorName
      };
      
      updatedGameState.lastAction.message = `${actorName} shows ${requiredInfluence}. ${challenger} loses one influence.`;
      await updateGameState(updatedGameState);
      
      // If the challenger is this player, show prompt to lose influence
      if (challenger === playerName) {
        const challengerObj = updatedGameState.players.find((p) => p.name === challenger);
        if (challengerObj && challengerObj.influence.length > 0) {
          promptInfluenceLoss(challenger, challengerObj.influence, (lostCard) => {
            // First handle the influence loss
            const updatedPlayer = {
              ...challengerObj,
              influence: challengerObj.influence.filter(card => card !== lostCard),
              revealed: [...(challengerObj.revealed || []), lostCard]
            };
            
            // Get fresh state after card loss
            let freshState = { ...gameData };
            
            // Update the player object in the fresh state
            const playerIndex = freshState.players.findIndex(p => p.name === challenger);
            if (playerIndex !== -1) {
              freshState.players[playerIndex] = updatedPlayer;
            }
            
            // Clear the challenge state and proceed with original action
            freshState.pendingAction = null;
            
            // Continue with original action after challenger loses influence
            if (action === 'tax') {
              // Tax action: actor gets 3 coins
              const actorIndex = freshState.players.findIndex(p => p.name === actorName);
              if (actorIndex !== -1) {
                freshState.players[actorIndex].coins += 3;
              }
              freshState.lastAction.message += ` ${actorName} collected 3 coins from tax.`;
              freshState = moveToNextTurn(freshState);
            } else if (action === 'assassinate' || action === 'steal') {
              // Prepare for block phase
              freshState.blockingPhase = {
                action: action,
                allowedBlockers: action === 'assassinate' ? 
                  [freshState.lastAction.target] : 
                  [freshState.lastAction.target],
                blockResponses: {}
              };
              freshState.lastAction.message += ` Block phase initiated.`;
            } else if (action === 'exchange') {
              // Set up exchange state
              const actorPlayer = freshState.players.find(p => p.name === actorName);
              if (actorPlayer && actorPlayer.influence.length > 0) {
                freshState.specialState = {
                  type: 'exchange',
                  player: actorName,
                  options: [...actorPlayer.influence, ...getExchangeExtraCards()],
                  originalCount: actorPlayer.influence.length
                };
                freshState.lastAction.message += ` ${actorName} should now exchange cards.`;
              } else {
                freshState = moveToNextTurn(freshState);
              }
            }
            
            // Update the game state with all changes
            updateGameState(freshState);
            setInfluenceSelection(null);
          });
        }
      }
    } else {
      // FAILED BLUFF: actor didn't have the card, actor loses influence
      // First clear pending action but keep a record of the challenge
      updatedGameState.pendingAction = {
        type: 'bluff_loss',
        actor: actorName,
        originalAction: action
      };
      
      updatedGameState.lastAction.message = `${actorName} was bluffing. They lose one influence. Action cancelled.`;
      await updateGameState(updatedGameState);
      
      // If this player is the actor, show prompt to lose influence
      if (actorName === playerName) {
        if (actor.influence.length > 0) {
          promptInfluenceLoss(actorName, actor.influence, (lostCard) => {
            // First handle the influence loss
            const updatedActor = {
              ...actor,
              influence: actor.influence.filter(card => card !== lostCard),
              revealed: [...(actor.revealed || []), lostCard]
            };
            
            // Get fresh state after card loss
            let freshState = { ...gameData };
            
            // Update the actor object in the fresh state
            const actorIndex = freshState.players.findIndex(p => p.name === actorName);
            if (actorIndex !== -1) {
              freshState.players[actorIndex] = updatedActor;
            }
            
            // Clear the challenge state
            freshState.pendingAction = null;
            
            // If this was an assassination, refund the coins
            if (action === 'assassinate') {
              if (actorIndex !== -1) {
                freshState.players[actorIndex].coins += 3; // Refund the cost
              }
              freshState.lastAction.message += ` ${actorName} gets 3 coins back.`;
            }
            
            // Move to next turn
            freshState = moveToNextTurn(freshState);
            
            // Update the game state with all changes
            updateGameState(freshState);
            setInfluenceSelection(null);
          });
        }
      }
    }
  };

  // ------------------ EXCHANGE ACTION HANDLER ------------------
  const performExchange = async () => {
    let updatedGameState = { ...gameData };
    const actor = updatedGameState.players.find((p) => p.name === playerName);
    if (!actor) return;
    const originalCount = actor.influence.length;
    const extraCards = getExchangeExtraCards();
    const exchangeOptions = [...actor.influence, ...extraCards];
    
    // The Exchange action allows the player to look at 2 cards from the deck
    // and choose any number to keep, returning the rest to the deck
    updatedGameState.lastAction.message = `${playerName} is exchanging cards...`;
    await updateGameState(updatedGameState);
    
    // Create a special state for exchange to ensure it works properly
    updatedGameState.specialState = {
      type: 'exchange',
      player: playerName,
      options: exchangeOptions,
      originalCount: originalCount
    };
    
    // Clear any existing exchange selection
    setExchangeSelection(null);
    
    await updateGameState(updatedGameState);
    
    promptExchangeSelection(playerName, exchangeOptions, originalCount, (selectedCards) => {
      let newState = { ...gameData };
      const updatedActor = newState.players.find((p) => p.name === playerName);
      if (updatedActor) {
        updatedActor.influence = selectedCards;
        newState.lastAction.message = `${playerName} exchanged influences and returned ${exchangeOptions.length - selectedCards.length} cards to the deck.`;
        newState.specialState = null; // Clear the special state
        newState = moveToNextTurn(newState);
        updateGameState(newState);
        checkGameEnd(newState);
      }
    });
  };

  // ------------------ BLOCK PHASE ------------------
  const initiateBlockPhase = async (action, updatedGameState) => {
    let allowedBlockers = [];
    
    // Set up allowed blockers based on action type
    if (action === 'foreign_aid') {
      // Anyone can block foreign aid with Duke
      allowedBlockers = updatedGameState.players
        .filter((p) => p.name !== gameData.lastAction.player && p.influence.length > 0)
        .map((p) => p.name);
    } else if (action === 'assassinate') {
      // Only the target can block assassination (with Contessa)
      const target = updatedGameState.lastAction.target;
      const targetPlayer = updatedGameState.players.find(p => p.name === target);
      if (target && targetPlayer && targetPlayer.influence.length > 0) {
        allowedBlockers = [target];
      }
    } else if (action === 'steal') {
      // Only the target can block stealing (with Captain or Ambassador)
      const target = updatedGameState.lastAction.target;
      const targetPlayer = updatedGameState.players.find(p => p.name === target);
      if (target && targetPlayer && targetPlayer.influence.length > 0) {
        allowedBlockers = [target];
      }
    }
    
    // If no eligible blockers, finalize the action
    if (allowedBlockers.length === 0) {
      await finalizeAction(action, updatedGameState);
      return;
    }
    
    // Set up the blocking phase
    updatedGameState.blockingPhase = {
      action: action, // Store the action type in the blocking phase
      allowedBlockers,
      blockResponses: {},
    };
    
    updatedGameState.lastAction.message += ` Block phase initiated. Allowed blockers: ${allowedBlockers.join(', ')}.`;
    await updateGameState(updatedGameState);
  };

  const recordBlockResponse = async (response) => {
    if (!gameData || !gameData.blockingPhase) return;
    if (!gameData.blockingPhase.allowedBlockers.includes(playerName)) return;
    let updatedGameState = { ...gameData };
    if (updatedGameState.blockingPhase.blockResponses[playerName] === undefined) {
      updatedGameState.blockingPhase.blockResponses[playerName] = response;
      await updateGameState(updatedGameState);
    }
    checkBlockResponses(updatedGameState);
  };

  const checkBlockResponses = async (updatedGameState) => {
    const allowed = updatedGameState.blockingPhase.allowedBlockers;
    const responses = updatedGameState.blockingPhase.blockResponses;
    if (Object.keys(responses).length < allowed.length) return;
    const blocker = Object.keys(responses).find((p) => responses[p] === true);
    if (blocker) {
      updatedGameState.pendingBlock = {
        blocker,
        action: updatedGameState.lastAction.action,
        challengeResponses: {},
      };
      updatedGameState.blockingPhase = null;
      updatedGameState.lastAction.message = `${blocker} is blocking the action. Waiting for block challenge responses...`;
      await updateGameState(updatedGameState);
    } else {
      updatedGameState.blockingPhase = null;
      await updateGameState(updatedGameState);
      await finalizeAction(updatedGameState.lastAction.action, updatedGameState);
    }
  };

  const recordBlockChallengeResponse = async (response) => {
    if (!gameData || !gameData.pendingBlock) return;
    if (gameData.pendingBlock.blocker === playerName) return;
    let updatedGameState = { ...gameData };
    if (!updatedGameState.pendingBlock.challengeResponses) {
      updatedGameState.pendingBlock.challengeResponses = {};
    }
    if (updatedGameState.pendingBlock.challengeResponses[playerName] === undefined) {
      updatedGameState.pendingBlock.challengeResponses[playerName] = response;
      await updateGameState(updatedGameState);
    }
    checkBlockChallengeResponses(updatedGameState);
  };

  const checkBlockChallengeResponses = async (updatedGameState) => {
    const eligible = updatedGameState.players
      .filter((p) => p.name !== updatedGameState.pendingBlock.blocker)
      .map((p) => p.name);
    const responses = updatedGameState.pendingBlock.challengeResponses;
    if (Object.keys(responses).length < eligible.length) return;
    const challenger = Object.keys(responses).find((p) => responses[p] === true);
    if (challenger) {
      await resolveBlockChallenge(updatedGameState, challenger);
    } else {
      updatedGameState.lastAction.message = `Block by ${updatedGameState.pendingBlock.blocker} holds. Action cancelled.`;
      updatedGameState.pendingBlock = null;
      let newState = moveToNextTurn(updatedGameState);
      await updateGameState(newState);
    }
  };

  const resolveBlockChallenge = async (updatedGameState, challenger) => {
    const blockerName = updatedGameState.pendingBlock.blocker;
    const action = updatedGameState.pendingBlock.action;
    let requiredInfluence = null;
    
    // Determine required influence based on action being blocked
    if (action === 'foreign_aid') {
      requiredInfluence = 'Duke';
    } else if (action === 'assassinate') {
      requiredInfluence = 'Contessa';
    } else if (action === 'steal') {
      // Steal can be blocked with either Captain or Ambassador
      requiredInfluence = ['Captain', 'Ambassador'];
    }
    
    const blocker = updatedGameState.players.find((p) => p.name === blockerName);
    let blockerHasCard = false;
    let cardRevealed = null;
    
    // Check if blocker has appropriate card based on action
    if (action === 'steal') {
      // Check for either Captain or Ambassador
      if (blocker.influence.includes('Captain')) {
        blockerHasCard = true;
        cardRevealed = 'Captain';
      } else if (blocker.influence.includes('Ambassador')) {
        blockerHasCard = true;
        cardRevealed = 'Ambassador';
      }
    } else {
      // For other actions, check for the specific required card
      blockerHasCard = blocker.influence.includes(requiredInfluence);
      if (blockerHasCard) {
        cardRevealed = requiredInfluence;
      }
    }
    
    // Resolve the block challenge
    if (blockerHasCard) {
      // If blocker has the correct card, challenger loses influence
      updatedGameState.lastAction.message = `${blockerName} shows ${cardRevealed}. Block is valid. ${challenger} loses one influence.`;
      updatedGameState.pendingBlock = null;
      await updateGameState(updatedGameState);
      
      const challengerObj = updatedGameState.players.find((p) => p.name === challenger);
      promptInfluenceLoss(challenger, challengerObj.influence, (lostCard) => {
        handleInfluenceLoss(challenger, lostCard).then(() => {
          // Block succeeds, go to next turn
          let newState = moveToNextTurn(updatedGameState);
          updateGameState(newState);
        });
      });
    } else {
      // If blocker was bluffing, they lose influence and action proceeds
      // If it's an assassination and the blocker was bluffing, they should lose TWO cards
      // First for the failed block, then for the assassination itself
      const isAssassination = action === 'assassinate';
      const message = isAssassination
        ? `${blockerName} was bluffing about having a Contessa. They lose an influence for the failed block.`
        : `${blockerName} was bluffing. They lose one influence and the action proceeds.`;
      
      updatedGameState.lastAction.message = message;
      updatedGameState.pendingBlock = null;
      
      // Create a special state for the failed block
      updatedGameState.pendingAction = {
        type: 'failed_block',
        blocker: blockerName,
        originalAction: action,
        actor: updatedGameState.lastAction.player,
        target: blockerName, // The blocker loses the first card for failing the block
        secondLoss: isAssassination, // Flag that another card will be lost if it's assassination
        timestamp: Date.now()
      };
      
      await updateGameState(updatedGameState);
      
      // The influence loss will be handled by the useEffect hook now
      // This prevents race conditions and double-prompting
    }
  };

  // ------------------ FINALIZE ACTION ------------------
  const finalizeAction = async (action, updatedGameState) => {
    const actor = updatedGameState.players.find(
      (p) => p.name === updatedGameState.lastAction.player
    );
    if (!actor) return;
    
    if (action === 'tax') {
      actor.coins += 3;
      updatedGameState.lastAction.message += ` ${actor.name} receives 3 coins.`;
      updatedGameState = moveToNextTurn(updatedGameState);
      await updateGameState(updatedGameState);
    } 
    else if (action === 'foreign_aid') {
      actor.coins += 2;
      updatedGameState.lastAction.message += ` ${actor.name} receives 2 coins.`;
      updatedGameState = moveToNextTurn(updatedGameState);
      await updateGameState(updatedGameState);
    } 
    else if (action === 'steal') {
      const targetName = updatedGameState.lastAction.target;
      const target = updatedGameState.players.find((p) => p.name === targetName);
      if (target) {
        const stealAmount = Math.min(2, target.coins);
        actor.coins += stealAmount;
        target.coins -= stealAmount;
        updatedGameState.lastAction.message += ` ${actor.name} steals ${stealAmount} coins from ${targetName}.`;
      }
      updatedGameState = moveToNextTurn(updatedGameState);
      await updateGameState(updatedGameState);
    } 
    else if (action === 'assassinate') {
      const targetName = updatedGameState.lastAction.target;
      
      if (!targetName) {
        console.error('No target specified for assassination');
        updatedGameState = moveToNextTurn(updatedGameState);
        await updateGameState(updatedGameState);
        return;
      }
      
      // Find target player
      const targetPlayer = updatedGameState.players.find((p) => p.name === targetName);
      if (!targetPlayer || targetPlayer.influence.length === 0) {
        console.error('Target has no influence to lose');
        updatedGameState = moveToNextTurn(updatedGameState);
        await updateGameState(updatedGameState);
        return;
      }
      
      // Set up a dedicated state for assassination target to lose influence
      updatedGameState.lastAction.message += ` ${targetName} must lose one influence due to Assassination.`;
      updatedGameState.pendingAction = { 
        type: 'assassination_target',
        actor: actor.name,
        target: targetName 
      };
      
      // Add safety check that this is a new state, not leftover
      updatedGameState.pendingTimestamp = Date.now();
      
      await updateGameState(updatedGameState);
      return;
    } 
    else if (action === 'exchange') {
      // Exchange is handled separately - turn progression happens in exchange handler
    }
    
    // Check game end for all actions
    checkGameEnd(updatedGameState);
  };

  // ------------------ UI HANDLERS ------------------
  const handleActionChallenge = (response) => {
    recordChallengeResponse(response);
  };

  const handleBlockDecision = (response) => {
    recordBlockResponse(response);
  };

  const handleBlockChallenge = (response) => {
    recordBlockChallengeResponse(response);
  };

  const selectTargetAndPerformAction = (action) => {
    Alert.alert(
      'Select Target',
      'Choose a player to target:',
      gameData.players
        .filter((p) => p.name !== playerName && p.influence.length > 0)
        .map((p) => ({
          text: p.name,
          onPress: () => performAction(action, p.name),
        }))
    );
  };

  const handleExchangeCardSelect = (card) => {
    setExchangeSelection((prev) => {
      if (!prev) return null; // Safety check in case prev is null
      
      // Remove the selected card from options to prevent selecting the same card twice
      const updatedOptions = prev.options.filter(c => c !== card);
      const newSelected = [...prev.selected, card];
      
      if (newSelected.length === prev.count) {
        // When the player has selected the required number of cards
        let updatedGameState = { ...gameData };
        const updatedActor = updatedGameState.players.find((p) => p.name === prev.player);
        if (updatedActor) {
          updatedActor.influence = newSelected;
          updatedGameState.lastAction.message = `${prev.player} exchanged influences.`;
          // Clear any special states
          updatedGameState.specialState = null;
          updatedGameState = moveToNextTurn(updatedGameState);
          updateGameState(updatedGameState);
          checkGameEnd(updatedGameState);
        }
        return null;
      }
      
      return { ...prev, selected: newSelected, options: updatedOptions };
    });
  };

  // ------------------ RENDERING ------------------
  if (!gameData) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Loading game data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Room Code: {roomCode}</Text>
      <Text style={styles.subtitle}>Current Turn: {gameData.currentTurn}</Text>
      <FlatList
        data={gameData.players}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <Text style={styles.playerInfo}>
            {item.name} – Coins: {item.coins} – Influence:{' '}
            {item.name === playerName
              ? item.influence.join(', ')
              : `${item.influence.length} card(s)`}
            {item.revealed && item.revealed.length > 0
              ? ` (Revealed: ${item.revealed.join(', ')})`
              : ''}
          </Text>
        )}
      />

      {gameData.pendingAction &&
        gameData.pendingAction.type === 'action' &&
        gameData.pendingAction.player !== playerName && (
          <View style={styles.challengeContainer}>
            <Text>
              {gameData.pendingAction.player} is attempting{' '}
              {gameData.pendingAction.action}. Challenge?
            </Text>
            <View style={styles.row}>
              <TouchableOpacity
                style={styles.button}
                onPress={() => handleActionChallenge(true)}
              >
                <Text style={styles.buttonText}>Challenge</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.button}
                onPress={() => handleActionChallenge(false)}
              >
                <Text style={styles.buttonText}>No Challenge</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      {gameData.blockingPhase &&
        gameData.blockingPhase.allowedBlockers.includes(playerName) && (
          <View style={styles.challengeContainer}>
            <Text>
              You may block {gameData.lastAction.action} by{' '}
              {gameData.lastAction.player}. Block?
            </Text>
            <View style={styles.row}>
              <TouchableOpacity
                style={styles.button}
                onPress={() => handleBlockDecision(true)}
              >
                <Text style={styles.buttonText}>Block</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.button}
                onPress={() => handleBlockDecision(false)}
              >
                <Text style={styles.buttonText}>No Block</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      {gameData.pendingBlock &&
        gameData.pendingBlock.blocker !== playerName && (
          <View style={styles.challengeContainer}>
            <Text>
              {gameData.pendingBlock.blocker} is blocking the action. Challenge
              the block?
            </Text>
            <View style={styles.row}>
              <TouchableOpacity
                style={styles.button}
                onPress={() => handleBlockChallenge(true)}
              >
                <Text style={styles.buttonText}>Challenge Block</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.button}
                onPress={() => handleBlockChallenge(false)}
              >
                <Text style={styles.buttonText}>No Challenge</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      {gameData.currentTurn === playerName &&
        !gameData.pendingAction &&
        !gameData.blockingPhase &&
        !gameData.pendingBlock && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.button}
              onPress={() => performAction('income')}
            >
              <Text style={styles.buttonText}>Income</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.button}
              onPress={() => performAction('foreign_aid')}
            >
              <Text style={styles.buttonText}>Foreign Aid</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.button}
              onPress={() => performAction('tax')}
            >
              <Text style={styles.buttonText}>Tax</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.button}
              onPress={() => selectTargetAndPerformAction('steal')}
            >
              <Text style={styles.buttonText}>Steal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.button}
              onPress={() => selectTargetAndPerformAction('coup')}
            >
              <Text style={styles.buttonText}>Coup</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.button}
              onPress={() => selectTargetAndPerformAction('assassinate')}
            >
              <Text style={styles.buttonText}>Assassinate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.button}
              onPress={() => performAction('exchange')}
            >
              <Text style={styles.buttonText}>Exchange</Text>
            </TouchableOpacity>
          </View>
        )}

      {influenceSelection && influenceSelection.player === playerName && (
        <Modal transparent={true} animationType="slide" onRequestClose={() => setInfluenceSelection(null)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{`Select an influence to lose, ${influenceSelection.player}:`}</Text>
              {influenceSelection.options.map((card, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.modalButton}
                  onPress={() => {
                    // Store the callback and card locally
                    const callback = influenceSelection.callback;
                    const selectedCard = card;
                    
                    // Clear the selection state immediately to hide the modal
                    setInfluenceSelection(null);
                    
                    // Then call the callback after the modal is gone
                    setTimeout(() => {
                      if (callback) callback(selectedCard);
                    }, 100);
                  }}
                >
                  <Text style={styles.buttonText}>{card}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>
      )}

      {exchangeSelection && exchangeSelection.player === playerName && (
        <Modal transparent={true} animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text>{`Select ${exchangeSelection.count} card(s) to keep from: ${exchangeSelection.options.join(
                ', '
              )}`}</Text>
              {exchangeSelection.options.map((card, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.modalButton}
                  onPress={() => handleExchangeCardSelect(card)}
                >
                  <Text style={styles.buttonText}>{card}</Text>
                </TouchableOpacity>
              ))}
              <Text>Selected: {exchangeSelection.selected.join(', ')}</Text>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 10,
  },
  playerInfo: {
    fontSize: 16,
    marginBottom: 5,
  },
  actions: {
    marginTop: 20,
  },
  button: {
    backgroundColor: '#333',
    padding: 10,
    marginVertical: 5,
    borderRadius: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 18,
    textAlign: 'center',
  },
  challengeContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#FFD700',
    borderRadius: 5,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    marginTop: 10,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: '#333',
    padding: 10,
    marginVertical: 5,
    borderRadius: 5,
    width: '100%',
    alignItems: 'center',
  },
});

export default GameScreen;
