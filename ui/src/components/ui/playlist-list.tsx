"use client"

import React, { useContext, useMemo, useLayoutEffect, useRef } from 'react';
import Image from 'next/image';
import { ListMusic, Pin } from "lucide-react"

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
  /** Called when a row is activated as a navigation target. Row label becomes a button if present. */
  onSelectPlaylist?: (playlist: Playlist) => void;
  emptyMessage?: string;
}

export const PlaylistList: React.FC<PlaylistListProps> = ({
  playlists: playlistsProp,
  onTogglePin: onTogglePinProp,
  selectedIds,
  onToggleSelect,
  onSelectPlaylist,
  emptyMessage = "No playlists available",
}) => {
  const context = useContext(PlaylistsContext);
  const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set());

  const playlists = useMemo(
    () => sortPinnedFirst(playlistsProp ?? context?.playlists ?? []),
    [playlistsProp, context?.playlists]
  );
  const pinnedPlaylists = useMemo(() => playlists.filter((p) => p.pinned), [playlists]);
  const unpinnedPlaylists = useMemo(() => playlists.filter((p) => !p.pinned), [playlists]);
  const showGroups = pinnedPlaylists.length > 0 && unpinnedPlaylists.length > 0;

  // FLIP-style reorder animation: measure each row's position before this
  // render's DOM mutation lands, then on the next paint animate from its old
  // spot to its new one. Skipped under prefers-reduced-motion.
  const rowRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());

  useLayoutEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const nextRects = new Map<string, DOMRect>();
    rowRefs.current.forEach((el, id) => nextRects.set(id, el.getBoundingClientRect()));

    if (!prefersReducedMotion) {
      rowRefs.current.forEach((el, id) => {
        const prev = prevRectsRef.current.get(id);
        const next = nextRects.get(id);
        if (!prev || !next) return;
        const deltaY = prev.top - next.top;
        if (Math.abs(deltaY) < 1) return;
        el.style.transition = "none";
        el.style.transform = `translateY(${deltaY}px)`;
        requestAnimationFrame(() => {
          el.style.transition = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";
          el.style.transform = "";
        });
      });
    }

    prevRectsRef.current = nextRects;
  }, [playlists]);

  const setRowRef = (id: string) => (el: HTMLLIElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  };

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

  const renderRow = (playlist: Playlist) => (
    <li
      key={playlist.id}
      ref={setRowRef(playlist.id)}
      className="flex items-center space-x-3 py-2 pr-1"
    >
      {playlist.playlist_image_url ? (
        <Image
          src={playlist.playlist_image_url}
          alt=""
          width={44}
          height={44}
          loading="lazy"
          className="w-11 h-11 flex-shrink-0 rounded-sm object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-sm bg-brand-footer text-brand-muted"
        >
          <ListMusic className="h-5 w-5" />
        </div>
      )}
      {onToggleSelect && (
        <Checkbox
          id={`playlist-${playlist.id}`}
          checked={selectedIds?.has(playlist.id) ?? false}
          onCheckedChange={(checked) =>
            onToggleSelect(playlist, checked === true)
          }
        />
      )}
      {onSelectPlaylist ? (
        <button
          type="button"
          onClick={() => onSelectPlaylist(playlist)}
          className="truncate flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {playlist.name}
        </button>
      ) : (
        <label
          htmlFor={onToggleSelect ? `playlist-${playlist.id}` : undefined}
          className="truncate flex-1"
        >
          {playlist.name}
        </label>
      )}
      <button
        type="button"
        aria-pressed={!!playlist.pinned}
        aria-label={playlist.pinned ? `Unpin ${playlist.name}` : `Pin ${playlist.name}`}
        disabled={pendingIds.has(playlist.id)}
        onClick={(e) => {
          e.stopPropagation();
          handleTogglePin(playlist);
        }}
        className={`relative flex-shrink-0 rounded-full p-2 transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 motion-reduce:transition-none ${
          playlist.pinned
            ? "text-brand-green-fg"
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
  );

  if (!showGroups) {
    return <ul>{playlists.map(renderRow)}</ul>;
  }

  return (
    <div>
      <p
        id="pinned-playlists-heading"
        className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-muted"
      >
        Pinned
      </p>
      <ul aria-labelledby="pinned-playlists-heading">
        {pinnedPlaylists.map(renderRow)}
      </ul>
      <p
        id="all-playlists-heading"
        className="mb-1 mt-3 border-t border-border pt-3 text-xs font-semibold uppercase tracking-wide text-brand-muted"
      >
        All playlists
      </p>
      <ul aria-labelledby="all-playlists-heading">
        {unpinnedPlaylists.map(renderRow)}
      </ul>
    </div>
  );
}
