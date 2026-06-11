// ============================================================
// Week 5 Example 3 — Maze with Animated Character and Coins
// ============================================================
// This sketch combines everything from Examples 1 and 2:
//   - Animated walking character (4 directions)
//   - Animated spinning coins
//   - A hardcoded maze drawn with shapes
//   - Wall collision to keep the player inside the maze
//   - Collect all coins to unlock the exit
// ============================================================

// ------------------------------------------------------------
// SPRITE CONFIGURATION — Walking Character
// Since our setup function will dynamically rebuild the layout
// into a clean 4-row, 2-column sheet, we can use simple row indices!
// ------------------------------------------------------------
const SPRITE = {
  frameWidth:  100, // Width of one Ness frame
  frameHeight: 130, // Height of one Ness frame
  numFrames:   2,   // 2 alternating frames per row loop
  animSpeed:   10,  // Dropped to 15 for snappier 2-frame steps
  scale:       0.5,   // Set to 1 for full size (can adjust to scale up/down)

  // Clean uniform rows mapping after our setup translation
  rows: {
    down:  0,
    up:    1,
    right: 2,
    left:  3,
  },

  // No offsets needed because this rip aligns beautifully
  offsets: {
    down:  { x: -7, y: 0 },
    up:    { x: -3, y: 0 },
    right: { x: -4, y: 0 },
    left:  { x: -3, y: 0 },
  },
};

// ------------------------------------------------------------
// COIN SPRITE CONFIGURATION
// Coin sheet: 256 x 32px — 8 frames in a single row.
// Adjust these values to match your own sprite sheet.
// ------------------------------------------------------------
const COIN = {
  frameWidth:  200,  // 256px total / 8 frames
  frameHeight: 600,  // only one row, full sheet height
  numFrames:   6,   // 8 frames of spin animation
  animSpeed:   6,   // draw() frames per sprite frame (lower = faster)
  scale:       0.1, // scale up so the coin is visible on screen
};

// ------------------------------------------------------------
// MAZE
// A 2D array where each number represents one tile type.
// The maze is 16 tiles wide and 10 tiles tall.
// TILE_SIZE controls how large each tile is drawn in pixels.
//
// Tile values:
//   0 = floor (walkable)
//   1 = wall
//   2 = start position
//   3 = coin location
//   4 = exit (locked until all coins collected)
// ------------------------------------------------------------
const TILE_SIZE = 50;

