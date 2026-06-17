const COLS = 10;
const ROWS = 20;
const DROP_INTERVAL_MS = 800;

const LINE_SCORES = {
  1: 100,
  2: 300,
  3: 500,
  4: 800,
};

const PIECES = {
  I: {
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    color: "piece-i",
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: "piece-o",
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: "piece-t",
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    color: "piece-s",
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    color: "piece-z",
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: "piece-j",
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: "piece-l",
  },
};

const PIECE_TYPES = Object.keys(PIECES);
const DEFAULT_PIECE_TYPE = "T";

const boardElement = document.getElementById("game-board");
const scoreElement = document.getElementById("score");
const gameOverElement = document.getElementById("game-over");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");

let board = [];
let currentPiece = null;
let score = 0;
let dropTimerId = null;
let isGameRunning = false;
let isGameOver = false;
let keyboardControlsRegistered = false;

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function cloneBoard(sourceBoard) {
  return sourceBoard.map((row) => [...row]);
}

function isInsideBoard(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

function createPiece(type) {
  const pieceDef = PIECES[type] || PIECES[DEFAULT_PIECE_TYPE];
  const shape = pieceDef.shape.map((row) => [...row]);
  const spawnCol = Math.floor((COLS - shape[0].length) / 2);

  return {
    type: pieceDef === PIECES[type] ? type : DEFAULT_PIECE_TYPE,
    shape,
    row: 0,
    col: spawnCol,
    color: pieceDef.color,
  };
}

function canMove(piece, dx, dy, matrix) {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;

      const boardRow = piece.row + dy + r;
      const boardCol = piece.col + dx + c;

      if (boardCol < 0 || boardCol >= COLS) {
        return false;
      }

      if (boardRow >= ROWS) {
        return false;
      }

      if (boardRow >= 0 && matrix[boardRow][boardCol] !== null) {
        return false;
      }
    }
  }

  return true;
}

function tryMove(dx, dy) {
  if (!isGameRunning || !currentPiece) return false;

  if (!canMove(currentPiece, dx, dy, board)) {
    return false;
  }

  currentPiece.col += dx;
  currentPiece.row += dy;
  return true;
}

function rotateShape(shape) {
  const rows = shape.length;
  const cols = shape[0].length;
  const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rotated[c][rows - 1 - r] = shape[r][c];
    }
  }

  return rotated;
}

function tryRotate() {
  if (!isGameRunning || !currentPiece) return false;

  const originalShape = currentPiece.shape;
  currentPiece.shape = rotateShape(currentPiece.shape);

  if (!canMove(currentPiece, 0, 0, board)) {
    currentPiece.shape = originalShape;
    return false;
  }

  return true;
}

function lockPiece() {
  if (!currentPiece) return;

  for (let r = 0; r < currentPiece.shape.length; r++) {
    for (let c = 0; c < currentPiece.shape[r].length; c++) {
      if (!currentPiece.shape[r][c]) continue;

      const boardRow = currentPiece.row + r;
      const boardCol = currentPiece.col + c;

      if (isInsideBoard(boardRow, boardCol)) {
        board[boardRow][boardCol] = currentPiece.color;
      }
    }
  }
}

function clearLines() {
  const remainingRows = board.filter(
    (row) => !row.every((cell) => cell !== null)
  );
  const clearedLines = ROWS - remainingRows.length;

  while (remainingRows.length < ROWS) {
    remainingRows.unshift(Array(COLS).fill(null));
  }

  board = remainingRows;
  return clearedLines;
}

function addLineClearScore(clearedLines) {
  if (clearedLines === 0) return;

  const points = LINE_SCORES[clearedLines] || clearedLines * 100;
  updateScore(score + points);
}

function showGameOver(visible) {
  gameOverElement.classList.toggle("hidden", !visible);
}

function triggerGameOver() {
  stopDropLoop();
  isGameOver = true;
  isGameRunning = false;
  currentPiece = null;
  showGameOver(true);
  refreshDisplay();
}

