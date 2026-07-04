"use strict";

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8000);
const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const rooms = new Map();

const server = http.createServer((request, response) => {
  serveStaticFile(request, response);
});

server.on("upgrade", (request, socket) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (requestUrl.pathname !== "/ws") {
    socket.destroy();
    return;
  }

  const key = request.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }

  const accept = crypto
    .createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");

  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "",
    ""
  ].join("\r\n"));

  const peer = {
    id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex"),
    socket,
    buffer: Buffer.alloc(0),
    room: null,
    role: null
  };

  socket.on("data", (chunk) => readFrames(peer, chunk));
  socket.on("close", () => leaveRoom(peer));
  socket.on("error", () => leaveRoom(peer));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Avatar Dash Duel server running at http://localhost:${PORT}`);
  console.log("Open this URL on both devices, or deploy this folder to a public Node host for different networks.");
});

function serveStaticFile(request, response) {
  let pathname = "/";
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host || "localhost"}`).pathname);
  } catch (error) {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.normalize(path.join(ROOT, relativePath));

  const relativeToRoot = path.relative(ROOT, filePath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store"
    });
    response.end(data);
  });
}

function readFrames(peer, chunk) {
  peer.buffer = Buffer.concat([peer.buffer, chunk]);

  while (peer.buffer.length >= 2) {
    const firstByte = peer.buffer[0];
    const secondByte = peer.buffer[1];
    const opcode = firstByte & 0x0f;
    const masked = (secondByte & 0x80) !== 0;
    let length = secondByte & 0x7f;
    let offset = 2;

    if (length === 126) {
      if (peer.buffer.length < offset + 2) {
        return;
      }
      length = peer.buffer.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (peer.buffer.length < offset + 8) {
        return;
      }
      const high = peer.buffer.readUInt32BE(offset);
      const low = peer.buffer.readUInt32BE(offset + 4);
      length = high * 4294967296 + low;
      offset += 8;
    }

    const maskLength = masked ? 4 : 0;
    if (peer.buffer.length < offset + maskLength + length) {
      return;
    }

    let payload = peer.buffer.subarray(offset + maskLength, offset + maskLength + length);
    if (masked) {
      const mask = peer.buffer.subarray(offset, offset + 4);
      const unmasked = Buffer.alloc(payload.length);
      for (let i = 0; i < payload.length; i += 1) {
        unmasked[i] = payload[i] ^ mask[i % 4];
      }
      payload = unmasked;
    }

    peer.buffer = peer.buffer.subarray(offset + maskLength + length);

    if (opcode === 0x8) {
      peer.socket.end();
      leaveRoom(peer);
      return;
    }

    if (opcode === 0x9) {
      sendFrame(peer.socket, payload, 0xA);
      continue;
    }

    if (opcode === 0x1) {
      handleClientMessage(peer, payload.toString("utf8"));
    }
  }
}

function sendFrame(socket, payload, opcode = 0x1) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  let header;

  if (data.length < 126) {
    header = Buffer.from([0x80 | opcode, data.length]);
  } else if (data.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(data.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(data.length, 6);
  }

  socket.write(Buffer.concat([header, data]));
}

function send(peer, message) {
  if (!peer || peer.socket.destroyed) {
    return;
  }

  sendFrame(peer.socket, JSON.stringify(message));
}

function broadcast(room, message) {
  ["p1", "p2"].forEach((role) => {
    send(room.peers[role], message);
  });
}

function broadcastRoomState(room, notice = "") {
  broadcast(room, {
    type: "roomState",
    players: getRoomPlayers(room),
    ready: room.ready,
    notice
  });
}

function handleClientMessage(peer, rawMessage) {
  let message;
  try {
    message = JSON.parse(rawMessage);
  } catch (error) {
    send(peer, { type: "error", message: "Invalid message." });
    return;
  }

  if (message.type === "create") {
    createRoom(peer);
    return;
  }

  if (message.type === "join") {
    joinRoom(peer, String(message.roomCode || ""));
    return;
  }

  if (message.type === "ready") {
    markReady(peer);
    return;
  }

  if (message.type === "input") {
    relayInput(peer, message);
    return;
  }

  if (message.type === "finish") {
    finishRace(peer, message);
  }
}

function createRoom(peer) {
  leaveRoom(peer);

  const roomCode = createRoomCode();
  const room = {
    code: roomCode,
    peers: { p1: peer, p2: null },
    ready: { p1: false, p2: false },
    phase: "lobby",
    round: 0,
    finished: false
  };

  peer.room = room;
  peer.role = "p1";
  rooms.set(roomCode, room);

  send(peer, {
    type: "room",
    roomCode,
    role: "p1",
    players: getRoomPlayers(room),
    ready: room.ready
  });
  broadcastRoomState(room, `Room ${roomCode} created.`);
}

function joinRoom(peer, roomCode) {
  const normalizedCode = roomCode.trim().toUpperCase();
  const room = rooms.get(normalizedCode);

  if (!room) {
    send(peer, { type: "error", message: "Room not found." });
    return;
  }

  const openRole = room.peers.p1 ? (room.peers.p2 ? null : "p2") : "p1";
  if (!openRole) {
    send(peer, { type: "error", message: "Room is already full." });
    return;
  }

  leaveRoom(peer);
  peer.room = room;
  peer.role = openRole;
  room.peers[openRole] = peer;
  room.ready[openRole] = false;

  send(peer, {
    type: "room",
    roomCode: room.code,
    role: openRole,
    players: getRoomPlayers(room),
    ready: room.ready
  });
  broadcastRoomState(room, `${openRole === "p1" ? "Manan" : "Kripa"} joined.`);
}

function markReady(peer) {
  const room = peer.room;
  if (!room || !peer.role) {
    send(peer, { type: "error", message: "Create or join a room first." });
    return;
  }

  if (!room.peers.p1 || !room.peers.p2) {
    room.ready[peer.role] = true;
    broadcastRoomState(room, "Waiting for the second player.");
    return;
  }

  room.ready[peer.role] = true;
  if (room.ready.p1 && room.ready.p2) {
    startRound(room);
  } else {
    broadcastRoomState(room, `${peer.role === "p1" ? "Manan" : "Kripa"} is ready.`);
  }
}

function startRound(room) {
  room.phase = "playing";
  room.finished = false;
  room.round += 1;
  const seed = crypto.randomBytes(4).readUInt32BE(0);
  const startAt = Date.now() + 1500;

  broadcast(room, {
    type: "start",
    round: room.round,
    seed,
    startAt
  });
}

function relayInput(peer, message) {
  const room = peer.room;
  if (!room || room.phase !== "playing" || message.role !== peer.role) {
    return;
  }

  const action = String(message.action || "");
  if (!["jump", "slideStart", "slideEnd"].includes(action)) {
    return;
  }

  broadcast(room, {
    type: "input",
    role: peer.role,
    action,
    sequence: Number(message.sequence || 0)
  });
}

function finishRace(peer, message) {
  const room = peer.room;
  if (!room || room.phase !== "playing" || room.finished) {
    return;
  }

  const loserRole = peer.role;
  const winnerRole = loserRole === "p1" ? "p2" : "p1";
  const scores = sanitizeScores(message.scores || {});

  room.finished = true;
  room.phase = "gameOver";
  room.ready = { p1: false, p2: false };

  broadcast(room, {
    type: "gameOver",
    winnerRole,
    loserRole,
    scores
  });
}

function leaveRoom(peer) {
  const room = peer.room;
  if (!room || !peer.role) {
    return;
  }

  const oldRole = peer.role;
  if (room.peers[oldRole] === peer) {
    room.peers[oldRole] = null;
    room.ready[oldRole] = false;
  }

  peer.room = null;
  peer.role = null;

  if (!room.peers.p1 && !room.peers.p2) {
    rooms.delete(room.code);
    return;
  }

  room.phase = "lobby";
  room.finished = false;
  room.ready = { p1: false, p2: false };
  broadcast(room, {
    type: "peerLeft",
    notice: `${oldRole === "p1" ? "Manan" : "Kripa"} left the room.`
  });
  broadcastRoomState(room);
}

function getRoomPlayers(room) {
  return {
    p1: Boolean(room.peers.p1),
    p2: Boolean(room.peers.p2)
  };
}

function sanitizeScores(scores) {
  return {
    p1: sanitizeScore(scores.p1),
    p2: sanitizeScore(scores.p2)
  };
}

function sanitizeScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(999999, Math.floor(value)));
}

function createRoomCode() {
  let code = "";
  do {
    code = "";
    for (let i = 0; i < 4; i += 1) {
      code += ROOM_ALPHABET[crypto.randomInt(ROOM_ALPHABET.length)];
    }
  } while (rooms.has(code));
  return code;
}
