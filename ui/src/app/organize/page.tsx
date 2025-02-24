"use client"

import React, { useEffect, useState } from 'react';
import { GET_SONGS_ENDPOINT } from '@/utils/config';
import { Song } from '@/types/spotify';
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

const SongsPage: React.FC = () => {
    const [songs, setSongs] = useState<Song[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [offset, setOffset] = useState<number>(0);
    const [limit, setLimit] = useState<number>(10);

    useEffect(() => {
        fetchSongs(offset, limit);
    }, []);

    const fetchSongs = async (offset: number, limit: number) => {
      try {
        const response = await fetch(GET_SONGS_ENDPOINT, {
          method: "POST",
          mode: 'cors',
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            offset: offset,
            limit: limit,
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
        setOffset(offset)
        setLimit(limit)
        setLoading(false);
      }
    };

    const renderSongs = () => {
      if (songs.length !== 0) {
        return songs.map((song) => (
            <div key={song.id}>
                <h2>{song.name}</h2>
            </div>
        ));
      }
    }

    const handleOffsetChange = (offset: number) => {
      if (offset < 0) {
        offset = 0;
      }
      setLoading(true);
      fetchSongs(offset, limit);
    }
    
    const handleLimitChange = (limit: number) => {
      setLoading(true);
      fetchSongs(offset, limit);
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
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious onClick={() => {
                    handleOffsetChange(offset - limit);
                  }} />
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink onClick={(event) => {
                    handleOffsetChange(event?.target.textValue);
                  }}>1</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext onClick={() => {
                    handleOffsetChange(offset + limit);
                  }} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
        </div>
    )
}

export default SongsPage;