import { type CityName, type NormalizedPost, type Pin } from '../../shared';
import { llmExtract } from './llmExtract';

/**
 * LLM-only extraction. Returns a Pin only if the post names a specific
 * food/nightlife venue (per the prompt in llmExtract). Neighborhoods,
 * generic recommendations, and non-food posts return null.
 */
export async function postToPinSmart(
  post: NormalizedPost,
  cities: CityName | readonly CityName[],
): Promise<Pin | null> {
  const list: readonly CityName[] = Array.isArray(cities)
    ? cities
    : [cities as CityName];
  for (const city of list) {
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
      city,
    };
  }
  return null;
}