const MAZE = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 2, 0, 0, 1, 0, 3, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
  [1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1],
  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 3, 1, 1],
  [1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 0, 1],
  [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 3, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 4, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

// Colours for each tile type — stored as RGB arrays
const TILE_COLORS = {
  0: [40,  40,  50 ], // floor — dark grey
  1: [80,  60,  100], // wall  — purple-grey
  2: [40,  40,  50 ], // start — same as floor
  3: [40,  40,  50 ], // coin  — same as floor (coin drawn on top)
  4: [60,  100, 80 ], // exit  — green tint when locked
};

// ------------------------------------------------------------
// PLAYER
// x and y track the centre position on the canvas.
// hw and hh are the half-dimensions of the collision box —
// smaller than the sprite for a tighter feel.
// ------------------------------------------------------------
let player = {
  x: 0,
  y: 0,
  speed: 3, 

  // Animation state
  currentFrame: 0,      
  frameTimer:   0,      
  direction:    "down", 
  isMoving:     false,  

  // Collision box half-dimensions
  // Smaller than the sprite so the player can navigate tight corridors
  hw: 12, // half width
  hh: 12, // half height
};

// ------------------------------------------------------------
// COINS
// Built from the maze data in setup() — any tile marked 3
// becomes a coin object with its own position and frame counter.
// ------------------------------------------------------------
let coins = [];
let coinsCollected = 0;

// ------------------------------------------------------------
// GAME STATE
// ------------------------------------------------------------
let gameWon = false;

// Images
let originalSheet;  // Stores the raw asset unedited
let characterSheet; // The newly constructed 4x2 offscreen graphics canvas
let coinSheet; // the loaded coin sprite sheet image

// ============================================================
// preload()
// Runs once before setup(). Always load images here so they
// are ready before the sketch tries to use them.
// ============================================================
function preload() {
  originalSheet = loadImage("assets/images/nesswalking.png");
  coinSheet = loadImage("assets/images/coinanimation.png");
}

// ============================================================
// setup()
// Creates the canvas and maps the custom left-half pieces 
// into a standard stacked row architecture.
// ============================================================
function setup() {
  // Size the canvas to fit the maze exactly
  createCanvas(TILE_SIZE * MAZE[0].length, TILE_SIZE * MAZE.length);
  imageMode(CENTER);

  // Calculate true frame size dynamically based on the file dimensions
  let w = originalSheet.width / 8;
  let h = originalSheet.height / 2;

  SPRITE.frameWidth = w;
  SPRITE.frameHeight = h;

  // Create the offscreen graphics canvas buffer
  characterSheet = createGraphics(w * 2, h * 4);

  // FINE-TUNING ALIGNMENT:
  // We shift the destination Y (dy) down by 6 pixels for Rows 0 and 2 
  // to match the lower resting position of Rows 1 and 3.
  let shiftY = 12; 

  // Row 0: Down (Shifted down by shiftY)
  characterSheet.copy(originalSheet, 0 * w, 0 * h, w * 2, h, 0 * w, (0 * h) + shiftY, w * 2, h);
  
  // Row 1: Up (Kept at its original natural lower height)
  characterSheet.copy(originalSheet, 0 * w, 1 * h, w * 2, h, 0 * w, 1 * h, w * 2, h);
  
  // Row 2: Right (Shifted down by shiftY)
  characterSheet.copy(originalSheet, 2 * w, 0 * h, w * 2, h, 0 * w, (2 * h) + shiftY, w * 2, h);
  
  // Row 3: Left (Kept at its original natural lower height)
  characterSheet.copy(originalSheet, 2 * w, 1 * h, w * 2, h, 0 * w, 3 * h, w * 2, h);

  // Scan the maze array to find the start position and coin locations
  for (let row = 0; row < MAZE.length; row++) {
    for (let col = 0; col < MAZE[row].length; col++) {
      let tile = MAZE[row][col];

      if (tile === 2) {
        // Place the player in the centre of the start tile
        player.x = col * TILE_SIZE + TILE_SIZE / 2;
        player.y = row * TILE_SIZE + TILE_SIZE / 2;
      }

      if (tile === 3) {
        // Create a coin object for each coin tile
        // Random start frame so coins don't all spin in sync
        coins.push({
          x:          col * TILE_SIZE + TILE_SIZE / 2,
          y:          row * TILE_SIZE + TILE_SIZE / 2,
          frame:      floor(random(COIN.numFrames)),
          frameTimer: 0,
          collected:  false,
        });
      }
    }
  }
}

// ============================================================
// draw()
// Runs repeatedly in a loop after setup() finishes.
// Order matters — maze is drawn first so everything else
// appears on top of it.
// ============================================================
function draw() {
  background(20);

  drawMaze();
  updateCoins();
  drawCoins();
  handleInput();
  resolveWallCollisions();
  checkCoinCollection();
  checkExit();
  animateSprite();
  drawCharacter();
  drawHUD();

  // Win screen is drawn last so it appears on top of everything
  if (gameWon) {
    drawWinScreen();
  }
}

// ------------------------------------------------------------
// drawMaze()
// Loops through every tile in the maze array and draws a
// rectangle for it. rectMode(CORNER) means x, y is the
// top-left of each tile.
// The exit tile changes colour when all coins are collected.
// ------------------------------------------------------------
function drawMaze() {
  rectMode(CORNER);
  noStroke();

  for (let row = 0; row < MAZE.length; row++) {
    for (let col = 0; col < MAZE[row].length; col++) {
      let tile = MAZE[row][col];

      // Exit tile changes colour when all coins are collected
      if (tile === 4) {
        if (coinsCollected === coins.length) {
          fill(30, 200, 120); // bright green — exit is open
        } else {
          fill(60, 100, 80);  // dim green — exit is locked
        }
      } else {
        let c = TILE_COLORS[tile];
        fill(c[0], c[1], c[2]);
      }

      rect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }
}

// ------------------------------------------------------------
// updateCoins()
// Loops through every coin and advances its animation frame.
// Skips coins that have already been collected.
// Each coin has its own frameTimer so they animate independently.
// ------------------------------------------------------------
function updateCoins() {
  for (let i = 0; i < coins.length; i++) {
    if (coins[i].collected) continue; // skip collected coins

    // Advance the animation timer each frame
    coins[i].frameTimer++;
    if (coins[i].frameTimer >= COIN.animSpeed) {
      coins[i].frameTimer = 0;
      coins[i].frame = (coins[i].frame + 1) % COIN.numFrames;
    }
  }
}

// ------------------------------------------------------------
// drawCoins()
// Loops through every coin and draws it at its current frame.
// Coins only have one row so sy (source y) is always 0.
// sx slides along the row by multiplying the frame number
// by frameWidth — the same pattern as the walking character.
// ------------------------------------------------------------
function drawCoins() {
  for (let i = 0; i < coins.length; i++) {
    if (coins[i].collected) continue; // skip collected coins

    let coin = coins[i];

    // Source x position on the sprite sheet
    // Coins have only one row so sy is always 0
    let sx = coin.frame * COIN.frameWidth;
    let sy = 0;

    // Draw size (original frame size multiplied by scale)
    let dw = COIN.frameWidth  * COIN.scale;
    let dh = COIN.frameHeight * COIN.scale;

    image(
      coinSheet,
      coin.x, coin.y, // destination centre position
      dw, dh,         // destination size (scaled)
      sx, sy,         // source position on sheet
      COIN.frameWidth,  // source width  (one frame)
      COIN.frameHeight, // source height (one row)
    );
  }
}

// ------------------------------------------------------------
// handleInput()
// Moves the player and sets the correct facing direction.
// Each direction is checked independently so diagonal
// movement works naturally — holding W and D moves up-right.
// Returns early if the game is already won.
// ------------------------------------------------------------
function handleInput() {
  if (gameWon) return;

  player.isMoving = false;

  if (keyIsDown(87)) { // W — up
    player.y -= player.speed;
    player.direction = "up";
    player.isMoving = true;
  }
  if (keyIsDown(83)) { // S — down
    player.y += player.speed;
    player.direction = "down";
    player.isMoving = true;
  }
  if (keyIsDown(65)) { // A — left
    player.x -= player.speed;
    player.direction = "left";
    player.isMoving = true;
  }
  if (keyIsDown(68)) { // D — right
    player.x += player.speed;
    player.direction = "right";
    player.isMoving = true;
  }
}

// ------------------------------------------------------------
// resolveWallCollisions()
// Checks all four corners of the player's collision box
// against the maze tile at each corner's position.
// If a corner is inside a wall tile, the player is pushed
// out from the smallest overlapping direction.
//
// This approach handles diagonal wall contacts correctly
// and prevents the player from getting stuck on corners.
// ------------------------------------------------------------
function resolveWallCollisions() {
  // The four corners of the player's collision box
  let corners = [
    { x: player.x - player.hw, y: player.y - player.hh }, // top left
    { x: player.x + player.hw, y: player.y - player.hh }, // top right
    { x: player.x - player.hw, y: player.y + player.hh }, // bottom left
    { x: player.x + player.hw, y: player.y + player.hh }, // bottom right
  ];

  for (let i = 0; i < corners.length; i++) {
    let c = corners[i];

    // Convert pixel position to tile coordinates
    let col = floor(c.x / TILE_SIZE);
    let row = floor(c.y / TILE_SIZE);

    // Skip if outside the maze array bounds
    if (row < 0 || row >= MAZE.length || col < 0 || col >= MAZE[0].length) continue;

    if (MAZE[row][col] === 1) {
      // Calculate how far the player is overlapping each side of the wall tile
      let tileLeft   = col * TILE_SIZE;
      let tileRight  = tileLeft + TILE_SIZE;
      let tileTop    = row * TILE_SIZE;
      let tileBottom = tileTop + TILE_SIZE;

      let overlapLeft   = (player.x + player.hw) - tileLeft;
      let overlapRight  = tileRight  - (player.x - player.hw);
      let overlapTop    = (player.y + player.hh) - tileTop;
      let overlapBottom = tileBottom - (player.y - player.hh);

      // Push the player out from the side with the smallest overlap
      let minOverlap = min(overlapLeft, overlapRight, overlapTop, overlapBottom);

      if      (minOverlap === overlapLeft)   player.x -= overlapLeft;
      else if (minOverlap === overlapRight)  player.x += overlapRight;
      else if (minOverlap === overlapTop)    player.y -= overlapTop;
      else if (minOverlap === overlapBottom) player.y += overlapBottom;
    }
  }
}

// ------------------------------------------------------------
// checkCoinCollection()
// Uses dist() to check if the player is close enough to
// collect each coin. A threshold of 60% of TILE_SIZE feels
// natural — not too generous, not too strict.
// ------------------------------------------------------------
function checkCoinCollection() {
  for (let i = 0; i < coins.length; i++) {
    if (coins[i].collected) continue;

    // dist() returns the distance between two points
    let d = dist(player.x, player.y, coins[i].x, coins[i].y);
    if (d < TILE_SIZE * 0.6) {
      coins[i].collected = true;
      coinsCollected++;
    }
  }
}

// ------------------------------------------------------------
// checkExit()
// Only active once all coins are collected.
// Scans the maze for the exit tile (4) and checks whether
// the player is close enough to trigger a win.
// ------------------------------------------------------------
function checkExit() {
  if (coinsCollected < coins.length) return; // exit is still locked

  for (let row = 0; row < MAZE.length; row++) {
    for (let col = 0; col < MAZE[row].length; col++) {
      if (MAZE[row][col] === 4) {
        let exitX = col * TILE_SIZE + TILE_SIZE / 2;
        let exitY = row * TILE_SIZE + TILE_SIZE / 2;
        if (dist(player.x, player.y, exitX, exitY) < TILE_SIZE * 0.6) {
          gameWon = true;
        }
      }
    }
  }
}

// ------------------------------------------------------------
// animateSprite()
// Advances the animation frame at a controlled speed.
// frameTimer counts up every draw() call.
// When it reaches animSpeed, the frame advances.
// Only animates when the player is moving — stays on frame 0
// when idle so the character stands still.
// ------------------------------------------------------------
function animateSprite() {
  if (player.isMoving) {
    player.frameTimer++;

    // When the timer reaches animSpeed, advance to the next frame
    // % numFrames wraps back to 0 after the last frame
    if (player.frameTimer >= SPRITE.animSpeed) {
      player.frameTimer = 0;
      player.currentFrame = (player.currentFrame + 1) % SPRITE.numFrames;
    }
  } else {
    // Reset to standing frame when not moving
    player.currentFrame = 0;
    player.frameTimer   = 0;
  }
}

// ------------------------------------------------------------
// drawCharacter()
// Uses standard grid sampling because our sheet was flattened to 4x2
// ------------------------------------------------------------
function drawCharacter() {
  let row    = SPRITE.rows[player.direction];
  let offset = SPRITE.offsets[player.direction];

  // Map perfectly over the generated clean 4x2 coordinate tracking system
  let sx = player.currentFrame * SPRITE.frameWidth  + offset.x;
  let sy = row                 * SPRITE.frameHeight + offset.y;

  let dw = SPRITE.frameWidth  * SPRITE.scale;
  let dh = SPRITE.frameHeight * SPRITE.scale;

  image(
    characterSheet, // Reads directly from the constructed canvas graphics buffer
    player.x, player.y, 
    dw, dh,             
    sx, sy,             
    SPRITE.frameWidth,  
    SPRITE.frameHeight  
  );
}

// ------------------------------------------------------------
// drawHUD()
// HUD = Heads Up Display.
// Shows coin count and exit status at the top of the screen.
// ------------------------------------------------------------
function drawHUD() {
  noStroke();
  fill(255);
  textSize(14);
  textAlign(LEFT);
  textFont("monospace");
  text("Coins: " + coinsCollected + " / " + coins.length, 10, 20);

  // Show exit hint once all coins are collected
  if (coinsCollected === coins.length) {
    fill(30, 200, 120);
    text("Exit is open! Find the green tile.", 10, 40);
  }
}

// ------------------------------------------------------------
// drawWinScreen()
// Draws a semi-transparent overlay and win message on top
// of everything else. Called last in draw() so it appears
// in front of the maze, character, and HUD.
// ------------------------------------------------------------
function drawWinScreen() {
  fill(0, 0, 0, 160);
  rectMode(CORNER);
  rect(0, 0, width, height);

  fill(255);
  textAlign(CENTER);
  textSize(48);
  text("You Escaped!", width / 2, height / 2 - 20);

  textSize(16);
  fill(180);
  text("All coins collected", width / 2, height / 2 + 20);
}