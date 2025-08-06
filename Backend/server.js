const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const PORT = 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:4000",
    methods: ["GET", "POST"],
  },
});

// Game rooms
let waitingPlayer = null;
const games = {}; // roomName -> game state

function createGame(room, player1, player2) {
  return {
    room,
    players: [player1, player2],
    paddles: [200, 200], // y positions
    aiActive: [false, false],
    ball: { x: 350, y: 200, vx: 5, vy: 5 },
    scores: [0, 0],
    paused: false,
    pauseVotes: [false, false],
    resumeVotes: [false, false],
    pendingPause: false,
    pendingResume: false,
  };
}

io.on("connection", (socket) => {
  // Matchmaking
  socket.on("join_matchmaking", () => {
    if (waitingPlayer) {
      const roomName = `game_${waitingPlayer.id}_${socket.id}`;
      waitingPlayer.join(roomName);
      socket.join(roomName);

      games[roomName] = createGame(roomName, waitingPlayer.id, socket.id);

      io.to(roomName).emit("match_found", {
        room: roomName,
        playerIds: [waitingPlayer.id, socket.id],
      });
      waitingPlayer = null;

      startGameLoop(roomName);
    } else {
      waitingPlayer = socket;
      socket.emit("waiting_for_opponent");
    }
  });

  // Paddle movement
  socket.on("paddle_move", ({ room, y }) => {
    const game = games[room];
    if (!game || game.paused) return;
    const playerIdx = game.players.indexOf(socket.id);
    if (playerIdx === -1) return;
    game.paddles[playerIdx] = y;
  });

  // Pause voting with solo player auto-confirm and vote timeout
  socket.on("pause_vote", ({ room }) => {
    const game = games[room];
    if (!game || game.paused || game.pendingPause) return;

    const playerIdx = game.players.indexOf(socket.id);
    if (playerIdx === -1) return;

    game.pauseVotes[playerIdx] = true;

    const connectedPlayers = game.players.filter((id) =>
      io.sockets.sockets.get(id)
    );
    const isSolo = connectedPlayers.length === 1;

    if (isSolo) {
      game.pendingPause = true;

      socket.emit("chat_message", {
        text: "Pause vote auto-confirmed (no other player connected).",
        author: "",
        color: "#FFD600",
      });
      socket.emit("chat_message", {
        text: `Pause votes: 1/1`,
        author: "",
        color: "#FFD600",
      });

      io.to(room).emit("pause_pending_ball");
      return;
    }

    const votes = game.pauseVotes.filter(Boolean).length;
    const otherPlayerId = game.players[1 - playerIdx];

    socket.emit("chat_message", {
      text: "Pause vote sent. Waiting for the other player to vote...",
      author: "",
      color: "#FFD600",
    });
    socket.emit("chat_message", {
      text: `Pause votes: ${votes}/2`,
      author: "",
      color: "#FFD600",
    });

    io.to(otherPlayerId).emit("chat_message", {
      text: "Pause vote received. Press pause to vote.",
      author: "",
      color: "#FFD600",
    });
    io.to(otherPlayerId).emit("chat_message", {
      text: `Pause votes: ${votes}/2`,
      author: "",
      color: "#FFD600",
    });

    // Set timeout to clear votes after 60 seconds
    if (game.pauseVoteTimeout) clearTimeout(game.pauseVoteTimeout);
    game.pauseVoteTimeout = setTimeout(() => {
      game.pauseVotes = [false, false];
      io.to(room).emit("chat_message", {
        text: "Pause vote expired after 60 seconds.",
        author: "",
        color: "#FFD600",
      });
    }, 60000);

    if (game.pauseVotes[0] && game.pauseVotes[1]) {
      clearTimeout(game.pauseVoteTimeout);
      game.pauseVoteTimeout = null;

      game.pendingPause = true;
      io.to(room).emit("pause_pending_ball");
    } else {
      socket.emit("pause_pending_other");
    }
  });

  // Resume voting with solo player auto-confirm and vote timeout
  socket.on("resume_vote", ({ room }) => {
    const game = games[room];
    if (!game || !game.paused || game.pendingResume) return;

    const playerIdx = game.players.indexOf(socket.id);
    if (playerIdx === -1) return;

    game.resumeVotes[playerIdx] = true;

    const connectedPlayers = game.players.filter((id) =>
      io.sockets.sockets.get(id)
    );
    const isSolo = connectedPlayers.length === 1;

    if (isSolo) {
      game.pendingResume = true;

      socket.emit("chat_message", {
        text: "Resume vote auto-confirmed (no other player connected).",
        author: "",
        color: "#FFD600",
      });
      socket.emit("chat_message", {
        text: `Resume votes: 1/1`,
        author: "",
        color: "#FFD600",
      });

      socket.emit("resume_pending");
      return;
    }

    const votes = game.resumeVotes.filter(Boolean).length;
    const otherPlayerId = game.players[1 - playerIdx];

    socket.emit("chat_message", {
      text: "Resume vote sent. Waiting for the other player to vote...",
      author: "",
      color: "#FFD600",
    });
    socket.emit("chat_message", {
      text: `Resume votes: ${votes}/2`,
      author: "",
      color: "#FFD600",
    });

    io.to(otherPlayerId).emit("chat_message", {
      text: "Resume vote received. Press resume to vote.",
      author: "",
      color: "#FFD600",
    });
    io.to(otherPlayerId).emit("chat_message", {
      text: `Resume votes: ${votes}/2`,
      author: "",
      color: "#FFD600",
    });

    // Set timeout to clear votes after 60 seconds
    if (game.resumeVoteTimeout) clearTimeout(game.resumeVoteTimeout);
    game.resumeVoteTimeout = setTimeout(() => {
      game.resumeVotes = [false, false];
      io.to(room).emit("chat_message", {
        text: "Resume vote expired after 60 seconds.",
        author: "",
        color: "#FFD600",
      });
    }, 60000);

    socket.emit("resume_pending");

    if (game.resumeVotes[0] && game.resumeVotes[1]) {
      clearTimeout(game.resumeVoteTimeout);
      game.resumeVoteTimeout = null;

      game.pendingResume = true;
    }
  });

  // Chat messages
  socket.on("chat_message", ({ room, message }) => {
    const game = games[room];
    if (!game) return;
    let author = "";
    const idx = game.players.indexOf(socket.id);
    if (idx === 0) author = "Player 1";
    else if (idx === 1) author = "Player 2";
    io.to(room).emit("chat_message", { text: message, author });
  });

  socket.on("disconnect", () => {
    // Remove from matchmaking
    if (waitingPlayer && waitingPlayer.id === socket.id) {
      waitingPlayer = null;
    }

    // Loop through all games
    for (const [room, game] of Object.entries(games)) {
      const idx = game.players.indexOf(socket.id);
      if (idx === -1) continue;

      // Mark disconnected player as AI-controlled
      game.aiActive[idx] = true;

      io.to(room).emit("opponent_disconnected");
      io.to(room).emit("chat_message", {
        text: "Opponent disconnected. AI will take over!",
        author: "",
        color: "#D32F2F",
      });

      const otherIdx = 1 - idx;

      // If a pause vote was in progress and the remaining player had voted
      if (!game.paused && game.pauseVotes?.[otherIdx] && !game.pendingPause) {
        game.pendingPause = true;
        game.pauseVotes = [false, false];
        if (game.pauseVoteTimeout) clearTimeout(game.pauseVoteTimeout);
        game.pauseVoteTimeout = null;

        io.to(room).emit("chat_message", {
          text: "Pause vote auto-confirmed (opponent disconnected).",
          author: "",
          color: "#FFD600",
        });
        io.to(room).emit("pause_pending_ball");
      }

      // If a resume vote was in progress and the remaining player had voted
      if (game.paused && game.resumeVotes?.[otherIdx] && !game.pendingResume) {
        game.pendingResume = true;
        game.resumeVotes = [false, false];
        if (game.resumeVoteTimeout) clearTimeout(game.resumeVoteTimeout);
        game.resumeVoteTimeout = null;

        io.to(room).emit("chat_message", {
          text: "Resume vote auto-confirmed (opponent disconnected).",
          author: "",
          color: "#FFD600",
        });
        io.to(room).emit("resume_pending");
      }
    }
  });
});

