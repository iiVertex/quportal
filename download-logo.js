const https = require('https');
const fs = require('fs');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode === 200) {
        const ws = fs.createWriteStream(dest);
        res.pipe(ws);
        ws.on('finish', () => { ws.close(); resolve(true); });
      } else {
        reject(new Error('Status: ' + res.statusCode));
      }
    }).on('error', reject);
  });
}

async function main() {
  const urls = [
    ['https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://qu.edu.qa&size=128', 'public/qu-logo.png'],
    ['https://logo.clearbit.com/qu.edu.qa', 'public/qu-logo-clearbit.png'],
  ];
  
  for (const [url, dest] of urls) {
    try {
      await download(url, dest);
      console.log('Downloaded:', dest);
      const stats = fs.statSync(dest);
      console.log('Size:', stats.size, 'bytes');
    } catch (e) {
      console.log('Failed:', url, e.message);
    }
  }
}

main();
