const menu = document.getElementById("menu");
const matchmaking = document.getElementById("matchmaking");
const gameDiv = document.getElementById("game");
const playBtn = document.getElementById("playBtn");
const gameStatus = document.getElementById("gameStatus");
const canvas = document.getElementById("pong");
const ctx = canvas.getContext("2d");

// ----------- Chat Setup -----------
let chatDiv = null;
let chatList = null;
let chatForm = null;
let chatInput = null;
let chatOpen = false;
let openChatBtn = null;
let closeChatBtn = null;

function setupChatUI() {
  if (chatDiv) return;
  chatDiv = document.createElement("div");
  chatDiv.id = "chatDiv";
  chatDiv.style.position = "absolute";
  chatDiv.style.top = "24px";
  chatDiv.style.right = "24px";
  chatDiv.style.width = "300px";
  chatDiv.style.height = "calc(100% - 48px)";
  chatDiv.style.background = "#1a1a1a";
  chatDiv.style.borderRadius = "8px";
  chatDiv.style.boxShadow = "0 2px 8px #0003";
  chatDiv.style.display = "flex";
  chatDiv.style.flexDirection = "column";
  chatDiv.style.zIndex = "200";

  // Close chat button
  closeChatBtn = document.createElement("button");
  closeChatBtn.textContent = "×";
  closeChatBtn.title = "Close chat";
  closeChatBtn.style.position = "absolute";
  closeChatBtn.style.top = "8px";
  closeChatBtn.style.left = "8px";
  closeChatBtn.style.background = "#333";
  closeChatBtn.style.color = "#fff";
  closeChatBtn.style.border = "none";
  closeChatBtn.style.borderRadius = "50%";
  closeChatBtn.style.width = "28px";
  closeChatBtn.style.height = "28px";
  closeChatBtn.style.fontSize = "20px";
  closeChatBtn.style.cursor = "pointer";
  closeChatBtn.style.zIndex = "210";
  closeChatBtn.onclick = () => {
    showChat(false);
  };
  chatDiv.appendChild(closeChatBtn);

  // Messages list
  chatList = document.createElement("div");
  chatList.id = "chatList";
  chatList.style.flex = "1";
  chatList.style.overflowY = "auto";
  chatList.style.padding = "36px 12px 12px 12px";

  // Form
  chatForm = document.createElement("form");
  chatForm.style.display = "flex";
  chatForm.style.padding = "8px";
  chatInput = document.createElement("input");
  chatInput.type = "text";
  chatInput.placeholder = "Type message...";
  chatInput.style.flex = "1";
  chatInput.style.borderRadius = "4px";
  chatInput.style.border = "none";
  chatInput.style.padding = "8px";
  chatInput.style.marginRight = "8px";
  chatInput.style.background = "#222";
  chatInput.style.color = "#fff";
  chatForm.appendChild(chatInput);
  const sendBtn = document.createElement("button");
  sendBtn.type = "submit";
  sendBtn.textContent = "Send";
  sendBtn.style.background = "#1976D2";
  sendBtn.style.color = "#fff";
  sendBtn.style.border = "none";
  sendBtn.style.borderRadius = "4px";
  sendBtn.style.padding = "8px 16px";
  chatForm.appendChild(sendBtn);

  chatDiv.appendChild(chatList);
  chatDiv.appendChild(chatForm);

  document.body.appendChild(chatDiv);

  chatForm.onsubmit = function (e) {
    e.preventDefault();
    let msg = chatInput.value.trim();
    if (!msg) return;
    socket.emit("chat_message", { room: currentRoom, message: msg });
    chatInput.value = "";
  };
}
function showChat(show) {
  chatOpen = show;
  document.body.classList.toggle("chat-open", chatOpen);
  if (!chatDiv) return;
  chatDiv.style.display = show ? "flex" : "none";
  if (show) {
    if (openChatBtn) openChatBtn.style.display = "none";
    updateGameDivPosition();
    setTimeout(() => chatInput && chatInput.focus(), 200);
  } else {
    if (openChatBtn) openChatBtn.style.display = "block";
    updateGameDivPosition();
  }
}
function addChatMessage({ text, color = "#fff", author = "", italic = false }) {
  if (!chatList) return;
  const msgDiv = document.createElement("div");
  msgDiv.textContent = (author ? author + ": " : "") + text;
  msgDiv.style.color = color;
  msgDiv.style.margin = "4px 0";
  if (italic) msgDiv.style.fontStyle = "italic";
  chatList.appendChild(msgDiv);
  chatList.scrollTop = chatList.scrollHeight;
}
function setupOpenChatBtn() {
  if (openChatBtn) return;
  openChatBtn = document.createElement("button");
  openChatBtn.textContent = "💬";
  openChatBtn.id = "openChatBtn";
  openChatBtn.title = "Open chat";
  openChatBtn.style.position = "absolute";
  openChatBtn.style.top = "32px";
  openChatBtn.style.right = "24px";
  openChatBtn.style.background = "#1976D2";
  openChatBtn.style.color = "#fff";
  openChatBtn.style.fontSize = "1.2em";
  openChatBtn.style.padding = "12px 24px";
  openChatBtn.style.border = "none";
  openChatBtn.style.borderRadius = "6px";
  openChatBtn.style.boxShadow = "0 2px 8px #0003";
  openChatBtn.style.cursor = "pointer";
  openChatBtn.style.zIndex = "110";
  openChatBtn.onclick = () => {
    showChat(true);
  };
  document.body.appendChild(openChatBtn);
  openChatBtn.style.display = "none";
}