function spawnNextPiece() {
  currentPiece = createPiece(pickRandomPieceType());

  if (!canMove(currentPiece, 0, 0, board)) {
    triggerGameOver();
    return false;
  }

  return true;
}

function lockAndAdvance() {
  if (!currentPiece) return;

  lockPiece();
  const clearedLines = clearLines();
  addLineClearScore(clearedLines);
  spawnNextPiece();
}

function moveDownOrLock() {
  if (!isGameRunning || !currentPiece || isGameOver) return;

  if (canMove(currentPiece, 0, 1, board)) {
    currentPiece.row += 1;
  } else {
    lockAndAdvance();
  }
}

function hardDrop() {
  if (!isGameRunning || !currentPiece || isGameOver) return;

  while (canMove(currentPiece, 0, 1, board)) {
    currentPiece.row += 1;
  }

  lockAndAdvance();
}

function tickDrop() {
  if (!isGameRunning || !currentPiece || isGameOver) return;

  moveDownOrLock();
  refreshDisplay();
}

function startDropLoop() {
  stopDropLoop();
  isGameRunning = true;
  dropTimerId = setInterval(tickDrop, DROP_INTERVAL_MS);
}

function stopDropLoop() {
  if (dropTimerId !== null) {
    clearInterval(dropTimerId);
    dropTimerId = null;
  }
  isGameRunning = false;
}

function drawPiece(targetBoard, piece) {
  const display = cloneBoard(targetBoard);

  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;

      const boardRow = piece.row + r;
      const boardCol = piece.col + c;

      if (isInsideBoard(boardRow, boardCol)) {
        display[boardRow][boardCol] = piece.color;
      }
    }
  }

  return display;
}

function renderBoard(displayBoard) {
  boardElement.innerHTML = "";

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = document.createElement("div");
      const color = displayBoard[row][col];

      cell.className = color ? `cell filled ${color}` : "cell";
      boardElement.appendChild(cell);
    }
  }
}

function updateScore(value) {
  score = value;
  scoreElement.textContent = score;
}

function pickRandomPieceType() {
  const index = Math.floor(Math.random() * PIECE_TYPES.length);
  return PIECE_TYPES[index];
}

function refreshDisplay() {
  const displayBoard = currentPiece
    ? drawPiece(board, currentPiece)
    : cloneBoard(board);

  renderBoard(displayBoard);
}

function resetGameState() {
  stopDropLoop();
  isGameOver = false;
  board = createEmptyBoard();
  currentPiece = null;
  updateScore(0);
  showGameOver(false);
}

function initGame() {
  resetGameState();
  spawnNextPiece();
  refreshDisplay();

  if (!isGameOver) {
    startDropLoop();
  }
}

function startGame() {
  initGame();
}

function restartGame() {
  initGame();
}

function isPlayable() {
  return isGameRunning && currentPiece !== null && !isGameOver;
}

function handlePlayerAction(action) {
  if (!isPlayable()) return;

  action();
  refreshDisplay();
}

function handleKeyDown(event) {
  if (!isPlayable()) return;

  switch (event.code) {
    case "ArrowLeft":
      event.preventDefault();
      handlePlayerAction(() => tryMove(-1, 0));
      break;
    case "ArrowRight":
      event.preventDefault();
      handlePlayerAction(() => tryMove(1, 0));
      break;
    case "ArrowDown":
      event.preventDefault();
      handlePlayerAction(() => moveDownOrLock());
      break;
    case "ArrowUp":
      event.preventDefault();
      handlePlayerAction(() => tryRotate());
      break;
    case "Space":
      event.preventDefault();
      handlePlayerAction(() => hardDrop());
      break;
    default:
      break;
  }
}

function setupKeyboardControls() {
  if (keyboardControlsRegistered) return;

  document.addEventListener("keydown", handleKeyDown);
  keyboardControlsRegistered = true;
}

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", restartGame);

setupKeyboardControls();
initGame();
