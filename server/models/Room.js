const mongoose = require('mongoose');

const SentenceSchema = new mongoose.Schema({
  text: String,
  playerName: String,
  score: Number
});

const RoomSchema = new mongoose.Schema({
  code: String,
  players: [String],
  story: [SentenceSchema],
  scores: [{ player: String, score: Number }],
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('Room', RoomSchema);