// ----------- Disconnect Button Setup -----------
let disconnectBtn = null;
function addDisconnectButton() {
  if (disconnectBtn) return;
  disconnectBtn = document.createElement("button");
  disconnectBtn.textContent = "Disconnect";
  disconnectBtn.id = "disconnectBtn";
  disconnectBtn.style.position = "absolute";
  disconnectBtn.style.top = "32px";
  disconnectBtn.style.left = "24px";
  disconnectBtn.style.background = "#D32F2F";
  disconnectBtn.style.color = "#fff";
  disconnectBtn.style.fontSize = "1em";
  disconnectBtn.style.padding = "12px 28px";
  disconnectBtn.style.marginRight = "18px";
  disconnectBtn.style.border = "none";
  disconnectBtn.style.borderRadius = "6px";
  disconnectBtn.style.boxShadow = "0 2px 8px #0003";
  disconnectBtn.style.cursor = "pointer";
  disconnectBtn.style.zIndex = "100";
  disconnectBtn.style.display = "block";
  disconnectBtn.onclick = () => {
    socket.disconnect();
    gameStatus.textContent = "You disconnected.";
    addChatMessage({
      text: "You disconnected.",
      color: "#D32F2F",
      italic: true,
    });
    gameActive = false;
    disconnectBtn.style.display = "none";
    showPauseButton(false, false);
    pauseBtn = null;
    showChat(false);
    gameDiv.classList.add("hidden");
    menu.classList.remove("hidden");
  };
  document.body.appendChild(disconnectBtn);
}
function showDisconnectButton(show) {
  if (!disconnectBtn) return;
  disconnectBtn.style.display = show ? "block" : "none";
}

