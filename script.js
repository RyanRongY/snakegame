const canvas = document.getElementById("game-board");
const ctx = canvas.getContext("2d");

const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const playerNameInput = document.getElementById("player-name");
const speedSlider = document.getElementById("speed-slider");
const speedValue = document.getElementById("speed-value");
const obstacleToggle = document.getElementById("obstacle-toggle");
const obstacleLimitInput = document.getElementById("obstacle-limit");

const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("high-score");
const leaderboardList = document.getElementById("leaderboard-list");

const overlay = document.getElementById("overlay");
const overlayMessage = document.getElementById("status-message");
const overlayRestartBtn = document.getElementById("overlay-restart");
const snakeImage = new Image();

const GRID_SIZE = 20;
const CELL_SIZE = canvas.width / GRID_SIZE;
const SPEED_MIN_MS = 70;
const SPEED_MAX_MS = 220;
const SPEED_LABELS = [
  "Snail",
  "Leisurely",
  "Slow",
  "Steady",
  "Medium",
  "Brisk",
  "Quick",
  "Fast",
  "Swift",
  "Lightning",
];
const KEY_DIRECTION_MAP = new Map([
  ["ArrowUp", { x: 0, y: -1 }],
  ["ArrowDown", { x: 0, y: 1 }],
  ["ArrowLeft", { x: -1, y: 0 }],
  ["ArrowRight", { x: 1, y: 0 }],
  ["w", { x: 0, y: -1 }],
  ["s", { x: 0, y: 1 }],
  ["a", { x: -1, y: 0 }],
  ["d", { x: 1, y: 0 }],
]);
const LOCAL_STORAGE_KEY = "snake-game-high-score";
const LEADERBOARD_KEY = "snake-game-leaderboard";
const LEADERBOARD_SIZE = 5;

let snake = [];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let food = null;
let obstacles = [];
let score = 0;
let highScore = Number(localStorage.getItem(LOCAL_STORAGE_KEY)) || 0;
let leaderboard = loadLeaderboard();

let isRunning = false;
let isPaused = false;
let animationFrameId = null;
let lastTick = 0;
let snakeImageReady = false;

document.addEventListener("keydown", handleDirectionChange);
startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", () => {
  resetGame();
  startGame();
});
overlayRestartBtn.addEventListener("click", () => {
  resetGame();
  startGame();
});
canvas.addEventListener("click", handleCanvasClick);
overlay.addEventListener("click", (event) => {
  if (event.target === overlay) {
    handleCanvasClick();
  }
});
snakeImage.addEventListener("load", () => {
  snakeImageReady = true;
  draw();
});
snakeImage.src = "snake.png";

speedSlider.addEventListener("input", () => {
  updateSpeedLabel();
  lastTick = 0; // force immediate tick at new speed
});

obstacleToggle.addEventListener("change", () => {
  if (obstacleToggle.checked) {
    regenerateObstacles();
  } else {
    obstacles = [];
  }
  draw();
});

obstacleLimitInput.addEventListener("change", () => {
  const value = sanitizeObstacleLimit();
  obstacleLimitInput.value = value;
  if (obstacleToggle.checked) {
    regenerateObstacles();
    draw();
  }
});

function resetGame() {
  isRunning = false;
  isPaused = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  snake = [
    { x: 8, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 10 },
  ];
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  score = 0;
  scoreEl.textContent = score;
  highScoreEl.textContent = highScore;
  obstacles = [];

  if (obstacleToggle.checked) {
    regenerateObstacles();
  }

  placeFood();
  draw();
  showOverlay("Press Start or click the board to begin", false);
}

function startGame() {
  if (!isRunning) {
    hideOverlay();
    isRunning = true;
    isPaused = false;
    lastTick = 0;
    animationFrameId = requestAnimationFrame(gameLoop);
    return;
  }

  if (isPaused) {
    isPaused = false;
    hideOverlay();
    lastTick = 0;
  }
}

