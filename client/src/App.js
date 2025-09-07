// client/src/App.js
import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import jsPDF from 'jspdf';
import './App.css';

const socket = io("http://localhost:5000"); // Change to your backend URL for deployment

function App() {
  const [step, setStep] = useState('menu');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [players, setPlayers] = useState([]);
  const [story, setStory] = useState([]);
  const [scores, setScores] = useState([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [gameEnded, setGameEnded] = useState(false);

  const endResults = useRef({});

  useEffect(() => {
    // Socket listeners
    socket.on('player-joined', name => setPlayers(p => [...p, name]));
    socket.on('new-sentence', ({ sentence, playerName, score, scores }) => {
      setStory(s => [...s, { text: sentence, playerName, score }]);
      setScores(scores);
      setCurrentTurn(t => (t + 1) % players.length);
    });
    socket.on('game-ended', ({ story, scores }) => {
      setStory(story);
      setScores(scores);
      endResults.current = { story, scores };
      setGameEnded(true);
      setStep('results');
    });
    // Clean up socket listeners
    return () => {
      socket.off('player-joined');
      socket.off('new-sentence');
      socket.off('game-ended');
    };
  }, [players.length]);

  function handleCreate() {
    if (!playerName) return;
    axios.post('http://localhost:5000/api/room', { playerName })
      .then(res => {
        setRoomCode(res.data.roomCode);
        setPlayers([playerName]);
        setStep('lobby');
        socket.emit('join-room', { roomCode: res.data.roomCode, playerName });
      });
  }

  function handleJoin() {
    if (!playerName || !roomCode) return;
    axios.post('http://localhost:5000/api/join', { roomCode, playerName })
      .then(() => {
        setPlayers([playerName]);
        setStep('lobby');
        socket.emit('join-room', { roomCode, playerName });
      }).catch(() => {
        alert('Room not found!');
      });
  }

  function handleStart() {
    setStep('game');
  }

  function submitSentence() {
    if (!inputValue.trim()) return;
    socket.emit('submit-sentence', { roomCode, sentence: inputValue, playerName });
    setInputValue('');
  }

  function endGame() {
    socket.emit('end-game', { roomCode });
  }

  function downloadPDF() {
    const doc = new jsPDF();
    doc.text('Story Memories', 10, 10);
    let y = 20;
    story.forEach(({ text, playerName, score }, idx) => {
      doc.text(`${idx + 1}. ${playerName}: ${text} (Score: ${score})`, 10, y);
      y += 10;
    });
    doc.text('Final Scores:', 10, y + 10);
    y += 20;
    scores.forEach(({ player, score }) => {
      doc.text(`${player}: ${score}`, 10, y);
      y += 10;
    });
    doc.save(`memories_${roomCode}.pdf`);
  }

  // UI Sections with styling classes
  if (step === 'menu') {
    return (
      <div className="menu-container">
        <h1>Story Game</h1>
        <input
          className="input-field"
          placeholder="Your name"
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
        />
        <br /><br />
        <button className="main-btn" onClick={handleCreate} disabled={!playerName}>
          Create Room
        </button>
        <br /><br />
        <input
          className="input-field"
          placeholder="Room Code"
          value={roomCode}
          onChange={e => setRoomCode(e.target.value.toUpperCase())}
        />
        <button className="main-btn" onClick={handleJoin} disabled={!playerName || !roomCode}>
          Join Room
        </button>
      </div>
    );
  }

  if (step === 'lobby') {
    return (
      <div className="lobby-container">
        <h2>Room: {roomCode}</h2>
        <p>
          Share this code with friends: <b>{roomCode}</b>
        </p>
        <div className="players-list">
          <strong>Players:</strong> {players.join(', ')}
        </div>
        <br />
        <button className="main-btn" onClick={handleStart} disabled={players.length < 1}>
          Start Game
        </button>
      </div>
    );
  }

  if (step === 'game') {
    return (
      <div className="game-container">
        <h2>Room: {roomCode}</h2>
        <div>
          <h4>Story so far:</h4>
          {story.map((part, idx) =>
            <div className="story-part" key={idx}>
              {idx + 1}. <b>{part.playerName}</b>: {part.text} (Score: {part.score})
            </div>
          )}
        </div>
        <br />
        <div className="current-turn">Current turn: {players[currentTurn]}</div>
        {players[currentTurn] === playerName && !gameEnded && (
          <>
            <input
              className="input-field"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="Type your sentence"
            />
            <button className="main-btn" onClick={submitSentence} disabled={!inputValue.trim()}>
              Submit
            </button>
          </>
        )}
        <br /><br />
        <button className="main-btn" onClick={endGame} disabled={gameEnded}>
          End Game
        </button>
        <div className="scoreboard">
          <h4>Scores:</h4>
          {scores.map((s, idx) => (
            <div key={idx} className="score-item">
              {s.player}: {s.score}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === 'results' || gameEnded) {
    return (
      <div className="results-container">
        <h2>Game Over!</h2>
        <div>
          <h4>Story:</h4>
          {story.map((part, idx) =>
            <div className="story-part" key={idx}>
              {idx + 1}. <b>{part.playerName}</b>: {part.text} (Score: {part.score})
            </div>
          )}
        </div>
        <br />
        <h3>Final Scores</h3>
        {scores.map((s, idx) => (
          <div key={idx} className="score-item">
            <b>{s.player}:</b> {s.score}
          </div>
        ))}
        <br />
        <button className="main-btn" onClick={downloadPDF}>Download Memories (PDF)</button>
        <br /><br />
        <button className="main-btn" onClick={() => window.location.reload()}>Restart</button>
      </div>
    );
  }

  return null;
}

export default App;
