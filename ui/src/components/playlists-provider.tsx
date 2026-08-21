"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { GET_PLAYLISTS_ENDPOINT, POST_PLAYLIST_PIN_ENDPOINT } from '@/utils/config';
import { Playlist } from '@/types/spotify';

interface PlaylistsContextValue {
  playlists: Playlist[];
  loading: boolean;
  error: string | null;
  togglePin: (playlistId: string, pinned: boolean) => Promise<void>;
}

export const PlaylistsContext = createContext<PlaylistsContextValue | null>(null);

export const PlaylistsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlaylists = useCallback(async () => {
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
        throw new Error("Failed to fetch playlists");
      }
    } catch (err) {
      console.error("Error fetching playlists:", err);
      setError("Failed to load playlists.");
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
    <PlaylistsContext.Provider value={{ playlists, loading, error, togglePin }}>
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
