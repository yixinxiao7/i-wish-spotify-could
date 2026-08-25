"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import { getPlaylistSongsEndpoint, POST_PLAYLISTS_ADD_SONG_ENDPOINT } from '@/utils/config';
import { PlaylistSong } from '@/types/spotify';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { SongCard } from '@/components/ui/song';
import { SongListPagination } from '@/components/ui/song-list-pagination';
import { SongCardSkeleton } from '@/components/ui/song-card-skeleton';
import { clampOffsetPage, resetForLimitChange } from '@/utils/pagination';
import { useDeferredRowAction } from '@/hooks/use-deferred-row-action';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type SortKey = "playlist" | "added_asc" | "added_desc" | "affinity_asc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "playlist", label: "Playlist order" },
  { value: "added_asc", label: "Oldest added first" },
  { value: "added_desc", label: "Newest added first" },
  { value: "affinity_asc", label: "Least listened first" },
];

// Mirrors GET /api/playlists/{id}/songs's affinity.reason values (see
// api/app/services/affinity_service.py). Only "missing_scope" is fixed by
// logging out and back in — telling the user to do that for any other
// cause sends them to burn their session on a step that won't help.
function describeAffinityUnavailable(reason: string | null): string {
  if (reason === "missing_scope") {
    return "Least-listened sorting needs one more permission — log out and back in to enable it.";
  }
  if (reason === "upstream_error") {
    return "Least-listened sorting is temporarily unavailable — try again later.";
  }
  return "Least-listened sorting is unavailable right now.";
}

function buildSongsUrl(
  sourceId: string,
  destinationId: string,
  fetchOffset: number,
  fetchLimit: number,
  fetchSort: SortKey
) {
  const url = new URL(getPlaylistSongsEndpoint(sourceId, destinationId));
  const params = new URLSearchParams(url.search);
  params.set("offset", String(fetchOffset));
  params.set("limit", String(fetchLimit));
  params.set("sort", fetchSort);
  url.search = params.toString();
  return url;
}

// Matches the backend's undo window exactly, so the toast's progress bar
// and the moment the add actually fires never disagree.
const ADD_WINDOW_MS = 10000;
// Album art is this page's LCP element. Rows within this count are already
// in the viewport on first render, so their art loads eagerly.
const ABOVE_FOLD_ROW_COUNT = 3;
// A stable reference so React.memo on SongCard isn't defeated by a fresh
// arrow function on every render — this page has no refresh action of its
// own, unlike /organize.
const noop = () => {};

