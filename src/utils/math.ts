export interface Vec2 {
  x: number;
  y: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

export function distanceSquared(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.sqrt(distanceSquared(a, b));
}

export function normalize(x: number, y: number): Vec2 {
  const len = Math.hypot(x, y);
  if (len === 0) {
    return { x: 0, y: 0 };
  }

  return { x: x / len, y: y / len };
}

export function angleToVector(angle: number): Vec2 {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

export function limitLength(x: number, y: number, maxLength: number): Vec2 {
  const len = Math.hypot(x, y);
  if (len === 0 || len <= maxLength) {
    return { x, y };
  }

  const factor = maxLength / len;
  return { x: x * factor, y: y * factor };
}
