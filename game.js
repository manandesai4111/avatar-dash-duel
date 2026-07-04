"use strict";

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 540;
const ROLE_INDEX = { p1: 0, p2: 1 };
const INDEX_ROLE = ["p1", "p2"];
const ROLE_NAMES = { p1: "Manan", p2: "Kripa" };

class SeededRandom {
  constructor(seed) {
    this.seed = seed >>> 0;
  }

  next() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  between(min, max) {
    return min + this.next() * (max - min);
  }
}

class SpriteAnimator {
  constructor(src, fallbackColor, accentColor) {
    this.image = new Image();
    this.sheet = this.image;
    this.loaded = false;
    this.failed = false;
    this.columns = 4;
    this.rows = 3;
    this.frameWidth = 1;
    this.frameHeight = 1;
    this.fallbackColor = fallbackColor;
    this.accentColor = accentColor;
    this.state = "run";
    this.frameCursor = 0;
    this.frameTimer = 0;
    this.animations = {
      run: { frames: [0, 1, 2, 3], fps: 10 },
      jump: { frames: [4, 5], fps: 7 },
      win: { frames: [6, 7, 8], fps: 8 },
      lose: { frames: [9, 10, 11], fps: 5 }
    };

    this.image.onload = () => {
      this.loaded = true;
      this.frameWidth = Math.floor(this.image.width / this.columns);
      this.frameHeight = Math.floor(this.image.height / this.rows);
      this.sheet = this.makeWhitePixelsTransparent(this.image);
    };
    this.image.onerror = () => {
      this.failed = true;
    };
    this.image.src = src;
  }

  makeWhitePixelsTransparent(image) {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0);

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const isNearlyWhite = r >= 245 && g >= 245 && b >= 245;
        if (isNearlyWhite) {
          pixels[i + 3] = 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      return canvas;
    } catch (error) {
      return image;
    }
  }

  update(state, dt) {
    const nextState = this.animations[state] ? state : "run";
    if (nextState !== this.state) {
      this.state = nextState;
      this.frameCursor = 0;
      this.frameTimer = 0;
    }

    const animation = this.animations[this.state];
    this.frameTimer += dt;
    const frameDuration = 1 / animation.fps;
    while (this.frameTimer >= frameDuration) {
      this.frameTimer -= frameDuration;
      this.frameCursor = (this.frameCursor + 1) % animation.frames.length;
    }
  }

  draw(ctx, x, y, width, height, state, options = {}) {
    const animation = this.animations[this.state] || this.animations.run;
    const frame = animation.frames[this.frameCursor % animation.frames.length];

    if (this.loaded && !this.failed) {
      const sourceX = (frame % this.columns) * this.frameWidth;
      const sourceY = Math.floor(frame / this.columns) * this.frameHeight;

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (options.squash) {
        const centerX = x + width / 2;
        const bottom = y + height;
        ctx.translate(centerX, bottom);
        ctx.scale(1.18, 0.62);
        ctx.drawImage(
          this.sheet,
          sourceX,
          sourceY,
          this.frameWidth,
          this.frameHeight,
          -width / 2,
          -height,
          width,
          height
        );
      } else {
        ctx.drawImage(
          this.sheet,
          sourceX,
          sourceY,
          this.frameWidth,
          this.frameHeight,
          x,
          y,
          width,
          height
        );
      }
      ctx.restore();
      return;
    }

    this.drawFallback(ctx, x, y, width, height, state, options, frame);
  }

  drawFallback(ctx, x, y, width, height, state, options, frame) {
    const drawHeight = options.squash ? height * 0.62 : height;
    const drawWidth = options.squash ? width * 1.18 : width;
    const drawX = x + (width - drawWidth) / 2;
    const drawY = y + height - drawHeight;
    const footLift = state === "run" ? (frame % 2) * 5 : 0;

    ctx.save();
    ctx.fillStyle = "rgba(24, 31, 48, 0.22)";
    ctx.fillRect(drawX + 5, y + height + 5, drawWidth - 10, 8);

    ctx.fillStyle = this.fallbackColor;
    ctx.fillRect(drawX + drawWidth * 0.24, drawY + drawHeight * 0.2, drawWidth * 0.52, drawHeight * 0.58);
    ctx.fillRect(drawX + drawWidth * 0.3, drawY, drawWidth * 0.4, drawHeight * 0.32);

    ctx.fillStyle = "#ffe2b8";
    ctx.fillRect(drawX + drawWidth * 0.34, drawY + drawHeight * 0.06, drawWidth * 0.32, drawHeight * 0.2);

    ctx.fillStyle = this.accentColor;
    ctx.fillRect(drawX + drawWidth * 0.25, drawY, drawWidth * 0.5, drawHeight * 0.09);

    ctx.fillStyle = "#17253b";
    ctx.fillRect(drawX + drawWidth * 0.41, drawY + drawHeight * 0.13, 4, 4);
    ctx.fillRect(drawX + drawWidth * 0.56, drawY + drawHeight * 0.13, 4, 4);

    if (state === "win") {
      const armY = frame % 2 === 0 ? drawY + drawHeight * 0.16 : drawY + drawHeight * 0.28;
      ctx.fillStyle = this.accentColor;
      ctx.fillRect(drawX + drawWidth * 0.08, armY, drawWidth * 0.18, 8);
      ctx.fillRect(drawX + drawWidth * 0.74, armY, drawWidth * 0.18, 8);
      ctx.fillStyle = "#17253b";
      ctx.fillRect(drawX + drawWidth * 0.43, drawY + drawHeight * 0.22, drawWidth * 0.16, 4);
    } else if (state === "lose") {
      ctx.fillStyle = "#46b7ff";
      ctx.fillRect(drawX + drawWidth * 0.39, drawY + drawHeight * 0.2, 4, 14);
      ctx.fillRect(drawX + drawWidth * 0.59, drawY + drawHeight * 0.2, 4, 14);
      ctx.fillStyle = "#17253b";
      ctx.fillRect(drawX + drawWidth * 0.43, drawY + drawHeight * 0.29, drawWidth * 0.16, 4);
    } else {
      ctx.fillStyle = this.accentColor;
      ctx.fillRect(drawX + drawWidth * 0.14, drawY + drawHeight * 0.34, drawWidth * 0.18, 8);
      ctx.fillRect(drawX + drawWidth * 0.68, drawY + drawHeight * 0.34, drawWidth * 0.18, 8);
    }

    ctx.fillStyle = "#17253b";
    ctx.fillRect(drawX + drawWidth * 0.28, drawY + drawHeight * 0.78 + footLift, 10, drawHeight * 0.18);
    ctx.fillRect(drawX + drawWidth * 0.58, drawY + drawHeight * 0.78 + (5 - footLift), 10, drawHeight * 0.18);
    ctx.restore();
  }
}

