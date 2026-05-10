export function roundCredits(value: number): number {
  return Math.round(value * 100) / 100;
}