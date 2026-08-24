"use client"

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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

import {
  SongCard
} from "@/components/ui/song"

// A first-time visitor's cache can take a while to build server-side; give
// the request room to finish before treating it as stuck.
const LOAD_TIMEOUT_MS = 25000;
// After this long without a response, tell the user why — a bare spinner
// with no explanation reads as broken, not busy.
const SLOW_NOTICE_MS = 4000;

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

const SongsPage: React.FC = () => {
    const [songs, setSongs] = useState<Song[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [loading, setLoading] = useState<boolean>(true);
    const [offset, setOffset] = useState<number>(0);
    const [limit, setLimit] = useState<number>(10);
    const [timedOut, setTimedOut] = useState<boolean>(false);
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
          throw new Error("Failed to fetch total songs");
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Error fetching total songs:", error);
        showToast("Failed to load song count. Please try refreshing.", 'error');
      }
    }, [showToast]);

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
        } else {
          throw new Error("Failed to fetch songs");
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Error fetching songs:", error);
        showToast("Failed to load songs. Please try refreshing.", 'error');
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

    const lastPage = useMemo(() => Math.ceil(total / limit), [total, limit]);

    const handleOffsetChange = (newOffset: number, newPage: number) => {
      if (newOffset < 0) {
        newOffset = 0;
      }
      else if (newOffset > total) {
        newOffset -= limit;
      }

      if (newPage < 1) {
        newPage = 1;
      }
      else if (newPage > lastPage) {
        newPage = lastPage;
      }
      setCurrentPage(newPage);
      runLoad(newOffset, limit, false);
    }

    const handleLimitChange = (newLimit: number) => {
      runLoad(offset, newLimit, false);
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
              <SongCardSkeleton key={i} />
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
          {songs.length === 0 ? (
            <p className="py-10 text-center text-brand-muted">
              No uncategorized songs found. All your liked songs are already in playlists!
            </p>
          ) : (
            songs.map((song) => (
              <SongCard
                key={song.id}
                id={song.id}
                name={song.name}
                artists={song.artists}
                album={song.album}
                album_pic_url={song.album_pic_url}
                onRefresh={refreshSongs}
                onSuccess={handleSongSuccess}
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
          {total > 0 &&
              <Pagination className="px-6 py-2">
              <PaginationContent>
                {currentPage != 1 &&
                  <>
                    <PaginationItem>
                      <PaginationPrevious onClick={() => {
                        handleOffsetChange(offset-limit, currentPage-1);
                      }} />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink onClick={() => handleOffsetChange(0, 1)}>
                        1
                      </PaginationLink>
                    </PaginationItem>
                  </>
                }
                {currentPage > 2 &&
                  <>
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink onClick={() =>
                        handleOffsetChange(offset-limit, currentPage-1)}>
                        {currentPage-1}
                      </PaginationLink>
                    </PaginationItem>
                  </>
                }
                  <PaginationItem>
                    <PaginationLink isActive={true}>
                      {currentPage}
                    </PaginationLink>
                  </PaginationItem>
                {currentPage < lastPage-1 &&
                  <>
                    <PaginationItem>
                      <PaginationLink onClick={() =>
                        handleOffsetChange(offset+limit, currentPage+1)}>
                        {currentPage+1}
                      </PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  </>
                }
                {currentPage != lastPage &&
                  <>
                    <PaginationItem>
                      <PaginationLink onClick={() => {
                          handleOffsetChange((lastPage-1)*limit, lastPage);
                        }}>
                          {lastPage}
                      </PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext onClick={() => {
                        handleOffsetChange(offset+limit, currentPage+1);
                      }} />
                    </PaginationItem>
                  </>
                }
              </PaginationContent>
            </Pagination>
          }
        </div>
          </>
        )}
      </div>
      </PlaylistsProvider>
    )
}

export default SongsPage;
