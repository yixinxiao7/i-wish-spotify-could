import React, { useState } from 'react';

import { 
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	CardFooter
} from "./card"

import {
	Dialog,
	DialogTrigger,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter
} from "./dialog"

import {
	POST_PLAYLISTS_ADD_SONG_ENDPOINT
} from '@/utils/config';

import { Button } from "./button"

import { Checkbox } from "./checkbox"

import { Playlist } from '@/types/spotify';

interface SongProps {
  id: string
  name: string
  artists: string
  album: string
	onRefresh: () => void
	allPlaylists?: Playlist[]
}


export const SongCard: React.FC<SongProps> = ({
  id,
  name,
  artists,
  album,
	onRefresh,
	allPlaylists = []
}) => {

	const [selectedPlaylists, setSelectedPlaylists] = useState<Playlist[]>([]);

  const updateSelectedPlaylists = (playlistId: string, checked: boolean | "indeterminate") => {
    const playlist = allPlaylists.find((p) => p.id === playlistId);
    if (!playlist) return;

    setSelectedPlaylists((prev) => {
      if (checked === true) {
        return [...prev, playlist];
      } else {
        return prev.filter((p) => p.id !== playlistId);
      }
    });
  }

	const renderPlaylists = () => {
		if (!allPlaylists || allPlaylists.length === 0) {
			return <p>No playlists available</p>;
		}
		return (
			<>
				{allPlaylists.map((playlist) => (
					<li key={playlist.id} className="flex items-center space-x-2 py-1">
            <Checkbox 
              id={`playlist-${playlist.id}`}
              onCheckedChange={(checked) => updateSelectedPlaylists(playlist.id, checked)}
            />
            <label htmlFor={`playlist-${playlist.id}`}>{playlist.name}</label>
					</li>
				))}
			</>
		);
	}

	const addSongToPlaylists = () => {
		if (selectedPlaylists.length === 0) {
			alert("Please select at least one playlist to add the song to.");
			return;
		}
		const songData = {
			songId: id,
			playlistIds: selectedPlaylists.map((playlist) => (playlist.id))
		};
		fetch(POST_PLAYLISTS_ADD_SONG_ENDPOINT, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(songData)
		})
		.then(response => {
			if (response.ok) {
				alert("Songs added to playlists successfully!");
				setSelectedPlaylists([]); // Clear selected playlists after successful addition
				const dialog = document.activeElement?.closest('[role="dialog"]') as HTMLElement | null;
				if (dialog) {
					const closeButton = dialog.querySelector('[data-state="open"][aria-label="Close"]') as HTMLElement | null;
					if (closeButton) {
						closeButton.click();
					}
				}
				onRefresh(); // Refresh the songs list
			} else {
				alert("Failed to add songs to playlists.");
			}
		})
		.catch(error => {
			console.error("Error adding songs to playlists:", error);
			alert("An error occurred while adding songs to playlists.");
		});
	}

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center justify-between space-x-4">
          <div className="flex items-center space-x-4">
            {/* {coverUrl && (
              <img
                src={coverUrl}
                alt={title}
                className="w-16 h-16 rounded-md object-cover"
              />
            )} */}
            <div>
              <CardTitle>{name}</CardTitle>
              <CardDescription>
								<div>{artists}</div>
								<div>
									<b>{album}</b>
								</div>
								</CardDescription>
            </div>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button
								size="sm"
								className="ml-2 whitespace-nowrap">
								Add to playlists
							</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Playlists</DialogTitle>
                <DialogDescription>
									{renderPlaylists()}
                </DialogDescription>
              </DialogHeader>
								<DialogFooter className="flex justify-center w-full">
								<Button onClick={addSongToPlaylists}>
									Add to Playlists
								</Button>
								</DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      {/* {description && (
        <CardContent>
          <p>{description}</p>
        </CardContent>
      )} */}
      {/* <CardFooter className="justify-between"> */}
        {/* {duration && <span className="text-xs text-muted-foreground">{duration}</span>}
        {onPlay && (
          <button
            onClick={onPlay}
            className="px-3 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
          >
            Play
          </button>
        )} */}
      {/* </CardFooter> */}
    </Card>
  )
}
