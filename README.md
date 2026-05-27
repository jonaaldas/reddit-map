# Reddit Maps

A mod-powered map layer that turns subreddit posts and comments into local intel — food spots, safety tips, hidden gems, and neighborhood vibes — making communities easier to explore and more engaging.

Built on Reddit's Devvit platform.

---

## What it does

Reddit Maps is a mod tool that transforms subreddit posts and comments into an interactive map displayed directly inside the subreddit.

Mods install the tool, set their filters, and write an AI prompt that tells the system what to look for. The AI scans subreddit conversations, identifies real places being discussed, and pins them geographically on a map that sits at the top of the subreddit. Each pin links directly back to the original Reddit post or comment where the location was mentioned.

Once installed, users can explore their community's collective knowledge visually — no more scrolling through endless threads to find a recommendation.

---

## How it works

**For moderators:**

1. Install Reddit Maps from Reddit's mod tools — free, one click
2. Configure the map:
   - Add one or multiple cities (each gets its own switchable layer)
   - Write an AI prompt — e.g. "Show Asian restaurants mentioned positively in Bogotá and Quito" — or pick from suggested templates
   - Set filters: posts to scan, date range, minimum mentions, sentiment
   - Toggle negative posts on/off (warnings appear as red pins)
3. Preview the map before publishing — when it looks right, hit publish

The map updates automatically as new posts come in. Mods set it up once and don't touch it again.

**For users:**

- The map appears directly inside the subreddit — no external links, no leaving Reddit
- Click any pin to see the post title, subreddit, and upvote count
- Tap through to the original thread for full context
- As community members post about new places, they get added to the map automatically

---

## Moderator configuration options

| Setting        | Options                                    |
| -------------- | ------------------------------------------ |
| Cities         | One or multiple, comma separated           |
| AI prompt      | Free text or suggested templates           |
| Posts to scan  | 100 / 200 / 500 most recent                |
| Date range     | Last 7 days / 30 days / 90 days / All time |
| Min. mentions  | Any / 2+ / 3+ / 5+                         |
| Sentiment      | Positive only / Positive + negative / All  |
| Negative posts | Toggle — shown as red pins                 |

---

## Built with

- Devvit (Reddit's developer platform)
- Reddit API for posts and comments
- Redis for storage
- OpenAI for AI prompt processing
- Leaflet.js for map rendering
- Vue
- Hono
- TypeScript
- Tailwind CSS

---

## AI processing costs

Reddit's API is free on the Devvit platform. The AI processing that extracts locations, categories, and sentiment from posts does have a cost — currently mods connect their own AI API key.

Based on testing with GPT-5.4 mini (~4,000 tokens per post thread, linear scaling):

| Posts scanned | Estimated cost |
| ------------- | -------------- |
| 50 posts      | ~$0.58         |
| 100 posts     | ~$1.17         |
| 150 posts     | ~$1.75         |

Costs vary based on comment depth and subreddit activity. Mods can control costs by limiting posts scanned, comment recursion depth, and update frequency. Long-term we plan to offer suggested spending caps and optimization recommendations.

---

## Current status

Beta. Working prototype tested on:

- r/submaps_dev — NYC food recommendations from r/AskNYC (bagels, pizza, tacos)
- r/InternationalAndes — Asian restaurants across Bogotá and Quito

The core map functionality works. The mod setup experience is functional but still being refined — particularly around simplifying the AI prompt for non-technical moderators.

---

## Known challenges

**Moderator UX** — the AI prompt is currently more technical than we'd like. The long-term goal is a simple dropdown-based setup that auto-generates the prompt. For now, we provide templates and guidance.

**Location handling** — locations need to exist within the mapping system before they can render properly. This gets complicated for subreddits covering multiple cities or less common places. We handle this but it's an area of active improvement.

**AI cost** — workable at current scale but a real consideration for large subreddits. We're exploring ways to reduce this in partnership with Reddit.

---

## Roadmap

**Near term**

- Simplified mod setup — dropdown filters that auto-generate the AI prompt
- Improved mobile experience (same-window rendering for iOS and Android)
- Easier community installation guide

**Medium term**

- Multiple map layers and category filters within a single subreddit
- User-contributed pins
- Advanced filtering — by neighborhood, post popularity, time period
- Themed maps — "best date spots," "family-friendly," "tourist traps"

**Longer term**

- RedditMaps.com — a standalone site where maps from across Reddit are browsable in one place, each pin linking back to the original post
- Sponsored pins for businesses already being discussed organically, with full mod approval control
- A broader visual layer for Reddit as a whole — exploring conversations geographically, not just through text threads

---

## Team

**Max Cordova** (u/bookflow) — concept, strategy, Reddit community outreach, product direction

**Jona** (u/Jonaaldas) — development

**Hana** (u/HLWriter) — operations, UX, project management

---

## Try it

- Working demo: [r/submaps_dev](https://www.reddit.com/r/submaps_dev/)
- Website: [redditmaps.com](https://redditmaps.com)
- Built at Reddit's hackathon on the Devvit platform

---

## Contact

hello@redditmaps.com
