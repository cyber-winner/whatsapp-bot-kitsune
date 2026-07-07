const axios = require('axios');
const {
  execFile
} = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  GIF_API_BASE
} = require('../config');
async function fetchGif(category) {
  try {
    const res = await axios.get(`${GIF_API_BASE}/${category}`, {
      timeout: 8000
    });
    if (res.data && res.data.results && res.data.results.length > 0) {
      const result = res.data.results[0];
      return {
        url: result.url,
        anime_name: result.anime_name || 'Unknown'
      };
    }
    return null;
  } catch (err) {
    console.error(`[GIF API] Failed to fetch '${category}':`, err.message);
    return null;
  }
}
async function gifToMp4Base64(gifUrl) {
  const tmpGif = path.join(os.tmpdir(), `celestia_${Date.now()}.gif`);
  const tmpMp4 = path.join(os.tmpdir(), `celestia_${Date.now()}.mp4`);
  try {
    const response = await axios.get(gifUrl, {
      responseType: 'arraybuffer',
      timeout: 15000
    });
    fs.writeFileSync(tmpGif, response.data);
    await new Promise((resolve, reject) => {
      execFile('ffmpeg', ['-y', '-i', tmpGif, '-movflags', 'faststart', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-an', '-t', '15', tmpMp4], {
        timeout: 30000
      }, (err, stdout, stderr) => {
        if (err) reject(err);else resolve();
      });
    });
    const mp4Buffer = fs.readFileSync(tmpMp4);
    return mp4Buffer.toString('base64');
  } catch (err) {
    console.error('[GIF→MP4] Conversion failed:', err.message);
    return null;
  } finally {
    try {
      fs.unlinkSync(tmpGif);
    } catch {}
    try {
      fs.unlinkSync(tmpMp4);
    } catch {}
  }
}
module.exports = {
  fetchGif,
  gifToMp4Base64
};