// ----------- Pause/Resume Button Setup -----------
let pauseBtn = null;
function addPauseButton() {
  if (pauseBtn) return;
  pauseBtn = document.createElement("button");
  pauseBtn.textContent = "Pause";
  pauseBtn.id = "pauseBtn";
  pauseBtn.style.position = "absolute";
  pauseBtn.style.top = "32px";
  pauseBtn.style.right = chatOpen ? "340px" : "90px";
  pauseBtn.style.background = "#1976D2";
  pauseBtn.style.color = "#fff";
  pauseBtn.style.fontSize = "1em";
  pauseBtn.style.padding = "12px 28px";
  pauseBtn.style.marginRight = "18px";
  pauseBtn.style.border = "none";
  pauseBtn.style.borderRadius = "6px";
  pauseBtn.style.boxShadow = "0 2px 8px #0003";
  pauseBtn.style.cursor = "pointer";
  pauseBtn.style.zIndex = "100";
  pauseBtn.style.display = "block";
  pauseBtn.disabled = false;
  pauseBtn.onclick = () => {
    if (pauseBtn.disabled) return;
    pauseBtn.disabled = true;
    socket.emit(gamePaused ? "resume_vote" : "pause_vote", {
      room: currentRoom,
    });
  };
  document.body.appendChild(pauseBtn);
}
function showPauseButton(show, pausedState) {
  if (!pauseBtn) return;
  pauseBtn.style.display = show ? "block" : "none";
  pauseBtn.textContent = pausedState ? "Resume" : "Pause";
  pauseBtn.disabled = false;
  pauseBtn.style.right = chatOpen ? "340px" : "90px";
}

// ----------- GameDiv Positioning -----------
function updateGameDivPosition() {
  // If chat is open, push gameDiv/canvas a little left
  if (chatOpen) {
    gameDiv.style.left = "calc(50% - 120px)";
    gameDiv.style.transform = "translateX(-50%)";
  } else {
    gameDiv.style.left = "50%";
    gameDiv.style.transform = "translateX(-50%)";
  }
  // Also update pauseBtn position if it exists
  if (pauseBtn) {
    pauseBtn.style.right = chatOpen ? "340px" : "90px";
  }
}

