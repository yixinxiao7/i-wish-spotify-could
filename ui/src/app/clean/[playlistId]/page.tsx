"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

import { getPlaylistSongsEndpoint } from '@/utils/config';
import { PlaylistSong } from '@/types/spotify';
import { useToast } from '@/components/toast-provider';
import { PlaylistsProvider } from '@/components/playlists-provider';
import { Button } from '@/components/ui/button';
import { SongCard } from '@/components/ui/song';

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

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

// Matches the backend's undo window exactly, so the toast's progress bar
// and the moment the removal actually fires never disagree.
const UNDO_WINDOW_MS = 5000;

function SongCardSkeleton() {
  return (
    <div
      className="glass-surface w-full max-w-5xl animate-pulse rounded-xl p-4 sm:p-6"
      aria-hidden="true"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="h-12 w-12 flex-shrink-0 rounded-full bg-foreground/10 sm:h-16 sm:w-16" />
          <div className="space-y-2">
            <div className="h-3 w-32 rounded bg-foreground/10 sm:w-40" />
            <div className="h-2.5 w-24 rounded bg-foreground/10 sm:w-28" />
          </div>
        </div>
        <div className="h-11 w-full rounded-full bg-foreground/10 sm:h-10 sm:w-[150px]" />
      </div>
    </div>
  );
}