class Player {
  constructor({ name, role, x, sprite, color, accent }) {
    this.name = name;
    this.role = role;
    this.startX = x;
    this.sprite = sprite;
    this.color = color;
    this.accent = accent;
    this.width = 58;
    this.height = 78;
    this.duckHeight = 42;
    this.gravity = 2300;
    this.jumpForce = 820;
    this.reset();
  }

  reset() {
    this.x = this.startX;
    this.groundY = 400;
    this.y = this.groundY - this.height;
    this.velocityY = 0;
    this.onGround = true;
    this.sliding = false;
    this.alive = true;
    this.outcome = "run";
    this.score = 0;
  }

  jump() {
    if (!this.alive || !this.onGround) {
      return;
    }
    this.sliding = false;
    this.velocityY = -this.jumpForce;
    this.onGround = false;
  }

  startSlide() {
    if (!this.alive || !this.onGround) {
      return;
    }
    this.sliding = true;
  }

  stopSlide() {
    this.sliding = false;
  }

  update(dt) {
    if (!this.onGround) {
      this.velocityY += this.gravity * dt;
      this.y += this.velocityY * dt;
      const groundTop = this.groundY - this.height;

      if (this.y >= groundTop) {
        this.y = groundTop;
        this.velocityY = 0;
        this.onGround = true;
      }
    }

    this.sprite.update(this.getAnimationState(), dt);
  }

  getAnimationState() {
    if (this.outcome === "win") {
      return "win";
    }
    if (this.outcome === "lose") {
      return "lose";
    }
    if (!this.onGround) {
      return "jump";
    }
    return "run";
  }

  getVisualBox() {
    const isSliding = this.sliding && this.onGround && this.outcome === "run";
    const visualHeight = isSliding ? this.duckHeight : this.height;
    return {
      x: this.x,
      y: isSliding ? this.groundY - this.height : this.y,
      width: isSliding ? this.width * 1.12 : this.width,
      height: visualHeight,
      visibleTop: isSliding ? this.groundY - visualHeight : this.y,
      squash: isSliding
    };
  }

  getHitbox() {
    if (this.sliding && this.onGround && this.outcome === "run") {
      return {
        x: this.x + 7,
        y: this.groundY - this.duckHeight + 9,
        width: this.width * 1.02,
        height: this.duckHeight - 13
      };
    }

    return {
      x: this.x + 10,
      y: this.y + 12,
      width: this.width - 20,
      height: this.height - 18
    };
  }

