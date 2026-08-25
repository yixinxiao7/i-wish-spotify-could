"use client"

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { PlaylistsProvider, usePlaylists } from '@/components/playlists-provider';
import { PlaylistChooser } from '@/components/ui/playlist-chooser';
import { PlaylistList } from '@/components/ui/playlist-list';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Playlist } from '@/types/spotify';

function PropagateChooser() {
  const router = useRouter();
  const { playlists } = usePlaylists();
  const [destination, setDestination] = useState<Playlist | null>(null);

  const sourceOptions = useMemo(
    () => (destination ? playlists.filter((p) => p.id !== destination.id) : []),
    [playlists, destination]
  );

  const handleSelectDestination = (playlist: Playlist) => {
    setDestination(playlist);
  };

  const handleSelectSource = (source: Playlist) => {
    if (!destination) return;
    router.push(`/propagate/${destination.id}/from/${source.id}`);
  };

  return (
    <>
      <PlaylistChooser
        title="propagate songs"
        description="pick a playlist to add songs to."
        emptyMessage="You don't own any playlists yet — create one in Spotify first."
        onSelectPlaylist={handleSelectDestination}
      />

      <Dialog
        open={destination !== null}
        onOpenChange={(open) => {
          if (!open) setDestination(null);
        }}
      >
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Draw songs from…</DialogTitle>
            {destination && (
              <DialogDescription>
                Choose a playlist to pull songs from into &quot;{destination.name}&quot;.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-3">
            <PlaylistList
              playlists={sourceOptions}
              onSelectPlaylist={handleSelectSource}
              emptyMessage="You don't have another playlist to draw songs from."
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

const PropagatePage: React.FC = () => (
  <PlaylistsProvider>
    <PropagateChooser />
  </PlaylistsProvider>
);

export default PropagatePage;
