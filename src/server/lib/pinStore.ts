import { redis } from '@devvit/web/server';
import type { Pin } from '../../shared';

const MAX_PINS = 250;
const key = (sub: string) => `pins:${sub}`;

export async function loadPins(sub: string): Promise<Pin[]> {
  const raw = await redis.get(key(sub));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Pin[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function savePins(sub: string, pins: Pin[]): Promise<void> {
  // Keep only the most recent N (by createdUtc desc) to bound the JSON blob.
  const trimmed = [...pins]
    .sort((a, b) => b.createdUtc - a.createdUtc)
    .slice(0, MAX_PINS);
  await redis.set(key(sub), JSON.stringify(trimmed));
}

export async function upsertPin(sub: string, pin: Pin): Promise<void> {
  const pins = await loadPins(sub);
  const others = pins.filter((p) => p.postId !== pin.postId);
  others.push(pin);
  await savePins(sub, others);
}

export async function removePin(sub: string, postId: string): Promise<boolean> {
  const id = postId.replace(/^t3_/, '');
  const pins = await loadPins(sub);
  const filtered = pins.filter((p) => p.postId !== id);
  if (filtered.length === pins.length) return false;
  await savePins(sub, filtered);
  return true;
}

export async function clearPins(sub: string): Promise<void> {
  await redis.del(key(sub));
}
