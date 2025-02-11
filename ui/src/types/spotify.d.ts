export interface Song {
    id: string;
    name: string;
    artists: Artist[];
    album: Album;
    duration_ms: number;
    explicit: boolean;
    preview_url: string | null;
    track_number: number;
    popularity: number;
    external_urls: {
      spotify: string;
    };
  }
  
  export interface Artist {
    id: string;
    name: string;
    external_urls: {
      spotify: string;
    };
  }
  
  export interface Album {
    id: string;
    name: string;
    release_date: string;
    images: {
      url: string;
      height: number;
      width: number;
    }[];
    external_urls: {
      spotify: string;
    };
  }