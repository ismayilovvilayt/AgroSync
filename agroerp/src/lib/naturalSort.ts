/**
 * Natural sort helper for field numbers like "1", "1.1", "1.2", "2", "10", "10.1"
 * Ensures numeric ordering instead of lexicographic ordering.
 */

/** Parse a field number string into sortable numeric parts */
function parseFieldNumber(fn: string): number[] {
  return fn.split(/[.\-\/]/).map(part => {
    const n = parseInt(part, 10);
    return isNaN(n) ? 0 : n;
  });
}

/**
 * Compare two field number strings naturally.
 * "1" < "1.1" < "1.2" < "2" < "10" < "10.1"
 */
export function compareFieldNumbers(a: string, b: string): number {
  const partsA = parseFieldNumber(a);
  const partsB = parseFieldNumber(b);
  const maxLen = Math.max(partsA.length, partsB.length);
  
  for (let i = 0; i < maxLen; i++) {
    const na = partsA[i] ?? 0;
    const nb = partsB[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

/**
 * Sort an array of items by field number using natural sort.
 * Items must have a fieldNumber property (directly or nested).
 */
export function sortByFieldNumber<T>(
  items: T[],
  getFieldNumber: (item: T) => string
): T[] {
  return [...items].sort((a, b) => 
    compareFieldNumbers(getFieldNumber(a), getFieldNumber(b))
  );
}
