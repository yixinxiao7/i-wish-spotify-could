import { Interface } from "readline";


export interface Song {
    id: string;
    name: string;
    artists: string;
    album: string;
    album_pic_url?: string; // Optional, may not always be present
    duration_ms: number;
    explicit: boolean;
    preview_url?: string;
    track_number: number;
    popularity: number;
    external_urls: {
      spotify: string;
    };
  }
  
  
  export interface Playlist {
    id: string;
    name: string;
    owner_id: string;
  }

  // export interface Artist {
  //   id: string;
  //   name: string;
  //   external_urls: {
  //     spotify: string;
  //   };
  // }
  
  // export interface Album {
  //   id: string;
  //   name: string;
  //   release_date: string;
  //   images: {
  //     url: string;
  //     height: number;
  //     width: number;
  //   }[];
  //   external_urls: {
  //     spotify: string;
  //   };
  // }