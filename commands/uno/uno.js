const UnoGame = require('../../models/UnoGame');
const { MessageMedia } = require('../../utils/baileysCompat');
const { buildDeck, parseCardInput, getHumanCardName, matchCards, createHandImage, WILDS, COLORS } = require('../../utils/unoLogic');
const path = require('path');

const { getPhoneFromLid } = require('../../utils/getUserId');
function getPrint(id, players) {
    if (!id) return '';
    if (players && players.has(id) && players.get(id).isBot) return players.get(id).name;
    let raw = id.split('@')[0];
    if (id.includes('@lid')) {
        let phone = getPhoneFromLid(raw);
        if (phone) return '@' + phone;
    }
    return '@' + raw;
}
function getMent(id) {
    if (!id || id.startsWith('bot_')) return null;
    if (id.includes('@lid')) {
        let phone = getPhoneFromLid(id.split('@')[0]);
        if (phone) return phone + '@s.whatsapp.net';
    }
    return id;
}

const fs = require('fs');

module.exports = {
    name: 'uno',
    description: 'Play UNO with your group!\n\n*Subcommands:*\n`-uno create [settings]` : Create a game lobby\n`-uno join` : Join the lobby\n`-uno addbot` : Add an AI opponent\n`-uno start` : Start the game\n`-uno play <card>` : Play a card (e.g. `r5`, `wild blue`)\n`-uno draw` : Draw a card\n`-uno hand` : Send your hand in DMs\n`-uno end` : Force end the game',
    category: 'uno',
    async execute(message, args, client) {
        const isGroup = message.from && message.from.endsWith('@g.us');
        if (!isGroup) return message.reply('UNO can only be played in groups!');

        const subCommand = args[0] ? args[0].toLowerCase() : 'help';
        const guildID = message.from;
        const sender = message.author || message.from;
        const senderName = message.pushName || 'Player';

        try {
            switch (subCommand) {
                case 'create':
                    await this.createGame(message, guildID, sender, args.slice(1));
                    break;
                case 'addbot':
                    await this.addBot(message, guildID, sender);
                    break;
                case 'join':
                    await this.joinGame(message, guildID, sender, senderName, client);
                    break;
                case 'start':
                    await this.startGame(message, guildID, sender, client);
                    break;
                case 'play':
                    await this.playCard(message, guildID, sender, args.slice(1), client);
                    break;
                case 'draw':
                    await this.drawCard(message, guildID, sender, client);
                    break;
                case 'hand':
                case 'cards':
                    await this.sendHand(message, guildID, sender, client);
                    break;
                case 'end':
                    await this.endGame(message, guildID, sender);
                    break;
                default:
                    await message.reply('UNO Commands:\n- `-uno create [settings]`\n- `-uno join`\n- `-uno start`\n- `-uno play <card>`\n- `-uno draw`\n- `-uno hand`\n- `-uno end`');
            }
        } catch (err) {
            console.error('[UNO ERROR]', err);
            await message.reply('An error occurred during the UNO game.');
        }
    },

    async createGame(message, guildID, sender, args) {
        let game = await UnoGame.findOne({ guildID });
        if (game) return message.reply('An UNO game is already active or waiting in this group.');

        game = new UnoGame({
            guildID,
            gameCreatorID: sender,
            status: 'waiting'
        });
        
        // Add creator
        game.players.set(sender, { id: sender, name: message.pushName || 'Player', cards: [] });
        await game.save();

        await message.reply('UNO game lobby created! 🎮\nType `-uno join` to enter the game, and `-uno start` when everyone is ready.');
    },

    async addBot(message, guildID, sender) {
        let game = await UnoGame.findOne({ guildID });
        if (!game) return message.reply('No UNO game found here. Type `-uno create` first.');
        if (game.status === 'playing') return message.reply('The game has already started!');
        if (game.gameCreatorID !== sender) return message.reply('Only the game creator can add bots.');

        const botId = `bot_${Date.now()}`;
        game.players.set(botId, { id: botId, name: 'KITSUNE', cards: [], isBot: true });
        await game.save();

        await message.reply(`🦊 KITSUNE has joined the game! (${game.players.size} players)`);
    },

    async joinGame(message, guildID, sender, senderName, client) {
        let game = await UnoGame.findOne({ guildID });
        if (!game) return message.reply('No UNO game found here. Type `-uno create` first.');
        if (game.status === 'playing') return message.reply('The game has already started!');
        if (game.players.has(sender)) return message.reply('You have already joined the game!');
        

        game.players.set(sender, { id: sender, name: senderName, cards: [] });
        await game.save();

        await message.reply(`${getPrint(sender, game.players)} has joined the UNO game! (${game.players.size} players)`, { mentions: [sender].map(getMent).filter(Boolean) });
    },

    async startGame(message, guildID, sender, client) {
        let game = await UnoGame.findOne({ guildID });
        if (!game) return message.reply('No UNO game found here.');
        if (game.status === 'playing') return message.reply('The game is already playing!');
        if (game.gameCreatorID !== sender) return message.reply('Only the game creator can start it.');
        if (game.players.size < 2) return message.reply('Not enough players to start. Need at least 2.');

        // Initialize deck
        game.deck = buildDeck();
        game.status = 'playing';
        game.playerOrder = Array.from(game.players.keys());
        
        // Deal 7 cards to each
        for (let playerId of game.playerOrder) {
            let player = game.players.get(playerId);
            for (let i = 0; i < 7; i++) {
                player.cards.push(game.deck.pop());
            }
            game.players.set(playerId, player);
        }

        // Draw first card (must not be wild, but let's keep it simple: draw until not wild/action)
        let firstCard = game.deck.pop();
        while (firstCard.includes('WILD') || firstCard.includes('SKIP') || firstCard.includes('REVERSE') || firstCard.includes('+2')) {
            game.deck.unshift(firstCard);
            firstCard = game.deck.pop();
        }
        game.currentCard = firstCard;
        game.currentColor = firstCard.charAt(0);
        game.discardPile.push(firstCard);
        
        await game.save();

        // Send DMs with Hands
        await this.broadcastHands(game, client);

        // Send Top Card to group
        const currPlayerId = game.playerOrder[game.currentPosition];
        const currPlayer = game.players.get(currPlayerId);
        
        const cardImagePath = path.join(__dirname, '..', '..', 'data', 'UNO', `${firstCard}.png`);
        await client.sendMessage(guildID, { 
            image: { url: cardImagePath },
            caption: `The game has started! The first card is **${getHumanCardName(firstCard)}**.\n\nIt is ${getPrint(currPlayerId, game.players)}'s turn!\nType \`-uno play <card>\` or \`-uno draw\`.`,
            mentions: [currPlayerId].map(getMent).filter(Boolean)
        });

        if (currPlayer.isBot) {
            setTimeout(() => this.botTurn(game, guildID, client), 3000);
        }
    },

    async broadcastHands(game, client) {
        for (let playerId of game.playerOrder) {
            const player = game.players.get(playerId);
            if (player.isBot) continue;

            const handImagePath = path.join(__dirname, '..', '..', 'data', 'UNO', `tmp_${playerId}_hand.png`);
            try {
                await createHandImage(player.cards, handImagePath);
                const media = MessageMedia.fromFilePath(handImagePath);
                let handText = player.cards.map(c => getHumanCardName(c)).join('\n');
                await client.sendMessage(game.guildID, media, { 
                    caption: `${getPrint(playerId, game.players)}, here is your hand (${player.cards.length} cards):\n${handText}`,
                    mentions: [playerId].map(getMent).filter(Boolean)
                });
                fs.unlinkSync(handImagePath);
            } catch (e) {
                console.error('Failed to send hand image to', playerId, e);
                // Fallback to text
                let handText = player.cards.map(c => getHumanCardName(c)).join('\n');
                await client.sendMessage(game.guildID, { text: `Failed to generate image. Hand for ${getPrint(playerId, game.players)}:\n${handText}`, mentions: [playerId].map(getMent).filter(Boolean) });
            }
        }
    },

    async playCard(message, guildID, sender, args, client) {
        let game = await UnoGame.findOne({ guildID });
        if (!game || game.status !== 'playing') return message.reply('No active UNO game here.');
        
        const currPlayerId = game.playerOrder[game.currentPosition];
        if (currPlayerId !== sender) return message.reply(`It's not your turn! It's ${getPrint(currPlayerId, game.players)}'s turn.`, { mentions: [currPlayerId].map(getMent).filter(Boolean) });

        if (args.length === 0) return message.reply('Please specify a card. E.g., `-uno play r5` or `-uno play wild blue`');

        const parsed = parseCardInput(args);
        if (!parsed) return message.reply('Invalid card format. Use e.g., `r5`, `blue skip`, `wild red`.');

        const player = game.players.get(sender);
        
        // Ensure player has the card
        let cardIndex = player.cards.indexOf(parsed.card);
        if (cardIndex === -1) {
            // Check for color-specific wilds if they appended color? No, hand has 'WILD'
            return message.reply(`You don't have that card! (Parsed as: ${getHumanCardName(parsed.card)})`);
        }

        // Validate move
        if (!matchCards(parsed.card, game.currentCard, game.currentColor)) {
            let colorName = '';
            if (game.currentColor === 'R') colorName = 'Red';
            else if (game.currentColor === 'G') colorName = 'Green';
            else if (game.currentColor === 'B') colorName = 'Blue';
            else if (game.currentColor === 'Y') colorName = 'Yellow';
            else colorName = game.currentColor;

            return message.reply(`You cannot play **${getHumanCardName(parsed.card)}** on top of **${getHumanCardName(game.currentCard)}** (Current Color: ${colorName})!`);
        }

        if (parsed.card.includes('WILD') && !parsed.chosenColor) {
            return message.reply('You played a wild card, but didn\'t specify a color! Try `-uno play wild red`.');
        }

        // Remove card from hand
        player.cards.splice(cardIndex, 1);
        game.players.set(sender, player);

        // Update top card
        game.currentCard = parsed.card;
        game.currentColor = parsed.chosenColor || parsed.card.charAt(0);
        game.discardPile.push(parsed.card);

        // Apply effects
        let skipTurn = false;
        let cardsToDrawForNext = 0;

        if (parsed.card.includes('SKIP')) skipTurn = true;
        if (parsed.card.includes('REVERSE')) game.direction *= -1;
        if (parsed.card.includes('+2')) { skipTurn = true; cardsToDrawForNext = 2; }
        if (parsed.card.includes('+4')) { skipTurn = true; cardsToDrawForNext = 4; }

        // Check win
        if (player.cards.length === 0) {
            await game.deleteOne();
            return message.reply(`🎉 ${getPrint(sender, game.players)} HAS WON THE GAME! 🎉`, { mentions: [sender].map(getMent).filter(Boolean) });
        }

        // Call UNO
        if (player.cards.length === 1 && game.gameSettings.UnoCallout) {
            await client.sendMessage(guildID, { text: `📢 **UNO!** ${getPrint(sender, game.players)} has only 1 card left!`, mentions: [sender].map(getMent).filter(Boolean) });
        }

        // Advance turn logic
        let nextPos = (game.currentPosition + game.direction) % game.playerOrder.length;
        if (nextPos < 0) nextPos += game.playerOrder.length;
        
        // Handle draws for next player
        if (cardsToDrawForNext > 0) {
            let nextPlayerId = game.playerOrder[nextPos];
            let nextPlayer = game.players.get(nextPlayerId);
            for (let i=0; i<cardsToDrawForNext; i++) {
                if (game.deck.length === 0) this.reshuffleDeck(game);
                nextPlayer.cards.push(game.deck.pop());
            }
            game.players.set(nextPlayerId, nextPlayer);
            await client.sendMessage(guildID, { text: `🔴 ${getPrint(nextPlayerId, game.players)} had to draw ${cardsToDrawForNext} cards and their turn is skipped!`, mentions: [nextPlayerId].map(getMent).filter(Boolean) });
            
            // Re-send their hand since they drew cards
            const handImagePath = path.join(__dirname, '..', '..', 'data', 'UNO', `tmp_${nextPlayerId}_hand.png`);
            try {
                await createHandImage(nextPlayer.cards, handImagePath);
                const media = MessageMedia.fromFilePath(handImagePath);
                let handText = nextPlayer.cards.map(c => getHumanCardName(c)).join('\n');
                await client.sendMessage(guildID, media, { caption: `${getPrint(nextPlayerId, game.players)}, you had to draw cards. New hand:\n${handText}`, mentions: [nextPlayerId].map(getMent).filter(Boolean) });
                fs.unlinkSync(handImagePath);
            } catch(e) {}
        }

        if (skipTurn) {
            nextPos = (nextPos + game.direction) % game.playerOrder.length;
            if (nextPos < 0) nextPos += game.playerOrder.length;
        }

        game.currentPosition = nextPos;
        await game.save();

        // Resend hand to the player who just played, so they see their updated hand
        try {
            const handImagePath = path.join(__dirname, '..', '..', 'data', 'UNO', `tmp_${sender}_hand.png`);
            await createHandImage(player.cards, handImagePath);
            const media = MessageMedia.fromFilePath(handImagePath);
            let handText = player.cards.map(c => getHumanCardName(c)).join('\n');
            await client.sendMessage(guildID, media, { caption: `${getPrint(sender, game.players)}, you played **${getHumanCardName(parsed.card)}**. Cards left: ${player.cards.length}\n\nYour hand:\n${handText}`, mentions: [sender].map(getMent).filter(Boolean) });
            fs.unlinkSync(handImagePath);
        } catch(e) {}

        // Send group update
        const newPlayerId = game.playerOrder[game.currentPosition];
        
        // Map WILD to its colored version if it was played, for visual
        let visualCard = parsed.card;
        if (parsed.card === 'WILD' && parsed.chosenColor) visualCard = `${parsed.chosenColor}WILD`;
        if (parsed.card === 'WILD+4' && parsed.chosenColor) visualCard = `${parsed.chosenColor}WILD+4`;
        
        const cardImagePath = path.join(__dirname, '..', '..', 'data', 'UNO', `${visualCard}.png`);
        
        let colorName = '';
        if (parsed.chosenColor === 'R') colorName = 'Red';
        if (parsed.chosenColor === 'G') colorName = 'Green';
        if (parsed.chosenColor === 'B') colorName = 'Blue';
        if (parsed.chosenColor === 'Y') colorName = 'Yellow';
        
        let captionStr = `${getPrint(sender, game.players)} played **${getHumanCardName(parsed.card)}**`;
        if (parsed.chosenColor && parsed.card.includes('WILD')) captionStr += ` (Color changed to ${colorName})`;
        captionStr += `.\n\nNext up: ${getPrint(newPlayerId, game.players)}!`;

        await client.sendMessage(guildID, {
            image: { url: cardImagePath },
            caption: captionStr,
            mentions: [sender, newPlayerId].map(getMent).filter(Boolean)
        });

        this.triggerNextTurn(game, guildID, client);
    },

    async drawCard(message, guildID, sender, client) {
        let game = await UnoGame.findOne({ guildID });
        if (!game || game.status !== 'playing') return message.reply('No active UNO game here.');
        
        const currPlayerId = game.playerOrder[game.currentPosition];
        if (currPlayerId !== sender) return message.reply(`It's not your turn!`);

        let player = game.players.get(sender);
        if (game.deck.length === 0) this.reshuffleDeck(game);
        
        const drawn = game.deck.pop();
        player.cards.push(drawn);
        game.players.set(sender, player);

        // Turn ends immediately standard rule for simplicity
        let nextPos = (game.currentPosition + game.direction) % game.playerOrder.length;
        if (nextPos < 0) nextPos += game.playerOrder.length;
        game.currentPosition = nextPos;
        await game.save();

        const newPlayerId = game.playerOrder[game.currentPosition];

        // Dm the user their new hand
        try {
            const handImagePath = path.join(__dirname, '..', '..', 'data', 'UNO', `tmp_${sender}_hand.png`);
            await createHandImage(player.cards, handImagePath);
            const media = MessageMedia.fromFilePath(handImagePath);
            let handText = player.cards.map(c => getHumanCardName(c)).join('\n');
            await client.sendMessage(guildID, media, { caption: `${getPrint(sender, game.players)}, you drew **${getHumanCardName(drawn)}**. Your turn ends.\n\nYour hand:\n${handText}`, mentions: [sender].map(getMent).filter(Boolean) });
            fs.unlinkSync(handImagePath);
        } catch(e) {}

        await client.sendMessage(guildID, {
            text: `${getPrint(sender, game.players)} drew a card and ended their turn.\n\nNext up: ${getPrint(newPlayerId, game.players)}!`,
            mentions: [sender, newPlayerId].map(getMent).filter(Boolean)
        });

        this.triggerNextTurn(game, guildID, client);
    },

    async sendHand(message, guildID, sender, client) {
        let game = await UnoGame.findOne({ guildID });
        if (!game || game.status !== 'playing') return message.reply('No active UNO game here.');
        
        let player = game.players.get(sender);
        if (!player) return message.reply('You are not in this game.');

        const handImagePath = path.join(__dirname, '..', '..', 'data', 'UNO', `tmp_${sender}_hand.png`);
        try {
            await createHandImage(player.cards, handImagePath);
            const media = MessageMedia.fromFilePath(handImagePath);
            let handText = player.cards.map(c => getHumanCardName(c)).join('\n');
            await client.sendMessage(guildID, media, { caption: `${getPrint(sender, game.players)}, here is your current hand:\n${handText}`, mentions: [sender].map(getMent).filter(Boolean) });
            fs.unlinkSync(handImagePath);
        } catch(e) {
            await message.reply('Failed to send hand.');
        }
    },

    async endGame(message, guildID, sender) {
        let game = await UnoGame.findOne({ guildID });
        if (!game) return message.reply('No UNO game found here.');
        
        if (game.gameCreatorID !== sender) {
            // Need a way to check if admin, for now only creator can end
            return message.reply('Only the game creator can force end the game.');
        }

        await game.deleteOne();
        await message.reply('UNO game ended. Thanks for playing!');
    },

    reshuffleDeck(game) {
        if (game.discardPile.length <= 1) return;
        const top = game.discardPile.pop(); // Keep top card in discard
        game.deck = require('../../utils/unoLogic').shuffleArray([...game.discardPile]);
        game.discardPile = [top];
    },

    
    triggerNextTurn(game, guildID, client) {
        const newPlayerId = game.playerOrder[game.currentPosition];
        const nextPlayer = game.players.get(newPlayerId);
        
        if (nextPlayer.isBot) {
            setTimeout(() => this.botTurn(game, guildID, client), 3000);
            return;
        }

        const { matchCards } = require('../../utils/unoLogic');
        let hasPlayable = false;
        for (let card of nextPlayer.cards) {
            if (matchCards(card, game.currentCard, game.currentColor)) {
                hasPlayable = true;
                break;
            }
        }
        
        if (!hasPlayable) {
            setTimeout(() => this.autoDrawTurn(game, guildID, newPlayerId, client), 3000);
        }
    },

    async autoDrawTurn(game, guildID, playerId, client) {
        const UnoGame = require('../../models/UnoGame');
        game = await UnoGame.findOne({ guildID });
        if (!game || game.status !== 'playing') return;
        
        if (game.playerOrder[game.currentPosition] !== playerId) return; 

        let player = game.players.get(playerId);
        if (game.deck.length === 0) this.reshuffleDeck(game);
        
        const drawn = game.deck.pop();
        player.cards.push(drawn);
        game.players.set(playerId, player);

        let nextPos = (game.currentPosition + game.direction) % game.playerOrder.length;
        if (nextPos < 0) nextPos += game.playerOrder.length;
        game.currentPosition = nextPos;
        await game.save();

        const newPlayerId = game.playerOrder[game.currentPosition];

        try {
            const { createHandImage, getHumanCardName } = require('../../utils/unoLogic');
            const { MessageMedia } = require('../../utils/baileysCompat');
            const handImagePath = require('path').join(__dirname, '..', '..', 'data', 'UNO', `tmp_${playerId}_hand.png`);
            await createHandImage(player.cards, handImagePath);
            const media = MessageMedia.fromFilePath(handImagePath);
            let handText = player.cards.map(c => getHumanCardName(c)).join('\n');
            await client.sendMessage(guildID, media, { caption: `${getPrint(playerId, game.players)}, you had no playable cards, so you auto-drew **${getHumanCardName(drawn)}**. Your turn ends.\n\nYour hand:\n${handText}`, mentions: [playerId].map(getMent).filter(Boolean) });
            require('fs').unlinkSync(handImagePath);
        } catch(e) {}

        await client.sendMessage(guildID, {
            text: `${getPrint(playerId, game.players)} was forced to draw a card and ended their turn.\n\nNext up: ${getPrint(newPlayerId, game.players)}!`,
            mentions: [playerId, newPlayerId].map(getMent).filter(Boolean)
        });

        this.triggerNextTurn(game, guildID, client);
    },

    async botTurn(gameModelDoc, guildID, client) {
        let game = await UnoGame.findOne({ guildID });
        if (!game || game.status !== 'playing') return;

        const botId = game.playerOrder[game.currentPosition];
        const botPlayer = game.players.get(botId);
        if (!botPlayer || !botPlayer.isBot) return;

        const { botPlayCard } = require('../../utils/unoLogic');
        const move = botPlayCard(botPlayer, game);

        if (!move) {
            // Draw
            if (game.deck.length === 0) this.reshuffleDeck(game);
            const drawn = game.deck.pop();
            botPlayer.cards.push(drawn);
            game.players.set(botId, botPlayer);

            let nextPos = (game.currentPosition + game.direction) % game.playerOrder.length;
            if (nextPos < 0) nextPos += game.playerOrder.length;
            game.currentPosition = nextPos;
            await game.save();

            const newPlayerId = game.playerOrder[game.currentPosition];
            await client.sendMessage(guildID, {
                text: `🤖 **${botPlayer.name}** couldn't play and drew a card.\n\nNext up: ${getPrint(newPlayerId, game.players)}!`,
                mentions: [newPlayerId].map(getMent).filter(Boolean)
            });

            this.triggerNextTurn(game, guildID, client);
        } else {
            // Play
            const parsed = move; // format: { card, chosenColor }
            let cardIndex = botPlayer.cards.indexOf(parsed.card);
            botPlayer.cards.splice(cardIndex, 1);
            game.players.set(botId, botPlayer);

            game.currentCard = parsed.card;
            game.currentColor = parsed.chosenColor || parsed.card.charAt(0);
            game.discardPile.push(parsed.card);

            let skipTurn = false;
            let cardsToDrawForNext = 0;

            if (parsed.card.includes('SKIP')) skipTurn = true;
            if (parsed.card.includes('REVERSE')) game.direction *= -1;
            if (parsed.card.includes('+2')) { skipTurn = true; cardsToDrawForNext = 2; }
            if (parsed.card.includes('+4')) { skipTurn = true; cardsToDrawForNext = 4; }

            if (botPlayer.cards.length === 0) {
                await game.deleteOne();
                return client.sendMessage(guildID, { text: `🎉 🤖 **${botPlayer.name}** HAS WON THE GAME! 🎉` });
            }

            if (botPlayer.cards.length === 1 && game.gameSettings.UnoCallout) {
                await client.sendMessage(guildID, { text: `📢 **UNO!** 🤖 **${botPlayer.name}** has only 1 card left!` });
            }

            let nextPos = (game.currentPosition + game.direction) % game.playerOrder.length;
            if (nextPos < 0) nextPos += game.playerOrder.length;

            if (cardsToDrawForNext > 0) {
                let nextPlayerId = game.playerOrder[nextPos];
                let nextPlayer = game.players.get(nextPlayerId);
                for (let i=0; i<cardsToDrawForNext; i++) {
                    if (game.deck.length === 0) this.reshuffleDeck(game);
                    nextPlayer.cards.push(game.deck.pop());
                }
                game.players.set(nextPlayerId, nextPlayer);
                await client.sendMessage(guildID, { text: `🔴 ${getPrint(nextPlayerId, game.players)} had to draw ${cardsToDrawForNext} cards and their turn is skipped!`, mentions: [nextPlayerId].map(getMent).filter(Boolean) });
            }

            if (skipTurn) {
                nextPos = (nextPos + game.direction) % game.playerOrder.length;
                if (nextPos < 0) nextPos += game.playerOrder.length;
            }

            game.currentPosition = nextPos;
            await game.save();

            const newPlayerId = game.playerOrder[game.currentPosition];
            
            let visualCard = parsed.card;
            if (parsed.card === 'WILD' && parsed.chosenColor) visualCard = `${parsed.chosenColor}WILD`;
            if (parsed.card === 'WILD+4' && parsed.chosenColor) visualCard = `${parsed.chosenColor}WILD+4`;
            
            const cardImagePath = require('path').join(__dirname, '..', '..', 'data', 'UNO', `${visualCard}.png`);
            
            let colorName = '';
            if (parsed.chosenColor === 'R') colorName = 'Red';
            if (parsed.chosenColor === 'G') colorName = 'Green';
            if (parsed.chosenColor === 'B') colorName = 'Blue';
            if (parsed.chosenColor === 'Y') colorName = 'Yellow';
            
            let captionStr = `🤖 **${botPlayer.name}** played **${getHumanCardName(parsed.card)}**`;
            if (parsed.chosenColor && parsed.card.includes('WILD')) captionStr += ` (Color changed to ${colorName})`;
            captionStr += `.\n🤖 Cards left: ${botPlayer.cards.length}\n\nNext up: ${getPrint(newPlayerId, game.players)}!`;

            await client.sendMessage(guildID, {
                image: { url: cardImagePath },
                caption: captionStr,
                mentions: [newPlayerId].map(getMent).filter(Boolean)
            });

            this.triggerNextTurn(game, guildID, client);
        }
    }
};
