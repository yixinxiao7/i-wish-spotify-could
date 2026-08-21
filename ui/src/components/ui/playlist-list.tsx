"use client"

import React, { useContext } from 'react';
import { Pin } from "lucide-react"

import { Checkbox } from "./checkbox"
import { Playlist } from '@/types/spotify';
import { sortPinnedFirst } from '@/utils/playlists';
import { PlaylistsContext } from '@/components/playlists-provider';

interface PlaylistListProps {
  /** Override the playlists rendered. Defaults to the PlaylistsProvider's playlists. */
  playlists?: Playlist[];
  /** Override the pin handler. Defaults to the PlaylistsProvider's togglePin. */
  onTogglePin?: (playlistId: string, pinned: boolean) => void;
  /** IDs currently selected in the caller's own selection state (e.g. add-to-playlist). */
  selectedIds?: Set<string>;
  /** Called when a row's selection checkbox is toggled. Selection checkbox is omitted if absent. */
  onToggleSelect?: (playlist: Playlist, checked: boolean) => void;
  emptyMessage?: string;
}

export const PlaylistList: React.FC<PlaylistListProps> = ({
  playlists: playlistsProp,
  onTogglePin: onTogglePinProp,
  selectedIds,
  onToggleSelect,
  emptyMessage = "No playlists available",
}) => {
  const context = useContext(PlaylistsContext);
  const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set());

  const sourcePlaylists = playlistsProp ?? context?.playlists ?? [];
  const playlists = sortPinnedFirst(sourcePlaylists);

  const handleTogglePin = async (playlist: Playlist) => {
    const nextPinned = !playlist.pinned;
    if (onTogglePinProp) {
      onTogglePinProp(playlist.id, nextPinned);
      return;
    }
    if (!context) return;

    setPendingIds((prev) => new Set(prev).add(playlist.id));
    try {
      await context.togglePin(playlist.id, nextPinned);
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(playlist.id);
        return next;
      });
    }
  };

  if (!playlists || playlists.length === 0) {
    return <p>{emptyMessage}</p>;
  }

  return (
    <ul>
      {playlists.map((playlist) => (
        <li
          key={playlist.id}
          className="flex items-center space-x-3 py-2 motion-reduce:transition-none"
        >
          <img
            src={playlist.playlist_image_url || '/default-playlist.png'}
            alt={playlist.name}
            width={44}
            height={44}
            loading="lazy"
            decoding="async"
            className="w-11 h-11 rounded-sm object-cover"
          />
          {onToggleSelect && (
            <Checkbox
              id={`playlist-${playlist.id}`}
              checked={selectedIds?.has(playlist.id) ?? false}
              onCheckedChange={(checked) =>
                onToggleSelect(playlist, checked === true)
              }
            />
          )}
          <label
            htmlFor={onToggleSelect ? `playlist-${playlist.id}` : undefined}
            className="truncate flex-1"
          >
            {playlist.name}
          </label>
          <button
            type="button"
            aria-pressed={!!playlist.pinned}
            aria-label={playlist.pinned ? `Unpin ${playlist.name}` : `Pin ${playlist.name}`}
            disabled={pendingIds.has(playlist.id)}
            onClick={(e) => {
              e.stopPropagation();
              handleTogglePin(playlist);
            }}
            className={`flex-shrink-0 rounded-full p-2 transition hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 motion-reduce:transition-none ${
              playlist.pinned
                ? "text-brand-green"
                : "text-brand-muted hover:text-brand-heading"
            }`}
          >
            <Pin
              className="h-4 w-4"
              aria-hidden="true"
              fill={playlist.pinned ? "currentColor" : "none"}
            />
          </button>
        </li>
      ))}
    </ul>
  );
}
