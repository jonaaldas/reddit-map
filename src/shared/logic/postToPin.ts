import type { Hood } from '../types';
import { extractLocation } from './extract';
import type { Pin } from './pin';

const HOOD_JITTER = 0.005;

/** A unified post shape — caller normalizes from whatever Reddit API/trigger returned. */
export type NormalizedPost = {
  id: string;
  title: string;
  body: string;
  permalink: string;
  upvotes: number;
  numComments: number;
  createdUtc: number; // seconds
};

/** Returns a Pin if the post mentions a known neighborhood, else null. */
export function postToPin(post: NormalizedPost, hoods: readonly Hood[]): Pin | null {
  const text = `${post.title}\n\n${post.body}`;
  const match = extractLocation(text, hoods);
  if (!match) return null;
  return {
    postId: post.id.replace(/^t3_/, ''),
    title: post.title,
    permalink: post.permalink,
    upvotes: post.upvotes,
    numComments: post.numComments,
    createdUtc: post.createdUtc,
    hood: match.hood.n,
    lat: match.hood.lat + (Math.random() - 0.5) * HOOD_JITTER,
    lng: match.hood.lng + (Math.random() - 0.5) * HOOD_JITTER,
  };
}