const PropagateSongsView: React.FC = () => {
  const params = useParams<{ destinationId: string; sourceId: string }>();
  const { destinationId, sourceId } = params;
  const { showToast } = useToast();

  const [playlistName, setPlaylistName] = useState<string | null>(null);
  const [songs, setSongs] = useState<PlaylistSong[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(10);
  const [sort, setSort] = useState<SortKey>("playlist");
  const [affinityAvailable, setAffinityAvailable] = useState(true);
  const [affinityReason, setAffinityReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  // Distinguishes "the source has no songs at all" from "every source song
  // is already in the destination" — both read as total === 0 from the
  // exclusion-applied response, so an empty page checks the source's
  // unfiltered total once to tell them apart.
  const [sourceIsEmpty, setSourceIsEmpty] = useState(false);

  const fetchPage = useCallback(
    async (fetchOffset: number, fetchLimit: number, fetchSort: SortKey) => {
      setLoading(true);
      setLoadError(null);
      setNotFound(false);
      try {
        const url = buildSongsUrl(sourceId, destinationId, fetchOffset, fetchLimit, fetchSort);
        const response = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
        if (response.status === 404) {
          setNotFound(true);
          return;
        }
        if (!response.ok) {
          let detail = "Failed to load this playlist. Please try again.";
          try {
            const body = await response.json();
            if (body?.detail) detail = body.detail;
          } catch {
            // Non-JSON error body; keep the generic message.
          }
          throw new Error(detail);
        }
        const data = await response.json();
        setPlaylistName(data.playlist.name);
        setSongs(data.songs);
        setTotal(data.total);
        setAffinityAvailable(data.affinity.available);
        setAffinityReason(data.affinity.reason);

        if (data.total === 0) {
          const rawUrl = new URL(getPlaylistSongsEndpoint(sourceId));
          rawUrl.search = new URLSearchParams({ offset: "0", limit: "1", sort: "playlist" }).toString();
          const rawResponse = await fetch(rawUrl, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          });
          if (rawResponse.ok) {
            const rawData = await rawResponse.json();
            setSourceIsEmpty(rawData.total === 0);
          }
        } else {
          setSourceIsEmpty(false);
        }
      } catch (error) {
        console.error("Error loading playlist songs:", error);
        setLoadError((error as Error).message || "Failed to load this playlist. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [sourceId, destinationId]
  );

  useEffect(() => {
    fetchPage(0, 10, "playlist");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId, destinationId]);

  const runLoad = (fetchOffset: number, fetchLimit: number, fetchSort: SortKey, newPage: number) => {
    setCurrentPage(newPage);
    setOffset(fetchOffset);
    setLimit(fetchLimit);
    setSort(fetchSort);
    fetchPage(fetchOffset, fetchLimit, fetchSort);
  };

  const handleSortChange = (value: SortKey) => {
    const reset = resetForLimitChange();
    runLoad(reset.offset, limit, value, reset.page);
  };

  const handleLimitChange = (value: number) => {
    const reset = resetForLimitChange();
    runLoad(reset.offset, value, sort, reset.page);
  };

  // Shared with the organize/cleanup pages' handler via clampOffsetPage, so
  // every paginated song list behaves identically.
  const handleOffsetChange = (newOffset: number, newPage: number) => {
    const clamped = clampOffsetPage(newOffset, newPage, total, limit);
    runLoad(clamped.offset, limit, sort, clamped.page);
  };

  const handlePrevPage = () => {
    if (currentPage <= 1) return;
    handleOffsetChange(offset - limit, currentPage - 1);
  };

  const performAdd = useCallback(
    async (song: PlaylistSong, opts?: { keepalive?: boolean }) => {
      const response = await fetch(POST_PLAYLISTS_ADD_SONG_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: opts?.keepalive,
        body: JSON.stringify({ songId: song.id, playlistIds: [destinationId] }),
      });
      if (response.status === 403) {
        throw new Error("permission");
      }
      if (!response.ok) {
        throw new Error("failed");
      }
    },
    [destinationId]
  );

  const handleAddError = useCallback(
    (song: PlaylistSong, error: unknown) => {
      const message =
        (error as Error).message === "permission"
          ? `The playlist could not be modified — "${song.name}" was not added.`
          : `Failed to add "${song.name}". Please try again.`;
      showToast(message, "error");
    },
    [showToast]
  );

  const buildAddToastMessage = useCallback((song: PlaylistSong) => `Added "${song.name}"`, []);

  const { pendingIds: pendingAddIds, trigger: triggerAdd } = useDeferredRowAction<PlaylistSong>({
    windowMs: ADD_WINDOW_MS,
    perform: performAdd,
    buildToastMessage: buildAddToastMessage,
    onError: handleAddError,
  });

  const handleAdd = useCallback(
    (songId: string) => {
      const song = songs.find((s) => s.id === songId);
      if (!song) return;
      triggerAdd(song);
    },
    [songs, triggerAdd]
  );

  const displayedSongs = useMemo(
    () => songs.filter((song) => !pendingAddIds.has(song.id)),
    [songs, pendingAddIds]
  );

  // An add emptying a later page should not leave the user staring at
  // nothing — move back a page rather than presenting it empty.
  useEffect(() => {
    if (!loading && currentPage > 1 && displayedSongs.length === 0 && songs.length > 0) {
      handlePrevPage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedSongs.length]);

  if (notFound) {
    return (
      <div className="app-bg flex w-full flex-1 flex-col items-center justify-center px-4 py-10 text-center">
        <p className="max-w-[42ch] text-sm text-brand-muted">
          This playlist pair is unavailable. One of them may not exist, or you may not own it.
        </p>
      </div>
    );
  }

  return (
    <div className="app-bg flex w-full flex-1 flex-col items-center justify-start px-4 py-10">
      <h1 className="text-center text-2xl font-bold tracking-tight text-brand-heading sm:text-4xl">
        {playlistName ? `propagate from "${playlistName}"` : "propagate songs"}
      </h1>
      <p className="mx-auto mb-6 mt-3 max-w-[42ch] text-center text-sm text-brand-muted sm:mb-8 sm:mt-4">
        add songs from this playlist into your destination playlist.
      </p>

      <div className="mb-6 flex w-full max-w-xs flex-col items-center gap-1">
        <Select value={sort} onValueChange={(value) => handleSortChange(value as SortKey)}>
          <SelectTrigger aria-label="Sort songs by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Sort by</SelectLabel>
              {SORT_OPTIONS.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  disabled={option.value === "affinity_asc" && !affinityAvailable}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {!affinityAvailable && (
          <p className="text-center text-xs text-brand-muted">
            {describeAffinityUnavailable(affinityReason)}
          </p>
        )}
      </div>

      {loadError ? (
        <div className="flex w-full flex-1 flex-col items-center justify-center gap-4 py-10 text-center" role="alert">
          <p className="max-w-[42ch] text-sm text-brand-muted">{loadError}</p>
          <Button onClick={() => fetchPage(offset, limit, sort)} variant="brand">
            Try again
          </Button>
        </div>
      ) : loading ? (
        <div className="flex w-full flex-col items-center gap-6" role="status" aria-live="polite">
          <span className="sr-only">Loading playlist songs…</span>
          {Array.from({ length: Math.min(limit, 10) }).map((_, i) => (
            <SongCardSkeleton key={i} className="w-full md:w-3/5 lg:w-2/5" />
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center w-full gap-6">
            {displayedSongs.length === 0 ? (
              <p className="py-10 text-center text-brand-muted">
                {sourceIsEmpty ? "This playlist is empty." : "Nothing left to propagate — every song is already there."}
              </p>
            ) : (
              <ul className="flex flex-col items-center w-full gap-6" aria-label="Playlist songs">
                {displayedSongs.map((song, index) => (
                  <SongCard
                    key={song.id}
                    id={song.id}
                    name={song.name}
                    artists={song.artists}
                    album={song.album}
                    album_pic_url={song.album_pic_url}
                    onRefresh={noop}
                    onAdd={handleAdd}
                    showAddToPlaylists={false}
                    priority={index < ABOVE_FOLD_ROW_COUNT}
                    className="w-full md:w-3/5 lg:w-2/5"
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="mt-8 flex flex-col items-center w-full gap-4">
            <Select value={String(limit)} onValueChange={(value) => handleLimitChange(Number(value))}>
              <SelectTrigger className="w-[180px]" aria-label="Songs per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Songs per page</SelectLabel>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            {total > 0 && (
              <SongListPagination
                total={total}
                limit={limit}
                currentPage={currentPage}
                onNavigate={handleOffsetChange}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

const PropagateSongsPage: React.FC = () => <PropagateSongsView />;

export default PropagateSongsPage;
