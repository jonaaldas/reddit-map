// Pure gazetteer-based location extractor. Given a chunk of text and a list
// of known neighborhoods, finds the longest neighborhood name that appears
// as a whole word in the text.
//
// No I/O, no API calls — safe to run in any runtime.

import type { Hood } from '../types';

export type LocationMatch = {
  hood: Hood;
  matchedText: string;
};

export function extractLocation(
  text: string,
  hoods: readonly Hood[],
): LocationMatch | null {
  if (!text || !hoods.length) return null;
  // Try longer names first so "Hayes Valley" beats "Valley" (if we ever add the latter).
  const sorted = [...hoods].sort((a, b) => b.n.length - a.n.length);
  for (const hood of sorted) {
    const re = new RegExp(`(^|\\W)(${escapeRegex(hood.n)})(?=\\W|$)`, 'i');
    const m = text.match(re);
    if (m && m[2]) return { hood, matchedText: m[2] };
  }
  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