  draw(ctx, isLocal) {
    const box = this.getVisualBox();
    const state = this.getAnimationState();
    this.sprite.draw(ctx, box.x, box.y, box.width, this.height, state, { squash: box.squash });

    ctx.save();
    ctx.font = "900 15px 'Trebuchet MS', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.fillStyle = isLocal ? this.color : "#17253b";
    const labelY = Math.max(22, box.visibleTop - 12);
    ctx.strokeText(this.name, this.x + this.width / 2, labelY);
    ctx.fillText(this.name, this.x + this.width / 2, labelY);
    ctx.restore();
  }
}

class Obstacle {
  constructor(type, x, groundY) {
    this.type = type;
    this.x = x;
    this.passed = false;
    this.frameOffset = 0;

    const specs = {
      cactus: { width: 38, height: 64, y: groundY - 64 },
      rock: { width: 52, height: 34, y: groundY - 34 },
      bird: { width: 62, height: 34, y: groundY - 90 },
      lowBarrier: { width: 72, height: 42, y: groundY - 42 }
    };

    Object.assign(this, specs[type]);
  }

  update(dt, speed) {
    this.x -= speed * dt;
  }

  isOffscreen() {
    return this.x + this.width < -30;
  }

  getHitbox() {
    return {
      x: this.x + 4,
      y: this.y + 4,
      width: this.width - 8,
      height: this.height - 8
    };
  }

  draw(ctx, time) {
    ctx.save();

    if (this.type === "cactus") {
      ctx.fillStyle = "#2fad5f";
      ctx.fillRect(this.x + 13, this.y, 14, this.height);
      ctx.fillRect(this.x + 2, this.y + 24, 16, 10);
      ctx.fillRect(this.x + 22, this.y + 34, 16, 10);
      ctx.fillStyle = "#1f7d43";
      ctx.fillRect(this.x + 17, this.y + 8, 5, this.height - 12);
    }

    if (this.type === "rock") {
      ctx.fillStyle = "#785c68";
      ctx.fillRect(this.x + 6, this.y + 10, this.width - 12, this.height - 10);
      ctx.fillRect(this.x + 14, this.y, this.width - 26, 14);
      ctx.fillStyle = "#5b4350";
      ctx.fillRect(this.x + 16, this.y + 10, 11, 6);
      ctx.fillRect(this.x + 34, this.y + 20, 9, 6);
    }

    if (this.type === "bird") {
      const flap = Math.sin(time * 10 + this.x * 0.03) > 0 ? 0 : 8;
      ctx.fillStyle = "#7e4bd8";
      ctx.fillRect(this.x + 20, this.y + 12, 30, 16);
      ctx.fillRect(this.x + 48, this.y + 16, 9, 7);
      ctx.fillStyle = "#5a2daa";
      ctx.fillRect(this.x + 5, this.y + flap, 24, 8);
      ctx.fillRect(this.x + 26, this.y + 25 - flap, 22, 8);
      ctx.fillStyle = "#fff3a8";
      ctx.fillRect(this.x + 55, this.y + 18, 8, 4);
    }

    if (this.type === "lowBarrier") {
      ctx.fillStyle = "#ffbf3d";
      ctx.fillRect(this.x, this.y + 10, this.width, 12);
      ctx.fillRect(this.x + 8, this.y + 25, this.width - 16, 12);
      ctx.fillStyle = "#ef5c31";
      for (let i = 4; i < this.width; i += 18) {
        ctx.fillRect(this.x + i, this.y + 6, 8, this.height - 6);
      }
    }

    ctx.restore();
  }
}

class MultiplayerClient {
  constructor(game) {
    this.game = game;
    this.socket = null;
    this.connected = false;
    this.sequence = 0;
    this.connect();
  }

  connect() {
    if (window.location.protocol === "file:") {
      this.game.setConnectionStatus("Open the game through server.js for online rooms. Practice mode still works.");
      return;
    }

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${wsProtocol}//${window.location.host}/ws`;

    try {
      this.socket = new WebSocket(url);
    } catch (error) {
      this.game.setConnectionStatus("Multiplayer server is not available. Practice mode still works.");
      return;
    }

    this.socket.addEventListener("open", () => {
      this.connected = true;
      this.game.setConnectionStatus("Connected. Create a room or join with a code.");
      this.game.setOnlineButtonsEnabled(true);
    });

    this.socket.addEventListener("close", () => {
      this.connected = false;
      this.game.setOnlineButtonsEnabled(false);
      this.game.setConnectionStatus("Disconnected from multiplayer server. Refresh after restarting server.js.");
      this.game.handlePeerLeft("Connection closed.");
    });

    this.socket.addEventListener("error", () => {
      this.game.setConnectionStatus("Could not reach the multiplayer server.");
    });

    this.socket.addEventListener("message", (event) => {
      try {
        this.handleMessage(JSON.parse(event.data));
      } catch (error) {
        console.warn("Bad server message", error);
      }
    });
  }