const CleanPlaylistView: React.FC = () => {
  const params = useParams<{ playlistId: string }>();
  const playlistId = params.playlistId;
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

  const [pendingRemovalIds, setPendingRemovalIds] = useState<Set<string>>(new Set());
  const pendingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingToastIds = useRef<Map<string, number>>(new Map());

  const fetchPage = useCallback(
    async (fetchOffset: number, fetchLimit: number, fetchSort: SortKey) => {
      setLoading(true);
      setLoadError(null);
      setNotFound(false);
      try {
        const url = new URL(getPlaylistSongsEndpoint(playlistId));
        url.search = new URLSearchParams({
          offset: String(fetchOffset),
          limit: String(fetchLimit),
          sort: fetchSort,
        }).toString();
        const response = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
        if (response.status === 404) {
          setNotFound(true);
          return;
        }
        if (!response.ok) {
          // Prefer the server's own explanation — notably its rate-limit
          // message, which tells the user to wait rather than retry now.
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
      } catch (error) {
        console.error("Error loading playlist songs:", error);
        setLoadError((error as Error).message || "Failed to load this playlist. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [playlistId]
  );

  useEffect(() => {
    fetchPage(0, 10, "playlist");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistId]);

  // Flush any pending removal rather than silently dropping it: a hard
  // close/reload fires `pagehide` (keepalive carries the request past
  // unload), and leaving this route via the app fires this effect's own
  // cleanup on unmount.
  useEffect(() => {
    const flushAllPending = () => {
      pendingTimers.current.forEach((timeoutId, songId) => {
        clearTimeout(timeoutId);
        fetch(getPlaylistSongsEndpoint(playlistId), {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({ songId }),
        }).catch(() => {
          // Best-effort: the page is going away, there is nowhere left to
          // report a failure to.
        });
      });
      pendingTimers.current.clear();
    };

    window.addEventListener("pagehide", flushAllPending);
    return () => {
      window.removeEventListener("pagehide", flushAllPending);
      flushAllPending();
    };
  }, [playlistId]);

  const runLoad = (fetchOffset: number, fetchLimit: number, fetchSort: SortKey, newPage: number) => {
    setCurrentPage(newPage);
    setOffset(fetchOffset);
    setLimit(fetchLimit);
    setSort(fetchSort);
    fetchPage(fetchOffset, fetchLimit, fetchSort);
  };

  const lastPage = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const handleSortChange = (value: SortKey) => {
    runLoad(0, limit, value, 1);
  };

  const handleLimitChange = (value: number) => {
    runLoad(0, value, sort, 1);
  };

  // Mirrors the organize page's handler, including its boundary clamps, so
  // both pagination controls behave identically.
  const handleOffsetChange = (newOffset: number, newPage: number) => {
    if (newOffset < 0) {
      newOffset = 0;
    } else if (newOffset > total) {
      newOffset -= limit;
    }

    if (newPage < 1) {
      newPage = 1;
    } else if (newPage > lastPage) {
      newPage = lastPage;
    }
    runLoad(newOffset, limit, sort, newPage);
  };

  const handlePrevPage = () => {
    if (currentPage <= 1) return;
    handleOffsetChange(offset - limit, currentPage - 1);
  };

  const flushRemoval = useCallback(
    async (song: PlaylistSong) => {
      pendingTimers.current.delete(song.id);
      pendingToastIds.current.delete(song.id);
      try {
        const response = await fetch(getPlaylistSongsEndpoint(playlistId), {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ songId: song.id }),
        });
        if (response.status === 403) {
          throw new Error("permission");
        }
        if (!response.ok) {
          throw new Error("failed");
        }
        // Success: leave the id in pendingRemovalIds permanently — the
        // song really is gone now, and the next fetch of this playlist
        // won't include it anyway.
      } catch (error) {
        setPendingRemovalIds((prev) => {
          const next = new Set(prev);
          next.delete(song.id);
          return next;
        });
        const message =
          (error as Error).message === "permission"
            ? `The playlist could not be modified — "${song.name}" was not removed.`
            : `Failed to remove "${song.name}". Please try again.`;
        showToast(message, "error");
      }
    },
    [playlistId, showToast]
  );

  const handleUndo = useCallback((songId: string) => {
    const timeoutId = pendingTimers.current.get(songId);
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      pendingTimers.current.delete(songId);
    }
    pendingToastIds.current.delete(songId);
    setPendingRemovalIds((prev) => {
      const next = new Set(prev);
      next.delete(songId);
      return next;
    });
  }, []);

  const handleRemove = useCallback(
    (songId: string) => {
      const song = songs.find((s) => s.id === songId);
      if (!song) return;

      setPendingRemovalIds((prev) => new Set(prev).add(songId));

      const timeoutId = setTimeout(() => flushRemoval(song), UNDO_WINDOW_MS);
      pendingTimers.current.set(songId, timeoutId);

      const toastId = showToast(`Removed "${song.name}"`, "success", {
        durationMs: UNDO_WINDOW_MS,
        progress: true,
        action: { label: "Undo", onClick: () => handleUndo(songId) },
      });
      pendingToastIds.current.set(songId, toastId);
    },
    [songs, flushRemoval, showToast, handleUndo]
  );

  const displayedSongs = useMemo(
    () => songs.filter((song) => !pendingRemovalIds.has(song.id)),
    [songs, pendingRemovalIds]
  );

  // A removal emptying a later page should not leave the user staring at
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
          This playlist is unavailable. It may not exist, or you may not own it.
        </p>
      </div>
    );
  }

  return (
    <div className="app-bg flex w-full flex-1 flex-col items-center justify-start px-4 py-10">
      <h1 className="text-center text-2xl font-bold tracking-tight text-brand-heading sm:text-4xl">
        {playlistName ? `clean "${playlistName}"` : "clean playlist"}
      </h1>
      <p className="mx-auto mb-6 mt-3 max-w-[42ch] text-center text-sm text-brand-muted sm:mb-8 sm:mt-4">
        sort by how stale a song is, then remove the ones you&apos;re done with.
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
            Least-listened sorting needs one more permission — log out and back in to enable it.
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
            <SongCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center w-full gap-6" aria-live="polite">
            {displayedSongs.length === 0 ? (
              <p className="py-10 text-center text-brand-muted">This playlist is empty.</p>
            ) : (
              displayedSongs.map((song) => (
                <SongCard
                  key={song.id}
                  id={song.id}
                  name={song.name}
                  artists={song.artists}
                  album={song.album}
                  album_pic_url={song.album_pic_url}
                  onRefresh={() => {}}
                  onRemove={handleRemove}
                  className="w-full md:w-3/5 lg:w-2/5"
                />
              ))
            )}
          </div>

          <div className="mt-8 flex flex-col items-center w-full gap-4">
            <Select onValueChange={(value) => handleLimitChange(Number(value))}>
              <SelectTrigger className="w-[180px]" aria-label="Songs per page">
                <SelectValue placeholder={limit} />
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
              <Pagination className="px-6 py-2">
                <PaginationContent>
                  {currentPage != 1 && (
                    <>
                      <PaginationItem>
                        <PaginationPrevious onClick={() => {
                          handleOffsetChange(offset - limit, currentPage - 1);
                        }} />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink onClick={() => handleOffsetChange(0, 1)}>
                          1
                        </PaginationLink>
                      </PaginationItem>
                    </>
                  )}
                  {currentPage > 2 && (
                    <>
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink onClick={() =>
                          handleOffsetChange(offset - limit, currentPage - 1)}>
                          {currentPage - 1}
                        </PaginationLink>
                      </PaginationItem>
                    </>
                  )}
                  <PaginationItem>
                    <PaginationLink isActive={true}>
                      {currentPage}
                    </PaginationLink>
                  </PaginationItem>
                  {currentPage < lastPage - 1 && (
                    <>
                      <PaginationItem>
                        <PaginationLink onClick={() =>
                          handleOffsetChange(offset + limit, currentPage + 1)}>
                          {currentPage + 1}
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    </>
                  )}
                  {currentPage != lastPage && (
                    <>
                      <PaginationItem>
                        <PaginationLink onClick={() => {
                          handleOffsetChange((lastPage - 1) * limit, lastPage);
                        }}>
                          {lastPage}
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext onClick={() => {
                          handleOffsetChange(offset + limit, currentPage + 1);
                        }} />
                      </PaginationItem>
                    </>
                  )}
                </PaginationContent>
              </Pagination>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const CleanPlaylistPage: React.FC = () => (
  <PlaylistsProvider>
    <CleanPlaylistView />
  </PlaylistsProvider>
);

export default CleanPlaylistPage;