// Responsive Canvas
function resizeCanvas() {
  if (window.innerWidth < 800) {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  } else {
    canvas.width = 700;
    canvas.height = 400;
  }
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Socket.io Setup
const socket = io("http://localhost:3000");

let currentRoom = null;
let gameActive = false;
let myPaddleY = canvas.height / 2 - 40;
let opponentPaddleY = canvas.height / 2 - 40;
let ball = { x: canvas.width / 2, y: canvas.height / 2 };
let scores = [0, 0];
let isAI = false;
let gamePaused = false;

// Countdown logic
let countdownActive = false;
let countdownValue = null;
let countdownTimer = null;

function startLocalCountdown(n) {
  if (countdownActive) {
    clearInterval(countdownTimer);
  }
  countdownActive = true;
  countdownValue = n;
  gameStatus.textContent = `Resuming in ${countdownValue}...`;
  //addChatMessage({
  //  text: `Resuming in ${countdownValue}...`,
  //  color: "#FFD600",
  //  italic: true,
  //});
  pauseBtn.disabled = true;

  countdownTimer = setInterval(() => {
    countdownValue--;
    if (countdownValue > 0) {
      gameStatus.textContent = `Resuming in ${countdownValue}...`;
      //addChatMessage({
      //  text: `Resuming in ${countdownValue}...`,
      //  color: "#FFD600",
      //  italic: true,
      //});
    } else {
      clearInterval(countdownTimer);
      countdownActive = false;
    }
  }, 800);
}

// UI State Management
playBtn.addEventListener("click", () => {
  menu.classList.add("hidden");
  matchmaking.classList.remove("hidden");
  socket.connect();
  socket.emit("join_matchmaking");
  showDisconnectButton(false);
  showPauseButton(false, false);
  setupChatUI();
  setupOpenChatBtn();
  showChat(false);
  chatList.innerHTML = "";
  updateGameDivPosition();
});

// Matchmaking events
socket.on("waiting_for_opponent", () => {
  matchmaking.querySelector("p").textContent =
    "Waiting for opponent. Please wait.";
});
socket.on("match_found", (data) => {
  currentRoom = data.room;
  matchmaking.classList.add("hidden");
  gameDiv.classList.remove("hidden");
  gameStatus.textContent = "Game Started!";
  gameActive = true;
  isAI = false;
  addDisconnectButton();
  showDisconnectButton(true);
  addPauseButton();
  showPauseButton(true, false);
  gamePaused = false;
  setupChatUI();
  setupOpenChatBtn();
  showChat(true);
  chatList.innerHTML = "";
  addChatMessage({ text: "Game Started!", color: "#00ff00", italic: true });
  updateGameDivPosition();
});

// Opponent disconnect
socket.on("opponent_disconnected", () => {
  gameStatus.textContent = "Opponent disconnected. AI will take over!";
  isAI = true;
});

// Pause/Resume events
socket.on("pause_pending_other", () => {
  gameStatus.textContent =
    "Pause vote received. Waiting for other player to vote...";
  pauseBtn.disabled = true;
});
socket.on("pause_pending_ball", () => {
  gameStatus.textContent =
    "Both players voted. Waiting for ball to hit wall...";
  pauseBtn.disabled = true;
});
socket.on("paused", () => {
  gamePaused = true;
  gameStatus.textContent = "Game paused. Waiting for both players to resume.";
  showPauseButton(true, true);
  pauseBtn.disabled = false;
});
socket.on("resume_pending", () => {
  gameStatus.textContent = "Resume vote received. Waiting for both players...";
  pauseBtn.disabled = true;
});
socket.on("countdown", (n) => {
  startLocalCountdown(n);
});
socket.on("resumed", () => {
  countdownActive = false;
  countdownValue = null;
  clearInterval(countdownTimer);
  gamePaused = false;
  gameStatus.textContent = "Game resumed!";
  showPauseButton(true, false);
  pauseBtn.disabled = false;
});

// Chat message event from server
socket.on("chat_message", ({ text, author, color }) => {
  addChatMessage({ text, author, color: color || "#fff" });
});

// Receive game state from backend
socket.on("game_state", (state) => {
  ball.x = state.ball.x;
  ball.y = state.ball.y;
  myPaddleY = state.myPaddle;
  opponentPaddleY = state.opponentPaddle;
  scores = state.scores;
  render();
});

// Handle socket disconnect
socket.on("disconnect", () => {
  showDisconnectButton(false);
  showPauseButton(false, false);
  pauseBtn = null;
  showChat(false);
  if (chatList)
    addChatMessage({
      text: "Disconnected from server.",
      color: "#D32F2F",
      italic: true,
    });
  countdownActive = false;
  countdownValue = null;
  clearInterval(countdownTimer);
  updateGameDivPosition();
});

// Paddle Movement (send only local paddle)
canvas.addEventListener("mousemove", (evt) => {
  if (!gameActive || gamePaused) return;
  const rect = canvas.getBoundingClientRect();
  let y = evt.clientY - rect.top - 40;
  y = Math.max(0, Math.min(canvas.height - 80, y));
  myPaddleY = y;
  if (currentRoom && socket.connected) {
    socket.emit("paddle_move", { room: currentRoom, y: myPaddleY });
  }
});

// Rendering Function
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#232323";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#eee";
  const netWidth = 3,
    netHeight = 20,
    gap = 15;
  for (let i = 0; i < canvas.height; i += netHeight + gap) {
    ctx.fillRect(canvas.width / 2 - netWidth / 2, i, netWidth, netHeight);
  }

  ctx.fillStyle = "#4CAF50";
  ctx.fillRect(10, myPaddleY, 12, 80);

  ctx.fillStyle = "#F44336";
  ctx.fillRect(canvas.width - 22, opponentPaddleY, 12, 80);

  ctx.fillStyle = "#FFD600";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, 10, 0, Math.PI * 2, false);
  ctx.closePath();
  ctx.fill();

  ctx.font = "32px Arial";
  ctx.fillStyle = "#eee";
  ctx.textAlign = "center";
  ctx.fillText(scores[0], canvas.width / 2 - 50, 50);
  ctx.fillText(scores[1], canvas.width / 2 + 50, 50);
}

render();
