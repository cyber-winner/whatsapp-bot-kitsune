const familyStore = require('../../store/familyStore');
const { getUserId } = require('../../utils/getUserId');
const {
  MessageMedia
} = require('whatsapp-web.js');
const axios = require('axios');
async function generateTreeDot(userId, targetContactName, familyStoreObj, client) {
  const {
    resolveLeaderboardName
  } = require('../../utils/contactHelper');
  const visited = new Set();
  const edges = new Set();
  const nodes = new Set();
  const sameRanks = new Set();
  const queue = [{
    id: userId,
    depth: 0
  }];
  const userNames = {
    [userId]: targetContactName
  };
  while (queue.length > 0) {
    const {
      id: current,
      depth
    } = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    const family = await familyStoreObj.getFamily(current);
    let name = userNames[current];
    if (!name) {
      name = await resolveLeaderboardName(current, client);
      userNames[current] = name;
    }
    const safeName = (name || '').replace(/"/g, '\\"').replace(/\n/g, ' ');
    nodes.add(`"${current}" [label="${safeName}", shape=box, style=filled, fillcolor="#ffb3d9", fontcolor=black, color="#ff66b3"]`);
    if (family.spouse) {
      const partnerId = family.spouse;
      if (!visited.has(partnerId)) queue.push({
        id: partnerId,
        depth: depth + 1
      });
      const edge1 = `"${current}" -> "${partnerId}" [dir=both, arrowhead=normal, arrowtail=normal, color="#ff3333", penwidth=2, constraint=false]`;
      const edge2 = `"${partnerId}" -> "${current}" [dir=both, arrowhead=normal, arrowtail=normal, color="#ff3333", penwidth=2, constraint=false]`;
      if (!edges.has(edge1) && !edges.has(edge2)) {
        edges.add(edge1);
        const sorted = [current, partnerId].sort();
        sameRanks.add(`{ rank=same; "${sorted[0]}"; "${sorted[1]}" }`);
      }
    }
    for (const exId of family.ex_partners || []) {
      if (!visited.has(exId)) queue.push({
        id: exId,
        depth: depth + 1
      });
      const edge1 = `"${current}" -> "${exId}" [dir=both, arrowhead=normal, arrowtail=normal, color="#888888", style=dashed, penwidth=2, constraint=false]`;
      const edge2 = `"${exId}" -> "${current}" [dir=both, arrowhead=normal, arrowtail=normal, color="#888888", style=dashed, penwidth=2, constraint=false]`;
      if (!edges.has(edge1) && !edges.has(edge2)) edges.add(edge1);
    }
    for (const childId of family.children) {
      if (!visited.has(childId)) queue.push({
        id: childId,
        depth: depth + 1
      });
      edges.add(`"${current}" -> "${childId}" [color="#3399ff", penwidth=1.5]`);
    }
    for (const disownedId of family.disowned || []) {
      if (!visited.has(disownedId)) queue.push({
        id: disownedId,
        depth: depth + 1
      });
      edges.add(`"${current}" -> "${disownedId}" [color="#ff9900", style=dashed, penwidth=1.5, constraint=false]`);
    }
    for (const parentId of family.parents) {
      if (!visited.has(parentId)) queue.push({
        id: parentId,
        depth: depth + 1
      });
      edges.add(`"${parentId}" -> "${current}" [color="#3399ff", penwidth=1.5]`);
      const parentFamily = await familyStoreObj.getFamily(parentId);
      for (const siblingId of parentFamily.children) {
        if (siblingId !== current) {
          if (!visited.has(siblingId)) queue.push({
            id: siblingId,
            depth: depth + 1
          });
          const edge1 = `"${current}" -> "${siblingId}" [dir=none, color="#33cc33", style=dashed, penwidth=2, constraint=false]`;
          const edge2 = `"${siblingId}" -> "${current}" [dir=none, color="#33cc33", style=dashed, penwidth=2, constraint=false]`;
          if (!edges.has(edge1) && !edges.has(edge2)) edges.add(edge1);
        }
      }
    }
  }
  const nodesStr = nodes.size > 0 ? Array.from(nodes).join(';\n    ') + ';' : '';
  const edgesStr = edges.size > 0 ? Array.from(edges).join(';\n    ') + ';' : '';
  const sameRanksStr = sameRanks.size > 0 ? Array.from(sameRanks).join('\n    ') : '';
  const dotScript = `
digraph FamilyTree {
    rankdir=TB;
    nodesep=0.8;
    ranksep=1.2;
    splines=true;
    bgcolor="#f9f9f9";
    node [fontname="Helvetica,Arial,sans-serif"];
    edge [fontname="Helvetica,Arial,sans-serif"];
    ${nodesStr}
    ${edgesStr}
    ${sameRanksStr}
}`;
  return dotScript;
}
module.exports = {
  name: 'tree',
  aliases: ['familytree', 'fulltree'],
  description: 'Shows your family tree as an image.',
  async execute(msg, args, client) {
    const chat = await msg.getChat();
    if (!chat.isGroup) return msg.reply('❌ _This command only works in groups._');
    const mentions = await msg.getMentions();
    let targetId = '';
    let targetContact = null;
    const { getDisplayName } = require('../../utils/contactHelper');

    if (mentions.length > 0) {
      targetContact = mentions[0];
      targetId = getUserId(targetContact);
    } else {
      targetContact = await msg.getContact();
      targetId = getUserId(targetContact);
    }
    const targetName = getDisplayName(targetContact);
    msg.reply('⏳ _Generating your family tree image, please wait..._');
    try {
      const dot = await generateTreeDot(targetId, targetName, familyStore, client);
      const response = await axios.post('https://quickchart.io/graphviz', {
        graph: dot,
        format: 'png',
        width: 1600,
        height: 900
      }, {
        responseType: 'arraybuffer'
      });
      const base64Image = Buffer.from(response.data, 'binary').toString('base64');
      const media = new MessageMedia('image/png', base64Image, 'tree.png');
      await chat.sendMessage(media, {
        caption: `🌳 **Family Tree of @${targetId}** 🌳`,
        mentions: [targetContact.id._serialized]
      });
    } catch (error) {
      console.error('Error generating tree:', error);
      msg.reply('❌ _Failed to generate family tree image. The tree might be too complex._');
    }
  }
};