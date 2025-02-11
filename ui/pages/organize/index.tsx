import React, { useEffect, useState } from 'react';
import { GET_SONGS_ENDPOINT } from '@/utils/config';
import { Song } from '@/types/spotify';

const SongsPage: React.FC = () => {
    const [songs, setSongs] = useState<Song[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    
    useEffect(() => {
        const fetchSongs = async () => {
          try {
            const response = await fetch(GET_SONGS_ENDPOINT);
            if (response.ok) {
              const data = await response.json();
              setSongs(data);
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
        return songs.map((song) => (
            <div key={song.id}>
                <h2>{song.name}</h2>
            </div>
        ));
    }

    if (loading) {
        return <p>Loading</p>;
    }

    return (
        <div>
            <h1>Songs</h1>
            {renderSongs()}
        </div>
    )
}