  send(message) {
    if (!this.connected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.game.setConnectionStatus("Multiplayer server is not connected.");
      return false;
    }

    this.socket.send(JSON.stringify(message));
    return true;
  }

  createRoom() {
    this.send({ type: "create" });
  }

  joinRoom(code) {
    this.send({ type: "join", roomCode: code.trim().toUpperCase() });
  }

  sendReady() {
    return this.send({ type: "ready" });
  }

  sendInput(role, action) {
    this.send({
      type: "input",
      role,
      action,
      sequence: ++this.sequence
    });
  }

  sendFinish(loserRole, scores) {
    this.send({
      type: "finish",
      loserRole,
      scores
    });
  }

  handleMessage(message) {
    if (message.type === "room") {
      this.game.enterOnlineRoom(message.roomCode, message.role, message.players, message.ready);
    }

    if (message.type === "roomState") {
      this.game.updateRoomState(message.players, message.ready, message.notice);
    }

    if (message.type === "start") {
      this.game.startRace({
        mode: "online",
        seed: message.seed,
        startAt: message.startAt
      });
    }

    if (message.type === "input") {
      if (message.role !== this.game.localRole) {
        this.game.applyInput(message.role, message.action);
      }
    }

    if (message.type === "gameOver") {
      this.game.applyGameOver(message.winnerRole, message.loserRole, message.scores);
    }

    if (message.type === "peerLeft") {
      this.game.handlePeerLeft(message.notice || "The other player left the room.");
    }

    if (message.type === "error") {
      this.game.setConnectionStatus(message.message);
    }
  }
}

class InputManager {
  constructor(game) {
    this.game = game;
    this.pressed = new Set();
    this.bindKeyboard();
    this.bindTouchControls();
    this.preventMobileGestures();
  }

  bindKeyboard() {
    const keyMap = {
      KeyW: { role: "p1", action: "jump" },
      KeyS: { role: "p1", action: "slide" },
      ArrowUp: { role: "p2", action: "jump" },
      ArrowDown: { role: "p2", action: "slide" }
    };

    window.addEventListener("keydown", (event) => {
      const control = keyMap[event.code];
      if (!control) {
        return;
      }
      event.preventDefault();

      const key = `${control.role}:${control.action}`;
      if (!this.pressed.has(key)) {
        this.pressed.add(key);
        this.game.handleControl(control.role, control.action, true);
      }
    });

    window.addEventListener("keyup", (event) => {
      const control = keyMap[event.code];
      if (!control) {
        return;
      }
      event.preventDefault();

      const key = `${control.role}:${control.action}`;
      this.pressed.delete(key);
      this.game.handleControl(control.role, control.action, false);
    });
  }

  bindTouchControls() {
    document.querySelectorAll("[data-action]").forEach((button) => {
      const action = button.dataset.action;
      const control = this.parseButtonAction(action);

      const press = (event) => {
        event.preventDefault();
        if (button.disabled) {
          return;
        }
        button.classList.add("is-active");
        this.game.handleControl(control.role, control.action, true);
      };

      const release = (event) => {
        event.preventDefault();
        button.classList.remove("is-active");
        if (button.disabled) {
          return;
        }
        this.game.handleControl(control.role, control.action, false);
      };

      button.addEventListener("touchstart", press, { passive: false });
      button.addEventListener("touchend", release, { passive: false });
      button.addEventListener("touchcancel", release, { passive: false });
      button.addEventListener("mousedown", press);
      button.addEventListener("mouseup", release);
      button.addEventListener("mouseleave", release);
      button.addEventListener("contextmenu", (event) => event.preventDefault());
    });
  }

  parseButtonAction(action) {
    return {
      p1Jump: { role: "p1", action: "jump" },
      p1Slide: { role: "p1", action: "slide" },
      p2Jump: { role: "p2", action: "jump" },
      p2Slide: { role: "p2", action: "slide" }
    }[action];
  }

  preventMobileGestures() {
    let lastTouchEnd = 0;

    document.addEventListener("touchmove", (event) => {
      if (this.game.state === "playing" || this.game.state === "countdown") {
        event.preventDefault();
      }
    }, { passive: false });

    document.addEventListener("touchend", (event) => {
      const now = Date.now();
      if (now - lastTouchEnd < 350) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    }, { passive: false });

    document.addEventListener("gesturestart", (event) => event.preventDefault());
    document.addEventListener("dblclick", (event) => event.preventDefault());
  }
}

