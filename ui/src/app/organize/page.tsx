"use client"

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

import {
  GET_TOTAL_SONGS_ENDPOINT,
  GET_SONGS_ENDPOINT,
  POST_REFRESH_SONGS_ENDPOINT
} from '@/utils/config';

import { Song } from '@/types/spotify';

import { PlaylistsProvider } from '@/components/playlists-provider';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';

import { SongListPagination } from "@/components/ui/song-list-pagination"
import { SongCardSkeleton } from "@/components/ui/song-card-skeleton"
import { clampOffsetPage, resetForLimitChange } from '@/utils/pagination';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  SongCard
} from "@/components/ui/song"

const GENERIC_LOAD_ERROR = "Failed to load songs. Please try again.";

// Prefer the server's own explanation (notably its rate-limit message, which
// tells the user to wait rather than retry immediately) over a generic one.
async function describeFailure(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body?.detail) return body.detail;
  } catch {
    // Non-JSON error body; fall through to the generic message.
  }
  return GENERIC_LOAD_ERROR;
}

// A first-time visitor's cache can take a while to build server-side; give
// the request room to finish before treating it as stuck.
const LOAD_TIMEOUT_MS = 25000;
// After this long without a response, tell the user why — a bare spinner
// with no explanation reads as broken, not busy.
const SLOW_NOTICE_MS = 4000;
// Album art is this page's LCP element. Rows within this count are already
// in the viewport on first render, so their art loads eagerly; the rest
// stay lazy.
const ABOVE_FOLD_ROW_COUNT = 3;

