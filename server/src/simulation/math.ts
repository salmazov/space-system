export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundCredits(value: number): number {
  return Math.round(value * 100) / 100;
}