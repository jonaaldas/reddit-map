import type { CityName } from '../types';
export type Pin = {
    postId: string;
    title: string;
    permalink: string;
    upvotes: number;
    numComments: number;
    createdUtc: number;
    hood: string;
    lat: number;
    lng: number;
    /** Which city the venue was matched against. Optional for back-compat. */
    city?: CityName;
};
export type PinsResponse = {
    pins: Pin[];
};
