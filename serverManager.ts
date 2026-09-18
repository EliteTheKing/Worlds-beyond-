import type { Server as SocketIOServer, Socket } from "socket.io";
import type { ClientPlayerState, PlayerState } from "./types";

const MAX_PLAYERS_PER_SERVER = 40;

export interface GameServerRoom {
  id: string;
  players: Map<string, PlayerState>;
}

export class ServerManager {
  private rooms = new Map<string, GameServerRoom>();
  private socketToRoom = new Map<string, string>();

  constructor(private readonly io: SocketIOServer) {}

  assign(socket: Socket, initial: ClientPlayerState = {}): GameServerRoom {
    let room = this.findAvailableRoom();

    if (!room) {
      room = this.createRoom();
    }

    const player: PlayerState = {
      id: socket.id,
      name: sanitizeName(initial.name),
      level: clampInt(initial.level ?? 1, 1, 9999),
      x: finite(initial.x, 0),
      y: finite(initial.y, 0),
      z: finite(initial.z, 0),
      rotationY: finite(initial.rotationY, 0),
      hp: Math.max(0, finite(initial.hp, 100)),
      maxHp: Math.max(1, finite(initial.maxHp, 100)),
      appearance: initial.appearance ?? {},
      updatedAt: Date.now()
    };

    room.players.set(socket.id, player);
    this.socketToRoom.set(socket.id, room.id);
    socket.join(room.id);

    socket.emit("server:assigned", {
      serverId: room.id,
      playerId: socket.id,
      capacity: MAX_PLAYERS_PER_SERVER,
      players: Array.from(room.players.values())
    });

    socket.to(room.id).emit("player:joined", player);

    return room;
  }

  updatePlayer(socket: Socket, patch: ClientPlayerState): void {
    const room = this.getRoomForSocket(socket.id);
    const player = room?.players.get(socket.id);
    if (!room || !player) return;

    if (patch.name !== undefined) player.name = sanitizeName(patch.name);
    if (patch.level !== undefined) player.level = clampInt(patch.level, 1, 9999);
    if (patch.x !== undefined) player.x = finite(patch.x, player.x);
    if (patch.y !== undefined) player.y = finite(patch.y, player.y);
    if (patch.z !== undefined) player.z = finite(patch.z, player.z);
    if (patch.rotationY !== undefined) player.rotationY = finite(patch.rotationY, player.rotationY);
    if (patch.hp !== undefined) player.hp = Math.max(0, finite(patch.hp, player.hp));
    if (patch.maxHp !== undefined) player.maxHp = Math.max(1, finite(patch.maxHp, player.maxHp));
    if (patch.appearance !== undefined) player.appearance = patch.appearance;

    player.updatedAt = Date.now();
    socket.to(room.id).emit("player:updated", player);
  }

  remove(socket: Socket): void {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    this.socketToRoom.delete(socket.id);

    if (!room) return;

    room.players.delete(socket.id);
    socket.to(room.id).emit("player:left", { playerId: socket.id });

    if (room.players.size === 0) {
      this.rooms.delete(room.id);
    }
  }

  getRoomForSocket(socketId: string): GameServerRoom | undefined {
    const roomId = this.socketToRoom.get(socketId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  getStats() {
    return {
      servers: Array.from(this.rooms.values()).map((room) => ({
        id: room.id,
        players: room.players.size,
        capacity: MAX_PLAYERS_PER_SERVER
      })),
      totalPlayers: Array.from(this.rooms.values())
        .reduce((total, room) => total + room.players.size, 0)
    };
  }

  private findAvailableRoom(): GameServerRoom | undefined {
    for (let i = 1; ; i++) {
      const id = `server-${i}`;
      const room = this.rooms.get(id);

      if (!room) return undefined;
      if (room.players.size < MAX_PLAYERS_PER_SERVER) return room;
    }
  }

  private createRoom(): GameServerRoom {
    let i = 1;
    while (this.rooms.has(`server-${i}`)) i++;

    const room: GameServerRoom = {
      id: `server-${i}`,
      players: new Map()
    };

    this.rooms.set(room.id, room);
    return room;
  }
}

function finite(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(finite(value, min))));
}

function sanitizeName(value: string | undefined): string {
  const name = typeof value === "string" ? value.trim().slice(0, 24) : "";
  return name || "Player";
}
