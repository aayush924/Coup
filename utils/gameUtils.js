// gameUtils.js
export const getRandomInfluence = () => {
    const availableCharacters = ['Duke', 'Assassin', 'Captain', 'Contessa', 'Ambassador']; // Example characters
    const playerInfluence = [];
  
    for (let i = 0; i < 2; i++) {
      const randomIndex = Math.floor(Math.random() * availableCharacters.length);
      const character = availableCharacters.splice(randomIndex, 1)[0];
      playerInfluence.push(character);
    }
  
    return playerInfluence;
};

