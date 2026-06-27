import { context, settings } from '@devvit/web/server';
import {
  expandToCities,
  inferCityFromSubreddit,
  inferScopeFromSubreddit,
  type CityName,
} from '../../shared';

/** Devvit's settings.get can return string | string[] | undefined for text/select settings. */
function normalizeSetting(raw: unknown): string | undefined {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    const values = raw.filter((value): value is string => typeof value === 'string');
    return values.length ? values.join(', ') : undefined;
  }
  return undefined;
}

export type CityResolution = {
  /** One or more cities to render together. Empty array = unresolved. */
  cityNames: CityName[];
  source: 'setting' | 'inferred-scope' | 'inferred-city' | 'none';
  /** Diagnostic info — never shown to end users. */
  debug: {
    rawSetting: unknown;
    normalizedSetting: string | undefined;
    subredditName: string | undefined;
  };
};

export async function resolveCity(): Promise<CityResolution> {
  const rawSetting = await settings.get('cityName').catch(() => undefined);
  const normalizedSetting = normalizeSetting(rawSetting);
  const subredditName = context.subredditName;
  const debug = { rawSetting, normalizedSetting, subredditName };

  // 1. Setting wins — could be a city or a scope name.
  if (normalizedSetting) {
    const cities = expandToCities(normalizedSetting);
    if (cities && cities.length) {
      return { cityNames: cities, source: 'setting', debug };
    }
  }

  // 2. Try inferring a multi-city scope from the sub name.
  const scope = inferScopeFromSubreddit(subredditName);
  if (scope) {
    const cities = expandToCities(scope);
    if (cities && cities.length) {
      return { cityNames: cities, source: 'inferred-scope', debug };
    }
  }

  // 3. Fall back to single-city inference.
  const inferred = inferCityFromSubreddit(subredditName);
  if (inferred) {
    return { cityNames: [inferred], source: 'inferred-city', debug };
  }

  return { cityNames: [], source: 'none', debug };
}
