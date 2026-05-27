import { extractLocation } from './extract';
const HOOD_JITTER = 0.005;
/** Returns a Pin if the post mentions a known neighborhood, else null. */
export function postToPin(post, hoods) {
    const text = `${post.title}\n\n${post.body}`;
    const match = extractLocation(text, hoods);
    if (!match)
        return null;
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
//# sourceMappingURL=postToPin.js.map