const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const Room = require('./models/Room');
const grammarScore = require('./utils/grammarScore');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://127.0.0.1:27017/storygame', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

function generateRoomCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// REST: Create Room
app.post('/api/room', async (req, res) => {
  const code = generateRoomCode();
  const room = await Room.create({ code, players: [req.body.playerName] });
  res.json({ roomCode: code });
});

// REST: Join Room
app.post('/api/join', async (req, res) => {
  const { roomCode, playerName } = req.body;
  const room = await Room.findOne({ code: roomCode, isActive: true });
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (!room.players.includes(playerName)) room.players.push(playerName);
  await room.save();
  res.json({ success: true });
});

// Start Express and Socket.io
server.listen(5000, () => console.log('Server running on port 5000'));

// --- REAL-TIME via Socket.io ---
io.on('connection', (socket) => {
  socket.on('join-room', async ({ roomCode, playerName }) => {
    socket.join(roomCode);
    socket.to(roomCode).emit('player-joined', playerName);
  });

  socket.on('submit-sentence', async ({ roomCode, sentence, playerName }) => {
    const score = await grammarScore(sentence);
    const room = await Room.findOne({ code: roomCode, isActive: true });
    if (room) {
      room.story.push({ text: sentence, playerName, score });
      let playerScore = room.scores.find(s => s.player === playerName);
      if (playerScore) playerScore.score += score;
      else room.scores.push({ player: playerName, score });
      await room.save();
      io.in(roomCode).emit('new-sentence', { sentence, playerName, score, scores: room.scores });
    }
  });

  socket.on('end-game', async ({ roomCode }) => {
    const room = await Room.findOne({ code: roomCode });
    if (room) {
      room.isActive = false;
      await room.save();
      io.in(roomCode).emit('game-ended', { story: room.story, scores: room.scores });
    }
  });
});
