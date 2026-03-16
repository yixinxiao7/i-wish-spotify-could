"use client"

import React, { useEffect, useState, useCallback, useMemo } from 'react';

interface PageToast {
  message: string;
  type: 'success' | 'error';
}

import {
  GET_TOTAL_SONGS_ENDPOINT,
  GET_SONGS_ENDPOINT,
  GET_PLAYLISTS_ENDPOINT
} from '@/utils/config';

import { Song, Playlist } from '@/types/spotify';

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

const TOAST_DISMISS_MS = 5000;

const SongsPage: React.FC = () => {
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [songs, setSongs] = useState<Song[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [loading, setLoading] = useState<boolean>(true);
    const [offset, setOffset] = useState<number>(0);
    const [limit, setLimit] = useState<number>(10);
    const [pageToast, setPageToast] = useState<PageToast | null>(null);

    const showPageToast = useCallback((message: string, type: 'success' | 'error') => {
      setPageToast({ message, type });
    }, []);

    // Auto-dismiss toast
    useEffect(() => {
      if (!pageToast) return;
      const timer = setTimeout(() => setPageToast(null), TOAST_DISMISS_MS);
      return () => clearTimeout(timer);
    }, [pageToast]);

    useEffect(() => {
        fetchPlaylists();
        fetchTotalSongs();
        fetchSongs(offset, limit);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchTotalSongs = async () => {
      try {
        const response = await fetch(GET_TOTAL_SONGS_ENDPOINT, {
          method: "GET",
          mode: 'cors',
          headers: {
            "Content-Type": "application/json"
          },
        });
        if (response.ok) {
          const data = await response.json();
          setTotal(data.total);
        } else {
          throw new Error("Failed to fetch total songs");
        }
      } catch (error) {
        console.error("Error fetching total songs:", error);
        showPageToast("Failed to load song count. Please try refreshing.", 'error');
      }
    }

    const fetchPlaylists = async () => {
      try {
        const response = await fetch(GET_PLAYLISTS_ENDPOINT, {
          method: "GET",
          mode: 'cors',
          headers: {
            "Content-Type": "application/json"
          },
        });
        if (response.ok) {
          const data = await response.json();
          setPlaylists(data.playlists);
        } else {
          throw new Error("Failed to fetch playlists");
        }
      } catch (error) {
        console.error("Error fetching playlists:", error);
        showPageToast("Failed to load playlists.", 'error');
      }
    }

    const fetchSongs = useCallback(async (fetchOffset: number, fetchLimit: number) => {
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
          }
        });
        if (response.ok) {
          const data = await response.json();
          setSongs(data.songs);
        } else {
          throw new Error("Failed to fetch songs");
        }
      } catch (error) {
        console.error("Error fetching songs:", error);
        showPageToast("Failed to load songs. Please try refreshing.", 'error');
      } finally {
        setOffset(fetchOffset);
        setLimit(fetchLimit);
        setLoading(false);
      }
    }, [showPageToast]);

    const refreshSongs = useCallback(() => {
      setLoading(true);
      fetchSongs(offset, limit);
    }, [fetchSongs, offset, limit]);

    const handleSongSuccess = useCallback((msg: string) => {
      showPageToast(msg, 'success');
    }, [showPageToast]);

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
      setLoading(true);
      setCurrentPage(newPage);
      fetchSongs(newOffset, limit);
    }

    const handleLimitChange = (newLimit: number) => {
      setLoading(true);
      fetchSongs(offset, newLimit);
    }

    return (
      <div key="songs" className="flex w-full flex-1 flex-col items-center justify-start px-4 py-10">

        {/* Page-level toast — lives outside the loading branch so it survives refresh cycles */}
        {pageToast && (
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={`fixed bottom-5 left-5 right-5 z-50 flex items-center gap-3 rounded-2xl px-5 py-3 shadow-md sm:left-auto ${
              pageToast.type === 'success'
                ? 'toast-success'
                : 'toast-error'
            }`}
          >
            <span className="text-sm font-medium">{pageToast.message}</span>
            <button
              onClick={() => setPageToast(null)}
              aria-label="Dismiss notification"
              className="ml-1 flex-shrink-0 rounded-full p-2 hover:bg-foreground/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex w-full flex-1 items-center justify-center py-10" role="status" aria-label="Loading songs">
            <svg className="animate-spin h-8 w-8 text-brand-muted motion-reduce:hidden" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="sr-only">Loading songs…</span>
          </div>
        ) : (
          <>
        <h1 className="mb-6 text-center text-2xl font-bold tracking-tight text-brand-heading sm:mb-8 sm:text-4xl">uncategorized songs</h1>
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
                allPlaylists={playlists}
                onRefresh={refreshSongs}
                onSuccess={handleSongSuccess}
                className="w-full md:w-3/5 lg:w-2/5"
              />
            ))
          )}
        </div>
        <div className="mt-8 flex flex-col items-center w-full gap-4">
          <Select onValueChange={(value) => handleLimitChange(Number(value))}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={limit} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Limit</SelectLabel>
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
    )
}

export default SongsPage;