function startGameLoop(room) {
  const FPS = 60;
  const game = games[room];
  let countdownActive = false;
  let ballPaused = false;

  game.speedMultiplier = 1;

  const speedIncreaseInterval = setInterval(() => {
    if (!games[room]) {
      clearInterval(speedIncreaseInterval);
      return;
    }
    game.speedMultiplier *= 1.01;
  }, 1000);

  let interval = setInterval(() => {
    if (!games[room]) {
      clearInterval(interval);
      clearInterval(speedIncreaseInterval);
      return;
    }

    if (game.pendingPause && !game.paused) {
      if (ballTouchingWall(game.ball)) {
        ballPaused = true;
        game.pendingPause = false;
        game.pauseVotes = [false, false];
        io.to(room).emit("paused");
        io.to(room).emit("chat_message", {
          text: "Game paused.",
          author: "",
          color: "#FFD600",
        });
      } else {
        io.to(room).emit("pause_pending_ball");
      }
    }

    if (ballPaused) {
      if (game.pendingResume && !countdownActive) {
        countdownActive = true;
        let n = 3;
        function emitCountdownTick() {
          io.to(room).emit("countdown", n);
          io.to(room).emit("chat_message", {
            text: `Resuming in ${n}...`,
            author: "",
            color: "#FFD600",
          });
          if (n > 1) {
            n--;
            setTimeout(emitCountdownTick, 800);
          } else {
            setTimeout(() => {
              ballPaused = false;
              game.pendingResume = false;
              game.resumeVotes = [false, false];
              io.to(room).emit("resumed");
              io.to(room).emit("chat_message", {
                text: "Game resumed!",
                author: "",
                color: "#00ff00",
              });
              countdownActive = false;
            }, 800);
          }
        }
        emitCountdownTick();
      }
    }

    if (!game.aiVelocities) game.aiVelocities = [0, 0];
    const aiMaxAcceleration = 1.2;
    const aiDampingToward = 0.9;
    const aiDampingTowardBall = 0.85;
    const aiErrorMargin = 10;
    const aiMaxSpeed = 15;

    for (let i = 0; i < 2; i++) {
      if (game.aiActive[i]) {
        const paddleCenter = game.paddles[i] + 40;
        const ballMovingTowardAI =
          (i === 0 && game.ball.vx < 0) || (i === 1 && game.ball.vx > 0);

        if (!ballMovingTowardAI) {
          const centerY = 160;
          const diff = centerY - paddleCenter;

          let acceleration = Math.max(
            -aiMaxAcceleration / 2,
            Math.min(aiMaxAcceleration / 2, diff * 0.3)
          );

          game.aiVelocities[i] = (game.aiVelocities[i] || 0) + acceleration;

          if (game.aiVelocities[i] > aiMaxSpeed / 2)
            game.aiVelocities[i] = aiMaxSpeed / 2;
          if (game.aiVelocities[i] < -aiMaxSpeed / 2)
            game.aiVelocities[i] = -aiMaxSpeed / 2;

          game.aiVelocities[i] *= aiDampingToward;

          game.paddles[i] += game.aiVelocities[i] * game.speedMultiplier * 0.5;

          game.paddles[i] = Math.max(0, Math.min(320, game.paddles[i]));
          continue;
        }

        const targetY =
          game.ball.y + (Math.random() * aiErrorMargin * 2 - aiErrorMargin);
        const diff = targetY - paddleCenter;

        let acceleration = Math.max(
          -aiMaxAcceleration,
          Math.min(aiMaxAcceleration, diff * 0.3)
        );

        game.aiVelocities[i] = (game.aiVelocities[i] || 0) + acceleration;

        if (game.aiVelocities[i] > aiMaxSpeed)
          game.aiVelocities[i] = aiMaxSpeed;
        if (game.aiVelocities[i] < -aiMaxSpeed)
          game.aiVelocities[i] = -aiMaxSpeed;

        game.aiVelocities[i] *= aiDampingTowardBall;

        game.paddles[i] += game.aiVelocities[i] * game.speedMultiplier;

        game.paddles[i] = Math.max(0, Math.min(320, game.paddles[i]));
      }
    }

    if (!ballPaused) {
      game.ball.x += game.ball.vx * game.speedMultiplier;
      game.ball.y += game.ball.vy * game.speedMultiplier;

      if (game.ball.y - 10 < 0 || game.ball.y + 10 > 400) {
        game.ball.vy *= -1;
      }

      if (
        game.ball.x - 10 < 22 &&
        game.ball.y > game.paddles[0] &&
        game.ball.y < game.paddles[0] + 80
      ) {
        game.ball.vx = Math.abs(game.ball.vx);
      }

      if (
        game.ball.x + 10 > 678 &&
        game.ball.y > game.paddles[1] &&
        game.ball.y < game.paddles[1] + 80
      ) {
        game.ball.vx = -Math.abs(game.ball.vx);
      }

      if (game.ball.x < 0 || game.ball.x > 700) {
        const scorer = game.ball.x < 0 ? 1 : 0;
        game.scores[scorer]++;
        ballPaused = true;
        resetBall(game);
        setTimeout(() => {
          ballPaused = false;
        }, 1000);
      }
    }

    const stateForP1 = {
      ball: mirrorBall(game.ball, false),
      myPaddle: game.paddles[0],
      opponentPaddle: game.paddles[1],
      scores: game.scores,
    };
    const stateForP2 = {
      ball: mirrorBall(game.ball, true),
      myPaddle: game.paddles[1],
      opponentPaddle: game.paddles[0],
      scores: [game.scores[1], game.scores[0]],
    };
    io.to(game.players[0]).emit("game_state", stateForP1);
    io.to(game.players[1]).emit("game_state", stateForP2);

    if (game.aiActive[0] && game.aiActive[1]) {
      clearInterval(interval);
      clearInterval(speedIncreaseInterval);
      delete games[room];
    }
  }, 1000 / FPS);
}

function resetBall(game, callback) {
  game.ball.x = 350;
  game.ball.y = 200;
  game.ball.vx = Math.random() > 0.5 ? 5 : -5;
  game.ball.vy = Math.random() > 0.5 ? 5 : -5;
  game.speedMultiplier = 1;
}

// Mirror ball for player 2
function mirrorBall(ball, flip) {
  if (!flip) return ball;
  return {
    x: 700 - ball.x,
    y: ball.y,
    vx: -ball.vx,
    vy: ball.vy,
  };
}

function ballTouchingWall(ball) {
  return ball.x - 10 < 0 || ball.x + 10 > 700;
}

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
