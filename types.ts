export type PlayerAppearance = Record<string, unknown>;

export interface PlayerState {
  id: string;
  name: string;
  level: number;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  hp: number;
  maxHp: number;
  appearance: PlayerAppearance;
  updatedAt: number;
}

export interface ClientPlayerState {
  name?: string;
  level?: number;
  x?: number;
  y?: number;
  z?: number;
  rotationY?: number;
  hp?: number;
  maxHp?: number;
  appearance?: PlayerAppearance;
}

export interface WorldEntityState {
  id: string;
  type: string;
  x: number;
  y: number;
  z: number;
  rotationY?: number;
  hp?: number;
  maxHp?: number;
  alive?: boolean;
  metadata?: Record<string, unknown>;
}
