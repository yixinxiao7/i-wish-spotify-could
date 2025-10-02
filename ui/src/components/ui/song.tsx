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
	POST_PLAYLISTS_ADD_SONG_ENDPOINT,
	PUT_START_PLAYBACK_ENDPOINT,
	PUT_STOP_PLAYBACK_ENDPOINT
} from '@/utils/config';

import { Button } from "./button"

import { Checkbox } from "./checkbox"

import { Playlist } from '@/types/spotify';

interface SongProps {
	id: string
	name: string
	artists: string
	album: string
	album_pic_url?: string
	onRefresh: () => void
	allPlaylists?: Playlist[]
	className?: string
}


export const SongCard: React.FC<SongProps> = ({
	id,
	name,
	artists,
	album,
	album_pic_url,
	onRefresh,
	allPlaylists = [],
	className = ""
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
					<li key={playlist.id} className="flex items-center space-x-3 py-2">
						<img 
							src={playlist.playlist_image_url || '/default-playlist.png'} 
							alt={playlist.name}
							className="w-10 h-10 rounded-sm object-cover"
						/>
						<Checkbox 
							id={`playlist-${playlist.id}`}
							onCheckedChange={(checked) => updateSelectedPlaylists(playlist.id, checked)}
						/>
						<label 
							htmlFor={`playlist-${playlist.id}`}
							className="truncate"
						>
							{playlist.name}
						</label>
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

	const [isPlaying, setIsPlaying] = useState(false);
	const [playbackLoading, setPlaybackLoading] = useState(false);

	const handlePlaybackToggle = async () => {
		setPlaybackLoading(true);
		try {
			if (!isPlaying) {
				// Start playback
				const response = await fetch(PUT_START_PLAYBACK_ENDPOINT, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ songId: id }),
				});
				if (response.ok) {
					setIsPlaying(true);
				} else {
					alert('Failed to start playback.');
				}
			} else {
				// Stop playback
				const response = await fetch(PUT_STOP_PLAYBACK_ENDPOINT, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ songId: id }),
				});
				if (response.ok) {
					setIsPlaying(false);
				} else {
					alert('Failed to stop playback.');
				}
			}
		} catch (error) {
			alert('An error occurred while toggling playback.');
		} finally {
			setPlaybackLoading(false);
		}
	};

		return (
			<Card className={`w-full max-w-5xl ${className}`}>
			<CardHeader>
				<div className="flex items-center justify-between space-x-4">
					<div className="flex items-center space-x-4">
						{/* Play/Pause Button */}
						<Button
							size="icon"
							variant={isPlaying ? "secondary" : "default"}
							onClick={handlePlaybackToggle}
							disabled={playbackLoading}
							aria-label={isPlaying ? "Pause" : "Play"}
							className="mr-4 w-16 h-16 min-w-[64px] min-h-[64px] max-w-[64px] max-h-[64px] p-0 overflow-hidden relative"
							style={album_pic_url ? { backgroundImage: `url('${album_pic_url}')`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
						>
							{/* Overlay for icon visibility */}
							{album_pic_url && (
								<span className="absolute inset-0 bg-black/10 z-0" />
							)}
							<span className="relative z-10 flex items-center justify-center w-full h-full">
								{isPlaying ? (
									<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 32 32" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-white">
										<rect x="8" y="7" width="6" height="18" rx="1" fill="currentColor" />
										<rect x="18" y="7" width="6" height="18" rx="1" fill="currentColor" />
									</svg>
								) : (
									<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 32 32" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-white">
										<polygon points="8,6 28,16 8,26" fill="currentColor" />
									</svg>
								)}
							</span>
						</Button>
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
								className="ml-2 whitespace-nowrap w-28 h-10 min-w-[112px] min-h-[40px] max-w-[112px] max-h-[40px] bg-[#1DB954] text-black hover:bg-[#1ed760]">
								Add to playlists
							</Button>
						</DialogTrigger>
						<DialogContent className="max-h-[80vh] overflow-hidden">
							<DialogHeader>
								<DialogTitle>Playlists</DialogTitle>
								<DialogDescription className="max-h-[60vh] overflow-y-auto pr-4">
									{renderPlaylists()}
								</DialogDescription>
							</DialogHeader>
							<DialogFooter className="flex justify-center w-full">
								<Button
									onClick={addSongToPlaylists}
									className="w-28 h-10 min-w-[112px] min-h-[40px] max-w-[112px] max-h-[40px] bg-[#1DB954] text-black hover:bg-[#1ed760]"
								>
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
