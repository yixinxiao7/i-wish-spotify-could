"use client"

import React, { useEffect, useState } from 'react';
import { GET_SONGS_ENDPOINT } from '@/utils/config';
import { Song } from '@/types/spotify';

const SongsPage: React.FC = () => {
    const [songs, setSongs] = useState<Song[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    useEffect(() => {
        const fetchSongs = async () => {
          try {
            const response = await fetch(GET_SONGS_ENDPOINT, {
              method: "POST",
              mode: 'cors',
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                offset: 0,
                limit: 10,
              }),
            });
            if (response.ok) {
              const data = await response.json();
              setSongs(data.songs);
            } else {
              throw new Error("Failed to fetch songs");
            }
          } catch (error) {
            console.error("Error fetching songs:", error);
          } finally {
            setLoading(false);
          }
        };

        fetchSongs();
    }, []);

    const renderSongs = () => {
      console.log(songs)
      if (songs.length !== 0) {
        return songs.map((song) => (
            <div key={song.id}>
                <h2>{song.name}</h2>
            </div>
        ));
      }
    }

    if (loading) {
        return <p>Loading</p>;
    }

    return (
        <>
            <h1>Songs</h1>
            {renderSongs()}
        </>
    )
}

export default SongsPage;