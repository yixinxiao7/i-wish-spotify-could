import { Playlist } from '@/types/spotify';

/**
 * Orders playlists pinned-first, preserving relative order within each
 * group. Mirrors the backend's apply_pins ordering so optimistic pin
 * updates can reposition rows before the server confirms them.
 */
export function sortPinnedFirst(playlists: Playlist[]): Playlist[] {
  const pinned: Playlist[] = [];
  const unpinned: Playlist[] = [];
  for (const playlist of playlists) {
    if (playlist.pinned) {
      pinned.push(playlist);
    } else {
      unpinned.push(playlist);
    }
  }
  return [...pinned, ...unpinned];
}
