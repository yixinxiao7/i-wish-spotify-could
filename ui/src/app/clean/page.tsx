"use client"

import React from 'react';
import { useRouter } from 'next/navigation';

import { PlaylistsProvider } from '@/components/playlists-provider';
import { PlaylistChooser } from '@/components/ui/playlist-chooser';
import { Playlist } from '@/types/spotify';

function CleanChooser() {
  const router = useRouter();

  const handleSelect = (playlist: Playlist) => {
    router.push(`/clean/${playlist.id}`);
  };

  return (
    <PlaylistChooser
      title="clean up a playlist"
      description="pick one of your playlists to find songs you've stopped listening to."
      emptyMessage="You don't own any playlists yet — create one in Spotify first."
      onSelectPlaylist={handleSelect}
    />
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
