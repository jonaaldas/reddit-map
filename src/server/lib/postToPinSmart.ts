import { type MapCity, type NormalizedPost, type Pin } from '@redditmap/shared';
import { llmExtract } from './llmExtract';

/**
 * LLM-only extraction across one or more cities. Tries each city in order;
 * the bbox guard inside llmExtract drops hits outside the city, so the
 * first city whose bbox contains the venue wins.
 */
export async function postToPinSmart(
  post: NormalizedPost,
  cities: readonly MapCity[],
): Promise<Pin | null> {
  for (const city of cities) {
    const llm = await llmExtract(post, city);
    if (!llm) continue;
    return {
      postId: post.id.replace(/^t[0-9]+_/, ''),
      title: post.title,
      permalink: post.permalink,
      upvotes: post.upvotes,
      numComments: post.numComments,
      createdUtc: post.createdUtc,
      hood: llm.place_name,
      lat: llm.lat,
      lng: llm.lng,
      city: city.shortName,
    };
  }
  return null;
}
