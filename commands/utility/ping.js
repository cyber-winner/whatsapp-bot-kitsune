module.exports = {
  name: 'ping',
  aliases: [],
  description: 'Check if the bot is alive and show latency.',
  adminOnly: false,
  async execute(msg, args, client) {
    const start = Date.now();
    const sent = await msg.reply('🏓 _Pinging..._');
    const latency = Date.now() - start;
    const status = latency < 200 ? '🟢 Excellent' : latency < 500 ? '🟡 Good' : '🔴 Slow';
    const content = `\n` + `  🎀 ⋆ ˚｡⋆୨୧˚ 🏓 *P O N G !* ˚୨୧⋆｡˚ ⋆ 🎀  \n` + `\n\n` + `⚡ *Latency:* \`${latency}ms\`\n` + `📊 *Status:* _${status}_\n` + `🌐 *Uptime:* _${getUptime()}_\n\n` + `_Kitsune is alive and well._ ૮꒰ ˶• ༝ •˶꒱ა ♡ ⋆.˚ ✨`;
    try {
      if (sent && sent.edit) {
        await new Promise(r => setTimeout(r, 500));
        const edited = await sent.edit(content);
        if (!edited) {
          throw new Error('Edit returned null');
        }
      } else {
        await msg.reply(content);
      }
    } catch (e) {
      console.error('[Ping] Edit failed, falling back:', e.message);
      await sent.delete(true).catch(() => {});
      await msg.reply(content);
    }
  }
};
function getUptime() {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor(uptime % 3600 / 60);
  const seconds = Math.floor(uptime % 60);
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}