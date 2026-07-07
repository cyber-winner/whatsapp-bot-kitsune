# Privacy Policy

**Effective Date:** 2026-07-07

This Privacy Policy explains how the Kitsune WhatsApp Bot ("the Bot", "we", "us") collects, uses, and protects data when you interact with it in WhatsApp groups or private messages.

## 1. Information We Collect

When you interact with the Bot, the following information may be collected and stored temporarily or permanently, depending on the configuration set by the instance owner:

- **WhatsApp Phone Numbers:** Your phone number is used as a unique identifier to track game progress (e.g., Pokemon RPG), issue warnings, or enforce bans.
- **Message Content:** Text messages sent in groups where the Bot is active may be temporarily logged to provide conversational context to the AI (using the Groq API).
- **Media and Files:** Images sent to the Bot for processing (e.g., meme generation) are processed ephemerally and are not permanently stored on our servers.

## 2. How We Use Your Information

- **Core Functionality:** To respond to commands, generate AI text, and manage the Pokemon mini-game economy.
- **Group Moderation:** To log warnings, enforce anti-link rules, and apply bans as requested by group administrators.
- **Contextual Memory:** The AI Brain stores a rolling window of recent chat history to maintain conversational flow. This data is regularly flushed.

## 3. Data Sharing

We do not sell, trade, or otherwise transfer your personal information to outside parties.
However, to provide AI functionality, message text may be sent to third-party Large Language Model providers (such as Groq or Google Gemini). These providers have their own privacy policies regarding data retention and training. Please be aware that you should not share highly sensitive personal information with the Bot.

## 4. Data Retention and Deletion

- **Logs:** Message logs (`store-data-for-use/`) are stored locally on the server hosting the Bot.
- **Game Data:** Pokemon RPG data (wallets, inventory) is stored in the MongoDB database indefinitely until the host deletes it.
- **Opt-Out:** If you wish to have your data purged from a specific instance of this Bot, you must contact the person hosting/running that specific instance (the `BOT_OWNER`).

## 5. Security

The code relies on `whatsapp-web.js` and standard Node.js security practices. However, because this is an open-source self-hosted project, the ultimate security of your data depends on the security practices of the individual or organization hosting the Bot instance.

## 6. Changes to This Policy

We may update this Privacy Policy from time to time as new features are added.

## 7. Contact

For questions regarding this privacy policy, please open an issue on the GitHub repository or contact the owner of your specific Bot instance.
