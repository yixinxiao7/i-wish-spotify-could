"use client"

import React from 'react';
import { useRouter } from 'next/navigation';

import { PlaylistsProvider, usePlaylists } from '@/components/playlists-provider';
import { PlaylistList } from '@/components/ui/playlist-list';
import { Button } from '@/components/ui/button';
import { Playlist } from '@/types/spotify';

function CleanChooser() {
  const router = useRouter();
  const { playlists, loading, error, refetch } = usePlaylists();

  const handleSelect = (playlist: Playlist) => {
    router.push(`/clean/${playlist.id}`);
  };

  return (
    <div className="app-bg flex w-full flex-1 flex-col items-center justify-start px-4 py-10">
      <h1 className="text-center text-2xl font-bold tracking-tight text-brand-heading sm:text-4xl">
        clean up a playlist
      </h1>
      <p className="mx-auto mb-6 mt-3 max-w-[42ch] text-center text-sm text-brand-muted sm:mb-8 sm:mt-4">
        pick one of your playlists to find songs you&apos;ve stopped listening to.
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
        <p className="py-10 text-center text-brand-muted">
          You don&apos;t own any playlists yet — create one in Spotify first.
        </p>
      ) : (
        <div className="surface-panel w-full max-w-xl rounded-xl p-4 sm:p-6">
          <PlaylistList onSelectPlaylist={handleSelect} />
        </div>
      )}
    </div>
  );
}

const CleanPage: React.FC = () => {
  return (
    <PlaylistsProvider>
      <CleanChooser />
    </PlaylistsProvider>
  );
};

export default CleanPage;
