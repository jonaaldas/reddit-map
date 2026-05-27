import type { Hood } from '../types';
export type LocationMatch = {
    hood: Hood;
    matchedText: string;
};
export declare function extractLocation(text: string, hoods: readonly Hood[]): LocationMatch | null;
