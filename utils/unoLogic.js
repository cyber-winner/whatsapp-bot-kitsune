const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const COLORS = ['R', 'G', 'B', 'Y'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'SKIP', 'REVERSE', '+2'];
const WILDS = ['WILD', 'WILD+4'];

/**
 * Builds a standard 108 card UNO deck
 */
function buildDeck() {
    let deck = [];
    for (let c of COLORS) {
        deck.push(`${c}0`); // One 0 per color
        for (let i = 1; i <= 9; i++) {
            deck.push(`${c}${i}`);
            deck.push(`${c}${i}`); // Two 1-9 per color
        }
        for (let action of ['SKIP', 'REVERSE', '+2']) {
            deck.push(`${c}${action}`);
            deck.push(`${c}${action}`); // Two of each action per color
        }
    }
    for (let w of WILDS) {
        for (let i = 0; i < 4; i++) {
            deck.push(w); // Four of each wild
        }
    }
    return shuffleArray(deck);
}

/**
 * Shuffles an array in place
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Parses user input to canonical card string
 * e.g., ["red", "5"] -> "R5"
 * ["wild", "blue"] -> { card: "WILD", chosenColor: "B" }
 */
function parseCardInput(args) {
    let inputStr = args.join("").toLowerCase();
    
    let isWild4 = false;
    let isWild = false;
    let parsedColor = null;

    for (let word of args) {
        word = word.toLowerCase();
        if (word === 'wild4' || word === '+4' || word === 'draw4' || word === 'w4' || word === 'p4' || word === 'd4') isWild4 = true;
        if (word === 'wild' || word === 'w' || word === 'color') isWild = true;
        
        if (word.startsWith('red') || word === 'r') parsedColor = 'R';
        else if (word.startsWith('green') || word === 'g') parsedColor = 'G';
        else if (word.startsWith('blue') || word === 'b') parsedColor = 'B';
        else if (word.startsWith('yellow') || word === 'y') parsedColor = 'Y';
    }
    
    if (!isWild4 && (inputStr.includes('+4') || inputStr.includes('w4') || inputStr.includes('draw4') || inputStr.includes('wild4'))) isWild4 = true;
    if (!isWild4 && !isWild && (inputStr.includes('wild') || (inputStr.startsWith('w') && inputStr.length <= 2))) isWild = true;

    if (!parsedColor) {
        let cleanStr = inputStr.replace(/wild|draw|skip|reverse|rev|plus/g, '');
        if (cleanStr.includes('r')) parsedColor = 'R';
        else if (cleanStr.includes('g')) parsedColor = 'G';
        else if (cleanStr.includes('b')) parsedColor = 'B';
        else if (cleanStr.includes('y')) parsedColor = 'Y';
    }

    if (isWild4) return { card: 'WILD+4', chosenColor: parsedColor };
    if (isWild) return { card: 'WILD', chosenColor: parsedColor };

    let value = null;
    if (inputStr.includes('skip') || inputStr.includes('block') || inputStr.includes('s')) value = 'SKIP';
    else if (inputStr.includes('rev') || inputStr.includes('reverse')) value = 'REVERSE';
    else if (inputStr.includes('+2') || inputStr.includes('draw2') || inputStr.includes('p2') || inputStr.includes('d2')) value = '+2';
    else {
        for (let i = 0; i <= 9; i++) {
            if (inputStr.includes(i.toString())) {
                value = i.toString();
                break;
            }
        }
    }
    
    if (value === 'SKIP' && !inputStr.includes('skip') && !inputStr.includes('block')) {
        let hasS = false;
        for(let w of args) if(w.toLowerCase() === 's' || w.toLowerCase().endsWith('s')) hasS = true;
        if(!hasS && !inputStr.endsWith('s')) {
            value = null; // undo if it was a false positive
        }
    }

    if (parsedColor && value) {
        return { card: `${parsedColor}${value}`, chosenColor: parsedColor };
    }

    return null; // Invalid
}