class Game {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.scoreEls = {
      p1: document.getElementById("p1Score"),
      p2: document.getElementById("p2Score"),
      finalP1: document.getElementById("finalP1Score"),
      finalP2: document.getElementById("finalP2Score"),
      winner: document.getElementById("winnerText")
    };
    this.resultEls = {
      p1Canvas: document.getElementById("p1ResultCanvas"),
      p2Canvas: document.getElementById("p2ResultCanvas"),
      p1Status: document.getElementById("p1ResultStatus"),
      p2Status: document.getElementById("p2ResultStatus")
    };
    this.resultContexts = [
      this.resultEls.p1Canvas.getContext("2d"),
      this.resultEls.p2Canvas.getContext("2d")
    ];
    this.ui = {
      playButton: document.getElementById("playButton"),
      joinButton: document.getElementById("joinButton"),
      practiceButton: document.getElementById("practiceButton"),
      startRaceButton: document.getElementById("startRaceButton"),
      restartButton: document.getElementById("restartButton"),
      roomCodeInput: document.getElementById("roomCodeInput"),
      connectionStatus: document.getElementById("connectionStatus"),
      roomStatusText: document.getElementById("roomStatusText"),
      roleText: document.getElementById("roleText"),
      waitingText: document.getElementById("waitingText"),
      mobileInstructionText: document.getElementById("mobileInstructionText")
    };
    this.screens = {
      start: document.getElementById("startScreen"),
      instructions: document.getElementById("instructionScreen"),
      gameOver: document.getElementById("gameOverScreen")
    };

    this.players = [
      new Player({
        name: "Manan",
        role: "p1",
        x: 136,
        sprite: new SpriteAnimator("assets/manan_sprite.png", "#ff4f7d", "#ffd23f"),
        color: "#ff4f7d",
        accent: "#ffd23f"
      }),
      new Player({
        name: "Kripa",
        role: "p2",
        x: 220,
        sprite: new SpriteAnimator("assets/kripa_sprite.png", "#3877ff", "#53e0a2"),
        color: "#3877ff",
        accent: "#53e0a2"
      })
    ];

    this.width = WORLD_WIDTH;
    this.height = WORLD_HEIGHT;
    this.groundY = 400;
    this.state = "start";
    this.mode = "none";
    this.localRole = null;
    this.roomCode = "";
    this.lastTime = 0;
    this.speed = 350;
    this.distance = 0;
    this.groundOffset = 0;
    this.spawnTimer = 0;
    this.obstacles = [];
    this.clouds = [];
    this.rng = new SeededRandom(1);
    this.startAt = 0;
    this.gameOverSent = false;

    this.bindUi();
    this.input = new InputManager(this);
    this.network = new MultiplayerClient(this);
    this.createClouds();
    this.resize();
    this.setControlMode("none");

    window.addEventListener("resize", () => this.resize());
    if ("ResizeObserver" in window) {
      new ResizeObserver(() => this.resize()).observe(this.canvas);
    }

