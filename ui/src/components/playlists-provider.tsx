"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { GET_PLAYLISTS_ENDPOINT, POST_PLAYLIST_PIN_ENDPOINT } from '@/utils/config';
import { Playlist } from '@/types/spotify';

interface PlaylistsContextValue {
  playlists: Playlist[];
  loading: boolean;
  error: string | null;
  togglePin: (playlistId: string, pinned: boolean) => Promise<void>;
  /** Re-runs the initial fetch — e.g. a "try again" action after a failed load. */
  refetch: () => Promise<void>;
}

export const PlaylistsContext = createContext<PlaylistsContextValue | null>(null);

export const PlaylistsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlaylists = useCallback(async () => {
    setLoading(true);
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
        setError(null);
      } else {
        // Prefer the server's own explanation — notably its rate-limit
        // message, which tells the user to wait rather than retry now.
        let detail = "Failed to load playlists.";
        try {
          const body = await response.json();
          if (body?.detail) detail = body.detail;
        } catch {
          // Non-JSON error body; keep the generic message.
        }
        throw new Error(detail);
      }
    } catch (err) {
      console.error("Error fetching playlists:", err);
      setError((err as Error).message || "Failed to load playlists.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  const togglePin = useCallback(async (playlistId: string, pinned: boolean) => {
    let previousPlaylists: Playlist[] = [];
    setPlaylists((prev) => {
      previousPlaylists = prev;
      return prev.map((playlist) =>
        playlist.id === playlistId ? { ...playlist, pinned } : playlist
      );
    });

    try {
      const response = await fetch(POST_PLAYLIST_PIN_ENDPOINT, {
        method: "POST",
        mode: 'cors',
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ playlistId, pinned }),
      });
      if (!response.ok) {
        throw new Error("Failed to update pin");
      }
      const data = await response.json();
      const pinnedIds: string[] = data.pinnedIds ?? [];
      setPlaylists((prev) =>
        prev.map((playlist) => ({
          ...playlist,
          pinned: pinnedIds.includes(playlist.id),
        }))
      );
      setError(null);
    } catch (err) {
      console.error("Error updating pin:", err);
      setPlaylists(previousPlaylists);
      setError("Failed to update pin. Please try again.");
    }
  }, []);

  return (
    <PlaylistsContext.Provider value={{ playlists, loading, error, togglePin, refetch: fetchPlaylists }}>
      {children}
    </PlaylistsContext.Provider>
  );
};

export function usePlaylists(): PlaylistsContextValue {
  const context = useContext(PlaylistsContext);
  if (!context) {
    throw new Error("usePlaylists must be used within a PlaylistsProvider");
  }
  return context;
}
