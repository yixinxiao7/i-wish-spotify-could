import React from "react"
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
	DialogDescription
} from "./dialog"

import { Button } from "./button"

import { Checkbox } from "./checkbox"

import { Playlist } from '@/types/spotify';

interface SongProps {
  id: string
  name: string
  artists: string
  album: string
	allPlaylists?: Playlist[]
}


export const SongCard: React.FC<SongProps> = ({
  id,
  name,
  artists,
  album,
	allPlaylists = []
}) => {

	const renderPlaylists = () => {
		if (!allPlaylists || allPlaylists.length === 0) {
			return <p>No playlists available</p>;
		}
		return (
			<>
				{allPlaylists.map((playlist) => (
					<li key={playlist.id} className="flex items-center space-x-2 py-1">
						<Checkbox id={`playlist-${playlist.id}`} />
						<label htmlFor={`playlist-${playlist.id}`}>{playlist.name}</label>
					</li>
				))}
			</>
		);
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
                <DialogTitle>Song Details</DialogTitle>
                <DialogDescription>
									{renderPlaylists()}
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      {/* {description && (
        <CardContent>
          <p>{description}</p>
        </CardContent>
      )} */}
      {/* <CardFooter className="justify-between">
        {duration && <span className="text-xs text-muted-foreground">{duration}</span>}
        {onPlay && (
          <button
            onClick={onPlay}
            className="px-3 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
          >
            Play
          </button>
        )}
      </CardFooter> */}
    </Card>
  )
}