    requestAnimationFrame((time) => this.loop(time));
  }

  bindUi() {
    this.ui.playButton.addEventListener("click", () => {
      this.network.createRoom();
    });

    this.ui.joinButton.addEventListener("click", () => {
      this.network.joinRoom(this.ui.roomCodeInput.value);
    });

    this.ui.roomCodeInput.addEventListener("input", () => {
      this.ui.roomCodeInput.value = this.ui.roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    });

    this.ui.practiceButton.addEventListener("click", () => {
      this.enterPracticeRoom();
    });

    this.ui.startRaceButton.addEventListener("click", () => {
      this.readyForRace();
    });

    this.ui.restartButton.addEventListener("click", () => {
      this.readyForRace();
    });
  }

  setOnlineButtonsEnabled(enabled) {
    this.ui.playButton.disabled = !enabled;
    this.ui.joinButton.disabled = !enabled;
  }

  setConnectionStatus(text) {
    this.ui.connectionStatus.textContent = text;
  }

  showScreen(screen) {
    this.screens.start.hidden = screen !== "start";
    this.screens.instructions.hidden = screen !== "instructions";
    this.screens.gameOver.hidden = screen !== "gameOver";
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(320, Math.round((rect.width || WORLD_WIDTH) * dpr));
    const pixelHeight = Math.max(180, Math.round((rect.height || WORLD_HEIGHT) * dpr));

    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }

    const scaleX = pixelWidth / dpr / WORLD_WIDTH;
    const scaleY = pixelHeight / dpr / WORLD_HEIGHT;
    this.ctx.setTransform(scaleX * dpr, 0, 0, scaleY * dpr, 0, 0);
  }

  createClouds() {
    this.clouds = Array.from({ length: 7 }, (_, index) => ({
      x: index * 170 + Math.random() * 90,
      y: 24 + Math.random() * 118,
      width: 72 + Math.random() * 54,
      speed: 14 + Math.random() * 18
    }));
  }

  enterOnlineRoom(roomCode, role, players, ready) {
    this.mode = "online";
    this.localRole = role;
    this.roomCode = roomCode;
    this.state = "lobby";
    this.gameOverSent = false;
    this.showScreen("instructions");
    this.setControlMode(role);
    this.updateRoomState(players, ready, `Room ${roomCode} joined.`);
  }

  enterPracticeRoom() {
    this.mode = "practice";
    this.localRole = "both";
    this.roomCode = "Practice";
    this.state = "lobby";
    this.showScreen("instructions");
    this.setControlMode("both");
    this.ui.roomStatusText.textContent = "Practice mode";
    this.ui.roleText.textContent = "Practice";
    this.ui.mobileInstructionText.textContent = "Both player controls are active on this device.";
    this.ui.waitingText.textContent = "Use this to test jumping, sliding, obstacles, and sprite animations.";
    this.ui.startRaceButton.disabled = false;
    this.ui.startRaceButton.textContent = "Start Practice";
  }

  updateRoomState(players = {}, ready = {}, notice = "") {
    if (this.mode !== "online") {
      return;
    }

    const p1Connected = Boolean(players.p1);
    const p2Connected = Boolean(players.p2);
    const bothConnected = p1Connected && p2Connected;
    const localName = ROLE_NAMES[this.localRole];

    this.ui.roomStatusText.textContent = `Room ${this.roomCode}`;
    this.ui.roleText.textContent = `You are ${localName}`;
    this.ui.mobileInstructionText.textContent = `Use the highlighted ${localName} Jump and Slide buttons.`;
    this.ui.startRaceButton.textContent = ready[this.localRole] ? "Ready" : "Ready";
    this.ui.startRaceButton.disabled = Boolean(ready[this.localRole]);

    if (!bothConnected) {
      this.ui.waitingText.textContent = this.localRole === "p1"
        ? `Share room code ${this.roomCode} with Kripa.`
        : "Waiting for Manan to reconnect.";
      return;
    }

    if (ready.p1 && ready.p2) {
      this.ui.waitingText.textContent = "Starting race...";
      return;
    }

    const readyNames = [];
    const waitingNames = [];
    if (ready.p1) {
      readyNames.push("Manan");
    } else {
      waitingNames.push("Manan");
    }
    if (ready.p2) {
      readyNames.push("Kripa");
    } else {
      waitingNames.push("Kripa");
    }

    this.ui.waitingText.textContent = readyNames.length
      ? `${readyNames.join(" and ")} ready. Waiting for ${waitingNames.join(" and ")}.`
      : (notice || "Both players connected. Tap Ready to race.");
  }

  setControlMode(mode) {
    const p1Buttons = document.querySelectorAll("[data-action^='p1']");
    const p2Buttons = document.querySelectorAll("[data-action^='p2']");
    const p1Cluster = document.querySelector(".left-controls");
    const p2Cluster = document.querySelector(".right-controls");

    p1Cluster.classList.toggle("local-controls", mode === "p1" || mode === "both");
    p2Cluster.classList.toggle("local-controls", mode === "p2" || mode === "both");

    p1Buttons.forEach((button) => {
      button.disabled = !(mode === "p1" || mode === "both");
    });
    p2Buttons.forEach((button) => {
      button.disabled = !(mode === "p2" || mode === "both");
    });
  }

  readyForRace() {
    if (this.mode === "practice") {
      this.startRace({
        mode: "practice",
        seed: Date.now() >>> 0,
        startAt: Date.now() + 650
      });
      return;
    }

    if (this.mode === "online") {
      this.ui.startRaceButton.disabled = true;
      this.ui.restartButton.disabled = true;
      this.ui.waitingText.textContent = "Ready. Waiting for the other player...";
      this.state = "lobby";
      this.showScreen("instructions");
      if (!this.network.sendReady()) {
        this.ui.startRaceButton.disabled = false;
      }
    }
  }

  startRace({ mode, seed, startAt }) {
    this.mode = mode;
    this.state = "countdown";
    this.showScreen("none");
    this.speed = 350;
    this.distance = 0;
    this.groundOffset = 0;
    this.spawnTimer = 0.95;
    this.obstacles = [];
    this.rng = new SeededRandom(seed || 1);
    this.startAt = startAt || Date.now();
    this.gameOverSent = false;
    this.ui.restartButton.disabled = false;

    this.players.forEach((player) => {
      player.reset();
    });
    this.updateScoreText();
  }

  handlePeerLeft(message) {
    if (this.mode !== "online") {
      return;
    }

    if (this.state === "playing" || this.state === "countdown") {
      this.state = "lobby";
      this.showScreen("instructions");
    }
    this.ui.waitingText.textContent = message;
    this.ui.startRaceButton.disabled = true;
  }

  handleControl(role, action, isPressed) {
    if (this.mode === "online" && role !== this.localRole) {
      return;
    }

    if (this.mode !== "practice" && this.mode !== "online") {
      return;
    }

    if (action === "jump" && !isPressed) {
      return;
    }

    const inputAction = action === "jump" ? "jump" : (isPressed ? "slideStart" : "slideEnd");

    if (this.applyInput(role, inputAction) && this.mode === "online") {
      this.network.sendInput(role, inputAction);
    }
  }

  applyInput(role, action) {
    if (this.state !== "playing") {
      return false;
    }

    const player = this.players[ROLE_INDEX[role]];
    if (!player) {
      return false;
    }

    if (action === "jump") {
      player.jump();
    }
    if (action === "slideStart") {
      player.startSlide();
    }
    if (action === "slideEnd") {
      player.stopSlide();
    }

    return true;
  }

  loop(time) {
    const seconds = time / 1000;
    const dt = Math.min(0.033, seconds - (this.lastTime || seconds));
    this.lastTime = seconds;

    this.update(dt, seconds);
    this.draw(seconds);
    requestAnimationFrame((nextTime) => this.loop(nextTime));
  }

  update(dt) {
    this.updateClouds(dt);
    this.players.forEach((player) => player.update(dt));

    if (this.state === "countdown") {
      if (Date.now() >= this.startAt) {
        this.state = "playing";
      } else {
        return;
      }
    }

    if (this.state !== "playing") {
      return;
    }

    this.speed = Math.min(760, this.speed + dt * 8.5);
    this.distance += (this.speed * dt) / 9;
    this.groundOffset = (this.groundOffset + this.speed * dt) % 48;

    this.players.forEach((player) => {
      if (player.alive) {
        player.score = Math.floor(this.distance);
      }
    });

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnObstacle();
      const speedPressure = Math.min(0.46, (this.speed - 350) / 900);
      this.spawnTimer = this.rng.between(1.05, 1.58) - speedPressure;
    }

    this.obstacles.forEach((obstacle) => obstacle.update(dt, this.speed));
    this.obstacles = this.obstacles.filter((obstacle) => !obstacle.isOffscreen());

    this.checkCollisions();
    this.updateScoreText();
  }

  updateClouds(dt) {
    this.clouds.forEach((cloud) => {
      const drift = this.state === "playing" ? cloud.speed : cloud.speed * 0.35;
      cloud.x -= drift * dt;
      if (cloud.x + cloud.width < -20) {
        cloud.x = WORLD_WIDTH + Math.random() * 120;
        cloud.y = 24 + Math.random() * 132;
      }
    });
  }

  spawnObstacle() {
    const roll = this.rng.next();
    let type = "cactus";
    if (roll > 0.75) {
      type = "bird";
    } else if (roll > 0.52) {
      type = "lowBarrier";
    } else if (roll > 0.28) {
      type = "rock";
    }
    this.obstacles.push(new Obstacle(type, WORLD_WIDTH + 35, this.groundY));
  }

  checkCollisions() {
    const playerIndices = this.mode === "online" && this.localRole
      ? [ROLE_INDEX[this.localRole]]
      : [0, 1];

    for (const obstacle of this.obstacles) {
      for (const index of playerIndices) {
        const player = this.players[index];
        if (player.alive && this.rectsOverlap(player.getHitbox(), obstacle.getHitbox())) {
          this.finishRace(index);
          return;
        }
      }
    }
  }

  finishRace(loserIndex) {
    if (this.state !== "playing" || this.gameOverSent) {
      return;
    }

    const loserRole = INDEX_ROLE[loserIndex];
    const winnerRole = loserRole === "p1" ? "p2" : "p1";
    const scores = {
      p1: this.players[0].score,
      p2: this.players[1].score
    };

    this.gameOverSent = true;
    if (this.mode === "online") {
      this.network.sendFinish(loserRole, scores);
    }
    this.applyGameOver(winnerRole, loserRole, scores);
  }

  applyGameOver(winnerRole, loserRole, scores = {}) {
    const winner = this.players[ROLE_INDEX[winnerRole]];
    const loser = this.players[ROLE_INDEX[loserRole]];

    this.players[0].score = Number.isFinite(scores.p1) ? scores.p1 : this.players[0].score;
    this.players[1].score = Number.isFinite(scores.p2) ? scores.p2 : this.players[1].score;

    this.players.forEach((player) => {
      player.sliding = false;
      player.outcome = "run";
    });

    if (winner) {
      winner.alive = true;
      winner.outcome = "win";
    }
    if (loser) {
      loser.alive = false;
      loser.outcome = "lose";
    }

    this.state = "gameOver";
    this.scoreEls.winner.textContent = `Winner: ${winner ? winner.name : "Nobody"}`;
    this.scoreEls.finalP1.textContent = `Manan: ${this.players[0].score} m`;
    this.scoreEls.finalP2.textContent = `Kripa: ${this.players[1].score} m`;
    this.resultEls.p1Status.textContent = winnerRole === "p1" ? "Dancing winner" : "Crying loser";
    this.resultEls.p2Status.textContent = winnerRole === "p2" ? "Dancing winner" : "Crying loser";
    this.ui.restartButton.disabled = false;
    this.updateScoreText();
    this.showScreen("gameOver");
  }

  rectsOverlap(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  updateScoreText() {
    this.scoreEls.p1.textContent = `${this.players[0].score} m`;
    this.scoreEls.p2.textContent = `${this.players[1].score} m`;
  }

  draw(time) {
    this.drawSky(time);
    this.drawGround();
    this.obstacles.forEach((obstacle) => obstacle.draw(this.ctx, time));
    this.players.forEach((player) => {
      const isLocal = this.localRole === "both" || this.localRole === player.role;
      player.draw(this.ctx, isLocal);
    });

    if (this.state === "countdown") {
      this.drawCountdown();
    }

    if (this.state === "gameOver") {
      this.drawResultAvatars();
    }
  }

  drawResultAvatars() {
    this.players.forEach((player, index) => {
      const canvas = index === 0 ? this.resultEls.p1Canvas : this.resultEls.p2Canvas;
      const ctx = this.resultContexts[index];
      if (!canvas || !ctx) {
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "rgba(23, 37, 59, 0.12)";
      ctx.fillRect(42, 184, 136, 12);
      player.sprite.draw(ctx, 8, 12, 204, 184, player.getAnimationState());
      ctx.restore();
    });
  }

  drawCountdown() {
    const msRemaining = Math.max(0, this.startAt - Date.now());
    const number = Math.max(1, Math.ceil(msRemaining / 1000));
    const ctx = this.ctx;

    ctx.save();
    ctx.fillStyle = "rgba(23, 37, 59, 0.28)";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.fillStyle = "#fff7b8";
    ctx.strokeStyle = "#17253b";
    ctx.lineWidth = 8;
    ctx.font = "900 92px 'Trebuchet MS', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText(String(number), WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    ctx.fillText(String(number), WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    ctx.restore();
  }

  drawSky(time) {
    const ctx = this.ctx;
    const skyGradient = ctx.createLinearGradient(0, 0, 0, this.groundY);
    skyGradient.addColorStop(0, "#7edcff");
    skyGradient.addColorStop(0.64, "#c9f7ff");
    skyGradient.addColorStop(1, "#fff1ab");
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    ctx.fillStyle = "#ffe36e";
    ctx.fillRect(WORLD_WIDTH - 98, 28, 46, 46);
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    this.clouds.forEach((cloud) => {
      this.drawCloud(cloud.x, cloud.y, cloud.width);
    });

    ctx.fillStyle = "rgba(64, 156, 113, 0.18)";
    const hillBase = this.groundY - 36;
    for (let x = -80; x < WORLD_WIDTH + 140; x += 160) {
      ctx.beginPath();
      ctx.moveTo(x, this.groundY);
      ctx.lineTo(x + 80, hillBase - 18 * Math.sin(time + x));
      ctx.lineTo(x + 170, this.groundY);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawCloud(x, y, width) {
    const unit = width / 8;
    this.ctx.fillRect(x + unit, y + unit, unit * 6, unit * 1.5);
    this.ctx.fillRect(x + unit * 2, y, unit * 2, unit * 2.3);
    this.ctx.fillRect(x + unit * 4.2, y + unit * 0.4, unit * 2.4, unit * 1.9);
  }

  drawGround() {
    const ctx = this.ctx;
    ctx.fillStyle = "#80d468";
    ctx.fillRect(0, this.groundY, WORLD_WIDTH, WORLD_HEIGHT - this.groundY);

    ctx.fillStyle = "#6c4d38";
    ctx.fillRect(0, this.groundY, WORLD_WIDTH, 8);

    ctx.fillStyle = "#523727";
    for (let x = -48 - this.groundOffset; x < WORLD_WIDTH + 48; x += 48) {
      ctx.fillRect(x, this.groundY + 18, 24, 7);
      ctx.fillRect(x + 30, this.groundY + 42, 12, 6);
    }

    ctx.fillStyle = "#2d9b5a";
    for (let x = -36 - (this.groundOffset * 0.7); x < WORLD_WIDTH + 60; x += 72) {
      ctx.fillRect(x, this.groundY - 9, 20, 5);
      ctx.fillRect(x + 26, this.groundY - 6, 13, 4);
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new Game();
});