const SongsPage: React.FC = () => {
    const [songs, setSongs] = useState<Song[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [loading, setLoading] = useState<boolean>(true);
    const [offset, setOffset] = useState<number>(0);
    const [limit, setLimit] = useState<number>(10);
    const [timedOut, setTimedOut] = useState<boolean>(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [showSlowNotice, setShowSlowNotice] = useState<boolean>(false);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const { showToast } = useToast();

    const abortControllerRef = useRef<AbortController | null>(null);
    const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingRequestRef = useRef<{ offset: number; limit: number; isInitial: boolean }>({
      offset: 0,
      limit: 10,
      isInitial: true,
    });

    const clearLoadTimers = () => {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
      slowTimerRef.current = null;
      timeoutTimerRef.current = null;
    };

    const fetchTotalSongs = useCallback(async (signal: AbortSignal) => {
      try {
        const response = await fetch(GET_TOTAL_SONGS_ENDPOINT, {
          method: "GET",
          mode: 'cors',
          headers: {
            "Content-Type": "application/json"
          },
          signal,
        });
        if (response.ok) {
          const data = await response.json();
          setTotal(data.total);
        } else {
          throw new Error(await describeFailure(response));
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Error fetching total songs:", error);
        // The songs fetch runs alongside this one and reports the same
        // underlying failure through the page's error state, so staying
        // quiet here avoids toasting the identical message twice.
      }
    }, []);

    const fetchSongs = useCallback(async (fetchOffset: number, fetchLimit: number, signal: AbortSignal) => {
      const params = new URLSearchParams({
        offset: String(fetchOffset),
        limit: String(fetchLimit),
      }).toString();
      const url = new URL(GET_SONGS_ENDPOINT);
      url.search = params;

      try {
        const response = await fetch(url, {
          method: "GET",
          mode: 'cors',
          headers: {
            "Content-Type": "application/json"
          },
          signal,
        });
        if (response.ok) {
          const data = await response.json();
          setSongs(data.songs);
          setLoadError(null);
        } else {
          throw new Error(await describeFailure(response));
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Error fetching songs:", error);
        // Record the failure separately from the song list. Without this an
        // empty list reads as "nothing to categorize", so a failed load
        // renders as a congratulatory empty state instead of an error.
        setLoadError((error as Error).message || GENERIC_LOAD_ERROR);
        showToast((error as Error).message || GENERIC_LOAD_ERROR, 'error');
      }
    }, [showToast]);

    const runLoad = useCallback((fetchOffset: number, fetchLimit: number, isInitial: boolean) => {
      clearLoadTimers();
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      pendingRequestRef.current = { offset: fetchOffset, limit: fetchLimit, isInitial };

      setTimedOut(false);
      setShowSlowNotice(false);
      setLoadError(null);
      setLoading(true);

      slowTimerRef.current = setTimeout(() => setShowSlowNotice(true), SLOW_NOTICE_MS);
      timeoutTimerRef.current = setTimeout(() => {
        controller.abort();
        setTimedOut(true);
        setLoading(false);
      }, LOAD_TIMEOUT_MS);

      const tasks: Promise<void>[] = [fetchSongs(fetchOffset, fetchLimit, controller.signal)];
      if (isInitial) tasks.push(fetchTotalSongs(controller.signal));

      Promise.all(tasks).finally(() => {
        // The timeout branch above already resolved the UI state; don't
        // stomp on it if this request lost the race with the abort.
        if (controller.signal.aborted) return;
        clearLoadTimers();
        setOffset(fetchOffset);
        setLimit(fetchLimit);
        setLoading(false);
      });
    }, [fetchSongs, fetchTotalSongs]);

    useEffect(() => {
        runLoad(0, 10, true);
        return () => {
          abortControllerRef.current?.abort();
          clearLoadTimers();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const retryLoad = useCallback(() => {
      const { offset: pendingOffset, limit: pendingLimit, isInitial } = pendingRequestRef.current;
      runLoad(pendingOffset, pendingLimit, isInitial);
    }, [runLoad]);

    const refreshSongs = useCallback(() => {
      runLoad(offset, limit, false);
    }, [runLoad, offset, limit]);

    const handleForceRefresh = useCallback(async () => {
      if (isRefreshing) return;
      setIsRefreshing(true);
      try {
        const response = await fetch(POST_REFRESH_SONGS_ENDPOINT, { method: "POST" });
        if (!response.ok) {
          throw new Error("Failed to refresh uncategorized songs");
        }
        const controller = new AbortController();
        await Promise.all([
          fetchSongs(offset, limit, controller.signal),
          fetchTotalSongs(controller.signal),
        ]);
        showToast("Uncategorized songs refreshed.", "success");
      } catch (error) {
        console.error("Error refreshing uncategorized songs:", error);
        showToast("Failed to refresh uncategorized songs. Please try again.", "error");
      } finally {
        setIsRefreshing(false);
      }
    }, [isRefreshing, offset, limit, fetchSongs, fetchTotalSongs, showToast]);

    const handleSongSuccess = useCallback((msg: string) => {
      showToast(msg, 'success');
    }, [showToast]);

    const handleOffsetChange = (newOffset: number, newPage: number) => {
      const clamped = clampOffsetPage(newOffset, newPage, total, limit);
      setCurrentPage(clamped.page);
      runLoad(clamped.offset, limit, false);
    }

    const handleLimitChange = (newLimit: number) => {
      const reset = resetForLimitChange();
      setCurrentPage(reset.page);
      runLoad(reset.offset, newLimit, false);
    }

    return (
      <PlaylistsProvider>
      <div key="songs" className="app-bg flex w-full flex-1 flex-col items-center justify-start px-4 py-10">
        <h1 className="text-center text-2xl font-bold tracking-tight text-brand-heading sm:text-4xl">uncategorized songs</h1>
        <p className="mx-auto mb-6 mt-3 max-w-[42ch] text-center text-sm text-brand-muted sm:mb-8 sm:mt-4">
          liked songs that aren&apos;t in any playlist yet — preview them and add each to a playlist.
        </p>

        {timedOut ? (
          <div className="flex w-full flex-1 flex-col items-center justify-center gap-4 py-10 text-center" role="alert">
            <p className="max-w-[42ch] text-sm text-brand-muted">
              This is taking longer than expected. Your library may still be indexing — try again in a moment.
            </p>
            <button
              onClick={retryLoad}
              className="btn-brand-primary h-11 rounded-full px-6 text-sm font-semibold"
            >
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="flex w-full flex-col items-center gap-6" role="status" aria-live="polite">
            <span className="sr-only">Loading songs…</span>
            {showSlowNotice && (
              <p className="max-w-[42ch] text-center text-sm text-brand-muted">
                Scanning your liked songs — this can take a minute the first time.
              </p>
            )}
            {Array.from({ length: Math.min(limit, 10) }).map((_, i) => (
              <SongCardSkeleton key={i} className="w-full md:w-3/5 lg:w-2/5" />
            ))}
          </div>
        ) : (
          <>
        <Button
          onClick={handleForceRefresh}
          disabled={isRefreshing}
          variant="brandMuted"
          size="sm"
          className="mb-6 -mt-2 text-xs font-semibold motion-reduce:transition-none"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin motion-reduce:animate-none" : ""}`}
            aria-hidden="true"
          />
          {isRefreshing ? "Refreshing…" : "Refresh from Spotify"}
        </Button>
        <div className="flex flex-col items-center w-full gap-6">
          {loadError ? (
            <div className="flex w-full flex-col items-center gap-4 py-10 text-center" role="alert">
              <p className="max-w-[42ch] text-sm text-brand-muted">{loadError}</p>
              <Button onClick={retryLoad} variant="brand">
                Try again
              </Button>
            </div>
          ) : songs.length === 0 ? (
            <p className="py-10 text-center text-brand-muted">
              No uncategorized songs found. All your liked songs are already in playlists!
            </p>
          ) : (
            <ul className="flex flex-col items-center w-full gap-6" aria-label="Uncategorized songs">
              {songs.map((song, index) => (
                <SongCard
                  key={song.id}
                  id={song.id}
                  name={song.name}
                  artists={song.artists}
                  album={song.album}
                  album_pic_url={song.album_pic_url}
                  onRefresh={refreshSongs}
                  onSuccess={handleSongSuccess}
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
      </PlaylistsProvider>
    )
}

export default SongsPage;
