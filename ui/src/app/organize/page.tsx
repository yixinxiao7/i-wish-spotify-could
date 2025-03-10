"use client"

import React, { useEffect, useState } from 'react';
import { 
  GET_TOTAL_SONGS_ENDPOINT, 
  GET_SONGS_ENDPOINT,
  GET_PLAYLISTS_ENDPOINT } from '@/utils/config';
import { Song, Playlist } from '@/types/spotify';
import AppPagination from '@/components/Pagination';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"


const SongsPage: React.FC = () => {
    const [songs, setSongs] = useState<Song[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [loading, setLoading] = useState<boolean>(true);
    const [offset, setOffset] = useState<number>(0);
    const [limit, setLimit] = useState<number>(10);
    const [playlists, setPlaylists] = useState<Playlist[]>([]);

    useEffect(() => {
        fetchTotalSongs();
        fetchSongs(offset, limit);
        fetchPlaylists();
    }, []);

    const fetchTotalSongs = async () => {
      try {
        const response = await fetch(GET_TOTAL_SONGS_ENDPOINT, {
          method: "GET",
          mode: 'cors',
          headers: {
            "Content-Type": "application/json"
          },
        });
        if (response.ok) {
          const data = await response.json();
          setTotal(data.total);
        } else {
          throw new Error("Failed to fetch total songs");
        }
      } catch (error) {
        console.error("Error fetching total songs:", error);
      }
    }

    const fetchSongs = async (offset: number, limit: number) => {
      try {
        const response = await fetch(
          `${GET_SONGS_ENDPOINT}?offset=${offset}&limit=${limit}`, 
          {
            method: "GET",
            mode: 'cors',
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
        if (response.ok) {
          const data = await response.json();
          setSongs(data.songs);
        } else {
          throw new Error("Failed to fetch songs");
        }
      } catch (error) {
        console.error("Error fetching songs:", error);
      } finally {
        setOffset(offset);
        setLimit(limit);
        setLoading(false);
      }
    };

    const fetchPlaylists = async () => {
      try {
        const response = await fetch(GET_PLAYLISTS_ENDPOINT, {
          method: "GET",
          mode: 'cors',
          headers: {
            "Content-Type": "application/json"
          },
        });
        if (response.ok) {
          const data = await response.json();
          setPlaylists(data.playlists);
        } else {
          throw new Error("Failed to fetch playlists");
        }
      }
      catch (error) {
        console.error("Error fetching playlists:", error);
      }
    }

    const renderSongs = () => {
      if (songs.length !== 0) {
        return songs.map((song) => (
            <Drawer key={song.id}>
                <DrawerTrigger asChild>
                  <Button variant="outline">
                    {song.name}
                  </Button>
                </DrawerTrigger>
                <DrawerContent>
                  <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                      <DrawerTitle>All playlists</DrawerTitle>
                      <DrawerDescription>Choose which playlists to add the song to.</DrawerDescription>
                    </DrawerHeader>
                    <div className="p-4 pb-0">
                      {playlists.map((playlist) => { 
                        return(
                          <div key={playlist.id} className="flex items-center justify-between p-2">
                            <span>{playlist.name}</span>
                            <input type="checkbox" />
                          </div>
                        );
                        })
                      } 
                    </div>
                    <DrawerFooter>
                      <Button>Add</Button>
                      <DrawerClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DrawerClose>
                    </DrawerFooter>
                  </div>
                </DrawerContent>
            </Drawer>
        ));
      }
    }

    const handleOffsetChange = (newOffset: number, newPage: number) => {
      if (newOffset < 0) {
        newOffset = 0;
      } 
      else if (newOffset > total) {
        newOffset -= limit;
      }

      const lastPage = Math.ceil(total / limit);
      if (newPage < 1) {
        newPage = 1;
      }
      else if (newPage > lastPage) {
        newPage = lastPage;
      }
      setLoading(true);
      setCurrentPage(newPage);
      fetchSongs(newOffset, limit);
    }
    
    const handleLimitChange = (newLimit: number) => {
      setLoading(true);
      fetchSongs(offset, newLimit);
    }

    // rendering below
    if (loading) {
        return <p>Loading</p>;
    }

    return (
        <div key="songs">
            <h1>Songs</h1>
            {renderSongs()}
            <Select onValueChange={(value) => handleLimitChange(Number(value))}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={limit} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Limit</SelectLabel>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            {total > 0 &&
              <AppPagination
                offset={offset}
                limit={limit}
                total={total}
                currentPage={currentPage}
                handleOffsetChange={handleOffsetChange}
              />
            }
        </div>
    )
}

export default SongsPage;