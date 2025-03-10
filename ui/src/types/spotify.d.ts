export interface Song {
    id: string;
    name: string;
    artists: string;
    album: string;
    duration_ms: number;
    explicit: boolean;
    preview_url: string | null;
    track_number: number;
    popularity: number;
    external_urls: {
      spotify: string;
    };
  }

  export interface Playlist {
    id: string;
    name: string;
    description: string;
  }
