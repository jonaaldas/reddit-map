// A Pin is a Reddit post that has been geo-tagged via the gazetteer.
// Stored in Devvit redis as JSON, served to the iframe over /api/pins.

import type { CityName } from '../types';

export type Pin = {
  postId: string;       // T3 id (e.g. t3_abc123)
  title: string;
  permalink: string;
  upvotes: number;
  numComments: number;
  createdUtc: number;   // seconds since epoch
  hood: string;
  lat: number;
  lng: number;
  /** Which city the venue was matched against. Optional for back-compat. */
  city?: CityName;
};

export type PinsResponse = { pins: Pin[] };
