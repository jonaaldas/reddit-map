import type { Hood } from '../types';
import type { Pin } from './pin';
/** A unified post shape — caller normalizes from whatever Reddit API/trigger returned. */
export type NormalizedPost = {
    id: string;
    title: string;
    body: string;
    permalink: string;
    upvotes: number;
    numComments: number;
    createdUtc: number;
};
/** Returns a Pin if the post mentions a known neighborhood, else null. */
export declare function postToPin(post: NormalizedPost, hoods: readonly Hood[]): Pin | null;
