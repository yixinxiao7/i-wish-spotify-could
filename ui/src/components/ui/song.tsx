import React, { useState, useEffect, useContext, useMemo } from 'react';
import Image from 'next/image';
import { Music, Plus, Trash2 } from 'lucide-react';

import {
	Card,
	CardHeader,
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

import { PlaylistList } from "./playlist-list"

import { PlaylistsContext } from '@/components/playlists-provider';
import { useToast } from '@/components/toast-provider';

import { Playlist } from '@/types/spotify';

interface SongProps {
	id: string
	name: string
	artists: string
	album: string
	album_pic_url?: string
	onRefresh: () => void
	onSuccess?: (message: string) => void
	/** Optional override; when omitted, playlists come from PlaylistsProvider. */
	allPlaylists?: Playlist[]
	/** Renders a trash control when present (e.g. playlist cleanup). */
	onRemove?: (songId: string) => void
	/** Renders a plus control when present (e.g. song propagation), in the
	 * same slot as onRemove's trash control. */
	onAdd?: (songId: string) => void
	/** Hides the "add to playlists" dialog and its trigger — e.g. song
	 * propagation, where the destination is already chosen and a second,
	 * contradictory destination picker would be noise. Defaults to true. */
	showAddToPlaylists?: boolean
	/** Set for rows already within the viewport on first render — album art
	 * is the hero, and this app's LCP element, so it should not wait behind
	 * lazy-loading like rows below the fold. */
	priority?: boolean
	className?: string
}

export const SongCard: React.FC<SongProps> = React.memo(({
	id,
	name,
	artists,
	album,
	album_pic_url,
	onRefresh,
	onSuccess,
	allPlaylists,
	onRemove,
	onAdd,
	showAddToPlaylists = true,
	priority = false,
	className = ""
}) => {
	const [selectedPlaylists, setSelectedPlaylists] = useState<Playlist[]>([]);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [addingToPlaylist, setAddingToPlaylist] = useState(false);
	const playlistsContext = useContext(PlaylistsContext);
	const { showToast } = useToast();

	// Surface pin failures on this song's toast, but only while its own
	// dialog is open — otherwise every rendered SongCard would toast at once,
	// since the pin error lives in shared provider state. Skipped entirely
	// when the dialog itself is hidden (showAddToPlaylists=false): there is
	// no dialog whose "open" state this could ever be gated on.
	useEffect(() => {
		if (showAddToPlaylists && dialogOpen && playlistsContext?.error) {
			showToast(playlistsContext.error, 'error');
		}
	}, [showAddToPlaylists, dialogOpen, playlistsContext?.error, showToast]);

	const selectedPlaylistIds = useMemo(
		() => new Set(selectedPlaylists.map((p) => p.id)),
		[selectedPlaylists]
	);

	const updateSelectedPlaylists = (playlist: Playlist, checked: boolean) => {
		setSelectedPlaylists((prev) => {
			if (checked) {
				return [...prev, playlist];
			} else {
				return prev.filter((p) => p.id !== playlist.id);
			}
		});
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
		<li className={`w-full list-none ${className}`}>
			<Card className="surface-row w-full max-w-5xl rounded-xl text-brand-body">
				<CardHeader className="p-4 sm:p-6">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
						<div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
							{/* Album art is the hero — a real image, not a decoration behind a button */}
							<div className="group relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg sm:h-20 sm:w-20">
								{album_pic_url ? (
									<Image
										src={album_pic_url}
										alt={`${album} cover art`}
										fill
										sizes="80px"
										className="object-cover"
										priority={priority}
										loading={priority ? undefined : "lazy"}
									/>
								) : (
									<div className="flex h-full w-full items-center justify-center bg-brand-footer text-brand-muted">
										<Music className="h-6 w-6" aria-hidden="true" />
									</div>
								)}
								<div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/30 group-focus-within:bg-black/30" />
								{/* A quiet media-control overlay, not the brand fill — "add to
								    playlists" is this card's one primary action, and album art
								    is the hero it should not compete with for attention (M6).
								    Dimmed until hover/focus so it doesn't permanently cover the
								    art, but never fully invisible so it stays reachable without
								    a pointer. */}
								<Button
									size="icon"
									variant="ghost"
									onClick={handlePlaybackToggle}
									disabled={playbackLoading}
									aria-label={isPlaying ? "Pause" : "Play"}
									className="absolute bottom-1 right-1 z-10 h-8 w-8 rounded-full bg-black/50 p-0 text-white opacity-60 shadow-md before:absolute before:-inset-1.5 before:content-[''] transition-opacity duration-200 hover:bg-black/60 hover:text-white hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
								>
									{isPlaying ? (
										<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 32 32" strokeWidth={1.5} stroke="currentColor" className="h-3.5 w-3.5">
											<rect x="8" y="7" width="6" height="18" rx="1" fill="currentColor" />
											<rect x="18" y="7" width="6" height="18" rx="1" fill="currentColor" />
										</svg>
									) : (
										<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 32 32" strokeWidth={1.5} stroke="currentColor" className="h-3.5 w-3.5">
											<polygon points="8,6 28,16 8,26" fill="currentColor" />
										</svg>
									)}
								</Button>
							</div>
							<div className="min-w-0">
								<h2 className="text-sm font-bold leading-none text-brand-heading sm:text-[1rem] truncate">{name}</h2>
								<CardDescription className="mt-1 text-xs text-brand-muted sm:mt-2 sm:text-[.875rem]">
									<div className="truncate">{artists}</div>
									{album !== name && album !== artists && (
										<div className="truncate">
											<b className="text-brand-body">{album}</b>
										</div>
									)}
								</CardDescription>
							</div>
						</div>
						<div className="flex items-center gap-2 sm:gap-3">
							{showAddToPlaylists && (
								<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
									<DialogTrigger asChild>
										<Button
											size="sm"
											variant="brand"
											className="h-11 w-full whitespace-nowrap px-4 text-xs font-semibold sm:h-10 sm:w-auto sm:min-w-[150px] sm:max-w-[150px]">
											add to playlists
										</Button>
									</DialogTrigger>
									<DialogContent className="flex max-h-[85vh] flex-col overflow-hidden">
										<DialogHeader className="flex-shrink-0">
											<DialogTitle>Playlists</DialogTitle>
											<DialogDescription>Select one or more playlists to add this song to.</DialogDescription>
										</DialogHeader>
										<div className="min-h-0 flex-1 overflow-y-auto pr-3">
											<PlaylistList
												playlists={allPlaylists}
												selectedIds={selectedPlaylistIds}
												onToggleSelect={updateSelectedPlaylists}
											/>
										</div>
										<DialogFooter className="flex w-full flex-shrink-0 justify-center">
											<Button
												onClick={addSongToPlaylists}
												disabled={addingToPlaylist}
												variant="brand"
												className="h-11 w-full text-base font-semibold sm:h-10 sm:w-auto sm:min-w-[170px] sm:max-w-[170px]"
											>
												{addingToPlaylist ? "adding..." : "add"}
											</Button>
										</DialogFooter>
									</DialogContent>
								</Dialog>
							)}
							{onRemove && (
								<Button
									size="icon"
									variant="brandDestructive"
									onClick={() => onRemove(id)}
									aria-label={`Remove ${name}`}
									className="h-11 w-11 flex-shrink-0 rounded-full p-0 sm:h-10 sm:w-10"
								>
									<Trash2 className="h-4 w-4" aria-hidden="true" />
								</Button>
							)}
							{onAdd && (
								<Button
									size="icon"
									variant="brand"
									onClick={() => onAdd(id)}
									aria-label={`Add ${name}`}
									className="h-11 w-11 flex-shrink-0 rounded-full p-0 sm:h-10 sm:w-10"
								>
									<Plus className="h-4 w-4" aria-hidden="true" />
								</Button>
							)}
						</div>
					</div>
				</CardHeader>
			</Card>
		</li>
	)
})
SongCard.displayName = "SongCard"
