"use client"

import React from 'react';

import { usePlaylists } from '@/components/playlists-provider';
import { PlaylistList } from '@/components/ui/playlist-list';
import { Button } from '@/components/ui/button';
import { Playlist } from '@/types/spotify';

interface PlaylistChooserProps {
  title: string;
  description: string;
  emptyMessage: string;
  onSelectPlaylist: (playlist: Playlist) => void;
}

/**
 * The playlist-picking screen shared by /clean and /propagate: heading,
 * description, loading/error/empty states, and a panel wrapping the shared
 * PlaylistList. Reads playlists from PlaylistsProvider — callers must be
 * rendered within one.
 */
export const PlaylistChooser: React.FC<PlaylistChooserProps> = ({
  title,
  description,
  emptyMessage,
  onSelectPlaylist,
}) => {
  const { playlists, loading, error, refetch } = usePlaylists();

  return (
    <div className="app-bg flex w-full flex-1 flex-col items-center justify-start px-4 py-10">
      <h1 className="text-center text-2xl font-bold tracking-tight text-brand-heading sm:text-4xl">
        {title}
      </h1>
      <p className="mx-auto mb-6 mt-3 max-w-[42ch] text-center text-sm text-brand-muted sm:mb-8 sm:mt-4">
        {description}
      </p>

      {loading ? (
        <div role="status" aria-live="polite" className="py-10 text-center text-brand-muted">
          Loading your playlists…
        </div>
      ) : error ? (
        <div className="flex w-full flex-col items-center gap-4 py-10 text-center" role="alert">
          <p className="max-w-[42ch] text-sm text-brand-muted">{error}</p>
          <Button onClick={() => refetch()} variant="brand">
            Try again
          </Button>
        </div>
      ) : playlists.length === 0 ? (
        <p className="py-10 text-center text-brand-muted">{emptyMessage}</p>
      ) : (
        <div className="surface-panel w-full max-w-xl rounded-xl p-4 sm:p-6">
          <PlaylistList onSelectPlaylist={onSelectPlaylist} />
        </div>
      )}
    </div>
  );
};