function gameLoop(timestamp) {
  if (!isRunning) return;

  if (isPaused) {
    animationFrameId = requestAnimationFrame(gameLoop);
    return;
  }

  const interval = currentSpeedMs();
  if (timestamp - lastTick >= interval) {
    update();
    draw();
    lastTick = timestamp;
  }

  animationFrameId = requestAnimationFrame(gameLoop);
}

function update() {
  direction = nextDirection;
  const head = { ...snake[0] };
  head.x += direction.x;
  head.y += direction.y;

  if (hitWall(head)) {
    return endGame("You hit the wall!");
  }

  if (hitsSelf(head)) {
    return endGame("You ran into yourself!");
  }

  if (hitsObstacle(head)) {
    return endGame("You hit an obstacle!");
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 1;
    scoreEl.textContent = score;
    if (score > highScore) {
      highScore = score;
      highScoreEl.textContent = highScore;
      localStorage.setItem(LOCAL_STORAGE_KEY, String(highScore));
    }
    placeFood();
  } else {
    snake.pop();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawGrid();
  drawFood();
  drawObstacles();
  drawSnake();
}

function drawGrid() {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= GRID_SIZE; i += 1) {
    const position = i * CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(position, 0);
    ctx.lineTo(position, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, position);
    ctx.lineTo(canvas.width, position);
    ctx.stroke();
  }
}

function drawSnake() {
  snake.forEach((segment) => {
    const x = segment.x * CELL_SIZE;
    const y = segment.y * CELL_SIZE;
    if (snakeImageReady) {
      ctx.drawImage(snakeImage, x, y, CELL_SIZE, CELL_SIZE);
    } else {
      ctx.fillStyle = "#10b981";
      ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }
  });
}

