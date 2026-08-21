"use client"

import React, { useContext } from 'react';

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

const PinIcon: React.FC<{ pinned: boolean }> = ({ pinned }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill={pinned ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={1.5}
    className="h-4 w-4"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.5 2.5l8 8-3 1-3.5 5-1.5-1.5 1-4-4-4 1-3 2 1.5z"
    />
  </svg>
);

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
            className="flex-shrink-0 rounded-full p-2 text-brand-muted transition hover:bg-foreground/10 hover:text-brand-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <PinIcon pinned={!!playlist.pinned} />
          </button>
        </li>
      ))}
    </ul>
  );
}
