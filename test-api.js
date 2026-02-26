const https = require('https');
const zlib = require('zlib');

const url = new URL('https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=TOMATO10&from_second=1560046356');

const options = {
  hostname: url.hostname,
  path: url.pathname + url.search,
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'max-age=0',
    'sec-ch-ua': '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
  },
};

const request = https.request(options, (response) => {
  const chunks = [];
  
  response.on('data', (chunk) => {
    chunks.push(chunk);
  });
  
  response.on('end', () => {
    console.log('Status:', response.statusCode);
    console.log('Content-Encoding:', response.headers['content-encoding']);
    
    try {
      let buffer = Buffer.concat(chunks);
      
      // gzip圧縮されている場合は解凍
      const encoding = response.headers['content-encoding'];
      if (encoding === 'gzip') {
        buffer = zlib.gunzipSync(buffer);
      } else if (encoding === 'deflate') {
        buffer = zlib.inflateSync(buffer);
      } else if (encoding === 'br') {
        buffer = zlib.brotliDecompressSync(buffer);
      }
      
      const data = buffer.toString('utf-8');
      console.log('Body length:', data.length);
      console.log('Body preview:', data.substring(0, 200));
      
      if (response.statusCode === 200) {
        const json = JSON.parse(data);
        console.log('\nTotal submissions:', json.length);
        if (json.length > 0) {
          console.log('First submission:', json[0]);
        }
      }
    } catch (error) {
      console.error('Processing error:', error.message);
    }
  });
});

request.on('error', (error) => {
  console.error('Request error:', error);
});

request.end();
