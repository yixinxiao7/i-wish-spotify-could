import React, { useState } from 'react';

import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
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
	const primaryPillButton =
		"rounded-full border border-white/90 bg-[linear-gradient(90deg,#3fd15a,#5bc6f5)] text-[#033524] shadow-[0_10px_30px_rgba(64,160,170,0.26)] transition hover:scale-[1.01] hover:brightness-105";
	const mutedPillButton =
		"rounded-full border border-[#9fd3e9] bg-[linear-gradient(90deg,rgba(248,251,253,0.9),rgba(226,241,250,0.9))] text-[#1f5f69] shadow-[0_10px_30px_rgba(64,160,170,0.18)] transition hover:scale-[1.01] hover:brightness-105";

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
		} catch (_error) {
			alert('An error occurred while toggling playback.');
		} finally {
			setPlaybackLoading(false);
		}
	};

		return (
			<Card className={`w-full max-w-5xl border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(240,250,246,0.76))] text-slate-800 shadow-[0_18px_45px_rgba(19,72,96,0.2)] backdrop-blur-md ${className}`}>
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
							className={`relative mr-4 h-16 w-16 max-h-[64px] max-w-[64px] min-h-[64px] min-w-[64px] overflow-hidden p-0 ${primaryPillButton}`}
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
							<CardTitle className="text-[1rem] font-bold leading-none text-[#195f5c]">{name}</CardTitle>
							<CardDescription className="mt-2 text-[.875rem] text-[#3b5f66]">
								<div>{artists}</div>
								<div>
									<b className="text-[#285e59]">{album}</b>
								</div>
							</CardDescription>
						</div>
					</div>
					<Dialog>
						<DialogTrigger asChild>
							<Button
								size="sm"
								className={`ml-2 h-10 max-h-[40px] max-w-[150px] min-h-[40px] min-w-[150px] whitespace-nowrap px-3 text-xs font-semibold ${primaryPillButton}`}>
								add to playlists
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
									className={`h-10 max-h-[40px] max-w-[170px] min-h-[40px] min-w-[170px] text-base font-semibold ${mutedPillButton}`}
								>
									add
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>
			</CardHeader>
		</Card>
	)
}