function drawFood() {
  ctx.fillStyle = "#f87171";
  ctx.beginPath();
  ctx.arc(
    food.x * CELL_SIZE + CELL_SIZE / 2,
    food.y * CELL_SIZE + CELL_SIZE / 2,
    CELL_SIZE / 2 - 3,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function drawObstacles() {
  ctx.fillStyle = "#6366f1";
  obstacles.forEach((obstacle) => {
    ctx.fillRect(
      obstacle.x * CELL_SIZE + 2,
      obstacle.y * CELL_SIZE + 2,
      CELL_SIZE - 4,
      CELL_SIZE - 4
    );
  });
}

function placeFood() {
  const freeCells = [];
  for (let x = 0; x < GRID_SIZE; x += 1) {
    for (let y = 0; y < GRID_SIZE; y += 1) {
      if (isCellFree(x, y)) {
        freeCells.push({ x, y });
      }
    }
  }

  if (!freeCells.length) {
    endGame("You win! No space left.");
    return;
  }

  const randomIndex = Math.floor(Math.random() * freeCells.length);
  food = freeCells[randomIndex];
}

function regenerateObstacles() {
  obstacles = [];
  const target = sanitizeObstacleLimit();
  const freeCells = [];

  for (let x = 0; x < GRID_SIZE; x += 1) {
    for (let y = 0; y < GRID_SIZE; y += 1) {
      if (!snake.some((segment) => segment.x === x && segment.y === y)) {
        freeCells.push({ x, y });
      }
    }
  }

  shuffleArray(freeCells);

  for (let i = 0; i < target && i < freeCells.length; i += 1) {
    obstacles.push(freeCells[i]);
  }

  if (food && obstacles.some((cell) => cell.x === food.x && cell.y === food.y)) {
    placeFood();
  }
}

function isCellFree(x, y) {
  const occupiedBySnake = snake.some((segment) => segment.x === x && segment.y === y);
  const occupiedByObstacle = obstacles.some((obstacle) => obstacle.x === x && obstacle.y === y);
  return !occupiedBySnake && !occupiedByObstacle;
}

function hitWall(position) {
  return (
    position.x < 0 ||
    position.y < 0 ||
    position.x >= GRID_SIZE ||
    position.y >= GRID_SIZE
  );
}

function hitsSelf(position) {
  return snake.slice(1).some((segment) => segment.x === position.x && segment.y === position.y);
}

function hitsObstacle(position) {
  return obstacles.some((obstacle) => obstacle.x === position.x && obstacle.y === position.y);
}

function handleDirectionChange(event) {
  const key = event.key;

  if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, button")) {
    return;
  }

  if (key === "p" || key === "P") {
    event.preventDefault();
    togglePause();
    return;
  }

  const normalizedKey = key.length === 1 ? key.toLowerCase() : key;
  const newDirection = KEY_DIRECTION_MAP.get(normalizedKey);

  if (!newDirection) {
    return;
  }

  event.preventDefault();
  if (isPaused) {
    return;
  }

  const isOpposite = newDirection.x === -direction.x && newDirection.y === -direction.y;
  if (!isOpposite) {
    nextDirection = newDirection;
  }
}

function endGame(message) {
  isRunning = false;
  isPaused = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (score > 0) {
    recordScore(score);
  }
  showOverlay(message, true);
}

function togglePause() {
  if (!isRunning) {
    return;
  }

  isPaused = !isPaused;
  if (isPaused) {
    showOverlay("Paused – press P, click the board, or Start to resume", false);
  } else {
    hideOverlay();
    lastTick = 0;
  }
}

function handleCanvasClick() {
  if (!isRunning) {
    startGame();
    return;
  }

  if (isPaused) {
    startGame();
    return;
  }

  togglePause();
}

function showOverlay(message, showRestartButton) {
  overlayMessage.textContent = message;
  overlayRestartBtn.style.display = showRestartButton ? "inline-flex" : "none";
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function currentSpeedMs() {
  const min = Number(speedSlider.min);
  const max = Number(speedSlider.max);
  const value = Number(speedSlider.value);
  const ratio = (value - min) / (max - min || 1);
  const interval = SPEED_MAX_MS - ratio * (SPEED_MAX_MS - SPEED_MIN_MS);
  return interval;
}

function updateSpeedLabel() {
  const index = Number(speedSlider.value) - Number(speedSlider.min);
  speedValue.textContent = SPEED_LABELS[index] || "Medium";
}

function sanitizeObstacleLimit() {
  const raw = parseInt(obstacleLimitInput.value, 10);
  if (Number.isNaN(raw) || raw < 0) return 0;
  return Math.min(raw, 100);
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function loadLeaderboard() {
  try {
    const stored = localStorage.getItem(LEADERBOARD_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          typeof entry.name === "string" &&
          typeof entry.score === "number"
      )
      .slice(0, LEADERBOARD_SIZE);
  } catch {
    return [];
  }
}

function saveLeaderboard() {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard));
}

function recordScore(finalScore) {
  const rawName = playerNameInput.value.trim();
  const name = rawName ? rawName : "Player";
  const entry = { name, score: finalScore, timestamp: Date.now() };
  leaderboard.push(entry);
  leaderboard.sort((a, b) => {
    if (b.score === a.score) {
      return a.timestamp - b.timestamp;
    }
    return b.score - a.score;
  });
  leaderboard = leaderboard.slice(0, LEADERBOARD_SIZE);
  saveLeaderboard();
  renderLeaderboard();
}

function renderLeaderboard() {
  leaderboardList.innerHTML = "";
  if (!leaderboard.length) {
    const item = document.createElement("li");
    item.className = "empty";
    item.textContent = "No scores yet";
    leaderboardList.appendChild(item);
    return;
  }

  leaderboard.forEach((entry) => {
    const item = document.createElement("li");
    const scoreSpan = document.createElement("span");
    scoreSpan.className = "score";
    scoreSpan.textContent = entry.score;

    const nameSpan = document.createElement("span");
    nameSpan.className = "name";
    nameSpan.textContent = entry.name;

    item.append(scoreSpan, nameSpan);
    leaderboardList.appendChild(item);
  });
}

updateSpeedLabel();
renderLeaderboard();
resetGame();
