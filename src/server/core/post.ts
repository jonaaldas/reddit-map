import { context, reddit } from '@devvit/web/server';

export const createPost = async () => {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error('subredditName is required');
  }
  return await reddit.submitCustomPost({
    userGeneratedContent: {
      text: `Live RedditMap for r/${subredditName}`,
    },
    subredditName,
    title: `🗺️ r/${subredditName} on a map`,
    entry: 'default',
  });
};
