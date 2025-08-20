"use client"

import React, { useEffect, useState } from 'react';

import {
  GET_TOTAL_SONGS_ENDPOINT,
  GET_SONGS_ENDPOINT,
  GET_PLAYLISTS_ENDPOINT
} from '@/utils/config';

import { Song, Playlist } from '@/types/spotify';

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  SongCard
} from "@/components/ui/song"


const SongsPage: React.FC = () => {
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [songs, setSongs] = useState<Song[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [loading, setLoading] = useState<boolean>(true);
    const [offset, setOffset] = useState<number>(0);
    const [limit, setLimit] = useState<number>(10);

    useEffect(() => {
        fetchPlaylists();  
        fetchTotalSongs();
        fetchSongs(offset, limit);
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
      } catch (error) {
        console.error("Error fetching playlists:", error);
      }
    }

    const fetchSongs = async (offset: number, limit: number) => {
      // construct urls
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(limit),
      }).toString();
      const url = new URL(GET_SONGS_ENDPOINT);
      url.search = params;

      try {
        const response = await fetch(url, {
          method: "GET",
          mode: 'cors',
          headers: {
            "Content-Type": "application/json"
          }
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
        setOffset(offset);
        setLimit(limit);
        setLoading(false);
      }
    };

    const renderSongs = () => {
      if (songs.length !== 0) {
        return songs.map((song) => (
          <SongCard
            key={song.id}
            id={song.id}
            name={song.name}
            artists={song.artists}
            album={song.album}
            allPlaylists={playlists}
            onRefresh={refreshSongs}
          />
        ));
      }
    }

    const refreshSongs = () => {
      setLoading(true);
      fetchSongs(offset, limit);
    }

    const getLastPage = () => {
      return Math.ceil(total / limit);
    }

    const handleOffsetChange = (newOffset: number, newPage: number) => {
      if (newOffset < 0) {
        newOffset = 0;
      } 
      else if (newOffset > total) {
        newOffset -= limit;
      }

      const lastPage = getLastPage();
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
            <h1>Uncategorized Songs</h1>
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
              <Pagination>
                <PaginationContent>
                  {currentPage != 1 && 
                    <>
                      <PaginationItem>
                        <PaginationPrevious onClick={() => {
                          handleOffsetChange(offset-limit, currentPage-1);
                        }} />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink onClick={() => handleOffsetChange(0, 1)}>
                          1
                        </PaginationLink>
                      </PaginationItem>
                    </>
                  }
                  {currentPage > 2 &&
                    <>
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink onClick={() =>
                          handleOffsetChange(offset-limit, currentPage-1)}>
                          {currentPage-1}
                        </PaginationLink>
                      </PaginationItem>
                    </>         
                  }
                    <PaginationItem>
                      <PaginationLink isActive={true}>
                        {currentPage}
                      </PaginationLink>
                    </PaginationItem>
                  {currentPage < getLastPage()-1 &&
                    <>
                      <PaginationItem>
                        <PaginationLink onClick={() =>
                          handleOffsetChange(offset+limit, currentPage+1)}>
                          {currentPage+1}
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    </>
                  }
                  {currentPage != getLastPage() &&
                    <>
                      <PaginationItem>
                        <PaginationLink onClick={() => {
                            handleOffsetChange((getLastPage()-1)*limit, getLastPage());
                          }}>
                            {getLastPage()}
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext onClick={() => {
                          handleOffsetChange(offset+limit, currentPage+1);
                        }} />
                      </PaginationItem>
                    </>
                  }
                </PaginationContent>
              </Pagination>
            }
        </div>
    )
}

export default SongsPage;