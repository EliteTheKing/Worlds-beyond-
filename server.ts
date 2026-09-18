import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { ServerManager } from "./serverManager";
import type { ClientPlayerState } from "./types";

const app = express();
const httpServer = http.createServer(app);

const allowedOrigins = (process.env.CLIENT_ORIGIN ?? "*")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.includes("*") ? true : allowedOrigins,
  methods: ["GET", "POST"]
}));
app.use(express.json());

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins.includes("*") ? "*" : allowedOrigins,
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"]
});

const manager = new ServerManager(io);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "worlds-beyond-multiplayer",
    uptime: process.uptime(),
    ...manager.getStats()
  });
});

app.get("/", (_req, res) => {
  res.json({
    service: "Worlds Beyond Multiplayer Server",
    status: "online",
    health: "/health"
  });
});

io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on("player:join", (state: ClientPlayerState = {}) => {
    if (manager.getRoomForSocket(socket.id)) return;
    manager.assign(socket, state);
    console.log(`[join] ${socket.id} -> ${manager.getRoomForSocket(socket.id)?.id}`);
  });

  socket.on("player:update", (patch: ClientPlayerState = {}) => {
    manager.updatePlayer(socket, patch);
  });

  socket.on("ping:client", () => {
    socket.emit("pong:server", { at: Date.now() });
  });

  socket.on("disconnect", (reason) => {
    const room = manager.getRoomForSocket(socket.id);
    console.log(`[disconnect] ${socket.id} from ${room?.id ?? "unassigned"} (${reason})`);
    manager.remove(socket);
  });
});

const PORT = Number(process.env.PORT) || 3000;

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Worlds Beyond multiplayer server listening on port ${PORT}`);
});
