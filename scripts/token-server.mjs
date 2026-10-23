import { roomGrant } from '../shared/livekit-grant.mjs'
// Token Server para desenvolvimento do ContalSpeak
// Gera tokens JWT do LiveKit para testes locais
import http from 'node:http';
import { AccessToken } from 'livekit-server-sdk';

const API_KEY = process.env.LIVEKIT_API_KEY || 'APloDkLmBTDG5T5';
const API_SECRET = process.env.LIVEKIT_API_SECRET || 'ahn9v2PgmEIJCxM1QQARYd1j39r76pq4bWrVx7KFCnD';
const PORT = parseInt(process.env.PORT || '3001', 10);

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (url.pathname === '/token' && (req.method === 'GET' || req.method === 'POST')) {
    const room = url.searchParams.get('room') || 'general';
    const identity = url.searchParams.get('identity') || `user-${Date.now()}`;
    const name = url.searchParams.get('name') || identity;

    try {
      const token = new AccessToken(API_KEY, API_SECRET, {
        identity,
        name,
        ttl: 3600,
      });
      token.addGrant(roomGrant(room));

      const jwt = await token.toJwt();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ token: jwt, room, identity, name }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', key: API_KEY }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found. Use /token?room=X&identity=Y' }));
});

server.listen(PORT, () => {
  console.log(`🔑 ContalSpeak Token Server running on http://localhost:${PORT}`);
  console.log(`   GET /token?room=geral&identity=usuario`);
  console.log(`   API Key: ${API_KEY}`);
});