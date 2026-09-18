import {
  qualifiesForScience,
  SCIENCE_PLACEMENT_THRESHOLD,
} from "../src/lib/placement-policy";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(
  SCIENCE_PLACEMENT_THRESHOLD === 55,
  "Science placement threshold must remain 55.",
);
assert(!qualifiesForScience(55), "A score of exactly 55% must not auto-qualify for Science.");
assert(
  qualifiesForScience(55.0001),
  "Any finite score above 55% must qualify for Science.",
);
assert(qualifiesForScience(100), "A score of 100% must qualify for Science.");
assert(!qualifiesForScience(0), "A score of 0% must not qualify for Science.");
assert(!qualifiesForScience(Number.NaN), "NaN must not qualify for Science.");
assert(!qualifiesForScience(Number.POSITIVE_INFINITY), "Infinity must not qualify for Science.");

console.log("Placement score policy validated.");
