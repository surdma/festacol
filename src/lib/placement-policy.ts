export const SCIENCE_PLACEMENT_THRESHOLD = 55;

export function qualifiesForScience(score: number): boolean {
  return Number.isFinite(score) && score > SCIENCE_PLACEMENT_THRESHOLD;
}