function getHumanCardName(card) {
    if (!card) return 'Unknown Card';
    if (card === 'WILD') return 'Wild';
    if (card === 'WILD+4') return 'Wild +4';
    
    let colorStr = '';
    if (card.startsWith('R')) colorStr = 'Red ';
    else if (card.startsWith('G')) colorStr = 'Green ';
    else if (card.startsWith('B')) colorStr = 'Blue ';
    else if (card.startsWith('Y')) colorStr = 'Yellow ';
    
    let valStr = card.substring(1);
    if (valStr === 'WILD') return `${colorStr}Wild`;
    if (valStr === 'WILD+4') return `${colorStr}Wild +4`;
    
    if (valStr === 'SKIP') return `${colorStr}Skip`;
    if (valStr === 'REVERSE') return `${colorStr}Reverse`;
    if (valStr === '+2') return `${colorStr}+2`;
    
    return `${colorStr}${valStr}`;
}

/**
 * Checks if playedCard can be placed on top of currentCard
 * @param {String} playedCard 
 * @param {String} currentCard 
 * @param {String} currentColor - The active color (important if currentCard is WILD)
 */
function matchCards(playedCard, currentCard, currentColor) {
    if (WILDS.includes(playedCard)) return true; // Wilds can be played on anything
    
    // Extract color and value
    const playedColor = playedCard.charAt(0);
    const playedValue = playedCard.substring(1);
    
    const currColor = currentColor; // Active color takes precedence
    let currValue = null;
    if (!WILDS.includes(currentCard)) {
        currValue = currentCard.substring(1);
    }
    
    if (playedColor === currColor) return true; // Color matches
    if (currValue && playedValue === currValue) return true; // Value/Symbol matches
    
    return false;
}

/**
 * Creates a composite image of the player's hand using Sharp
 * @param {Array<String>} cards 
 * @param {String} outputPath 
 */
async function createHandImage(cards, outputPath) {
    if (!cards || cards.length === 0) return null;
    
    // Dimensions of a single card are 85x140
    const cardWidth = 85;
    const cardHeight = 140;
    
    const compositeInputs = cards.map((card, index) => {
        let fileName = `${card}.png`;
        const filePath = path.join(__dirname, '..', 'data', 'UNO', fileName);
        
        return {
            input: filePath,
            left: index * cardWidth,
            top: 0
        };
    });

    await sharp({
        create: {
            width: cards.length * cardWidth,
            height: cardHeight,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
    })
    .composite(compositeInputs)
    .toFile(outputPath);
    
    return outputPath;
}

/**
 * Determines the best card for the bot to play.
 * @param {Object} botPlayer 
 * @param {Object} game 
 * @returns {Object|null} { card, chosenColor } or null if need to draw
 */
function botPlayCard(botPlayer, game) {
    let playable = [];
    let colorCounts = { R: 0, G: 0, B: 0, Y: 0 };

    for (let card of botPlayer.cards) {
        if (!WILDS.includes(card)) {
            let col = card.charAt(0);
            if (colorCounts[col] !== undefined) colorCounts[col]++;
        }
        
        if (matchCards(card, game.currentCard, game.currentColor)) {
            playable.push(card);
        }
    }

    if (playable.length === 0) return null;

    // Sort to play best cards (prioritize standard, save wilds)
    playable.sort((a, b) => {
        if (WILDS.includes(a)) return 1;
        if (WILDS.includes(b)) return -1;
        // Prioritize action cards over numbers? Not strictly necessary.
        return 0;
    });

    let chosen = playable[0];
    let chosenColor = null;

    if (WILDS.includes(chosen)) {
        // Pick the color the bot has the most of
        let bestCol = 'R';
        let max = -1;
        for (let col of COLORS) {
            if (colorCounts[col] > max) {
                max = colorCounts[col];
                bestCol = col;
            }
        }
        chosenColor = bestCol;
    }

    return { card: chosen, chosenColor };
}

module.exports = {
    buildDeck,
    shuffleArray,
    parseCardInput,
    getHumanCardName,
    matchCards,
    createHandImage,
    botPlayCard,
    COLORS,
    VALUES,
    WILDS
};
