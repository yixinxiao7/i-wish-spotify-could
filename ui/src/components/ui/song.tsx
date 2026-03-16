import React, { useState, useEffect, useCallback } from 'react';

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
	onSuccess?: (message: string) => void
	allPlaylists?: Playlist[]
	className?: string
}

interface Toast {
	message: string;
	type: 'success' | 'error';
}

const TOAST_DISMISS_MS = 5000;

export const SongCard: React.FC<SongProps> = React.memo(({
	id,
	name,
	artists,
	album,
	album_pic_url,
	onRefresh,
	onSuccess,
	allPlaylists = [],
	className = ""
}) => {
	const [selectedPlaylists, setSelectedPlaylists] = useState<Playlist[]>([]);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [toast, setToast] = useState<Toast | null>(null);
	const [addingToPlaylist, setAddingToPlaylist] = useState(false);

	const showToast = useCallback((message: string, type: 'success' | 'error') => {
		setToast({ message, type });
	}, []);

	// Auto-dismiss toast
	useEffect(() => {
		if (!toast) return;
		const timer = setTimeout(() => setToast(null), TOAST_DISMISS_MS);
		return () => clearTimeout(timer);
	}, [toast]);

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
							width={44}
							height={44}
							loading="lazy"
							decoding="async"
							className="w-11 h-11 rounded-sm object-cover"
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
			showToast("Please select at least one playlist to add the song to.", 'error');
			return;
		}
		if (addingToPlaylist) return;

		setAddingToPlaylist(true);
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
				setSelectedPlaylists([]);
				setDialogOpen(false);
				onSuccess?.("Songs added to playlists successfully!");
				onRefresh();
			} else {
				showToast("Failed to add songs to playlists.", 'error');
			}
		})
		.catch(error => {
			console.error("Error adding songs to playlists:", error);
			showToast("An error occurred while adding songs to playlists.", 'error');
		})
		.finally(() => {
			setAddingToPlaylist(false);
		});
	}

	const [isPlaying, setIsPlaying] = useState(false);
	const [playbackLoading, setPlaybackLoading] = useState(false);

	const handlePlaybackToggle = async () => {
		setPlaybackLoading(true);
		try {
			if (!isPlaying) {
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
					showToast('Failed to start playback.', 'error');
				}
			} else {
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
					showToast('Failed to stop playback.', 'error');
				}
			}
		} catch {
			showToast('An error occurred while toggling playback.', 'error');
		} finally {
			setPlaybackLoading(false);
		}
	};

	return (
		<>
			<Card className={`glass-surface w-full max-w-5xl rounded-xl text-brand-body ${className}`}>
				<CardHeader className="p-4 sm:p-6">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
						<div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
							{/* Play/Pause Button */}
							<Button
								size="icon"
								onClick={handlePlaybackToggle}
								disabled={playbackLoading}
								aria-label={isPlaying ? "Pause" : "Play"}
								className="btn-brand-primary relative h-12 w-12 min-h-[48px] min-w-[48px] flex-shrink-0 overflow-hidden p-0 sm:h-16 sm:w-16 sm:min-h-[64px] sm:min-w-[64px]"
								style={album_pic_url ? { backgroundImage: `url('${album_pic_url}')`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
							>
								{/* Overlay for icon visibility */}
								{album_pic_url && (
									<span className="absolute inset-0 bg-black/40 z-0" />
								)}
								<span className="relative z-10 flex items-center justify-center w-full h-full">
									{isPlaying ? (
										<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 32 32" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 sm:w-8 sm:h-8 text-white">
											<rect x="8" y="7" width="6" height="18" rx="1" fill="currentColor" />
											<rect x="18" y="7" width="6" height="18" rx="1" fill="currentColor" />
										</svg>
									) : (
										<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 32 32" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 sm:w-8 sm:h-8 text-white">
											<polygon points="8,6 28,16 8,26" fill="currentColor" />
										</svg>
									)}
								</span>
							</Button>
							<div className="min-w-0">
								<CardTitle className="text-sm font-bold leading-none text-brand-heading sm:text-[1rem] truncate">{name}</CardTitle>
								<CardDescription className="mt-1 text-xs text-brand-muted sm:mt-2 sm:text-[.875rem]">
									<div className="truncate">{artists}</div>
									<div className="truncate">
										<b className="text-brand-body">{album}</b>
									</div>
								</CardDescription>
							</div>
						</div>
						<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
							<DialogTrigger asChild>
								<Button
									size="sm"
									className="btn-brand-primary h-11 w-full whitespace-nowrap px-4 text-xs font-semibold sm:h-10 sm:w-auto sm:min-w-[150px] sm:max-w-[150px]">
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
										disabled={addingToPlaylist}
										className="btn-brand-primary h-11 w-full text-base font-semibold sm:h-10 sm:w-auto sm:min-w-[170px] sm:max-w-[170px]"
									>
										{addingToPlaylist ? "adding..." : "add"}
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</div>
				</CardHeader>
			</Card>

			{/* Toast notification */}
			{toast && (
				<div
					role="status"
					aria-live="polite"
					aria-atomic="true"
					className={`fixed bottom-5 left-5 right-5 z-50 flex items-center gap-3 rounded-2xl px-5 py-3 shadow-md sm:left-auto ${
						toast.type === 'success'
							? 'toast-success'
							: 'toast-error'
					}`}
				>
					<span className="text-sm font-medium">{toast.message}</span>
					<button
						onClick={() => setToast(null)}
						aria-label="Dismiss notification"
						className="ml-1 flex-shrink-0 rounded-full p-2 hover:bg-foreground/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
							<path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
						</svg>
					</button>
				</div>
			)}
		</>
	)
})
