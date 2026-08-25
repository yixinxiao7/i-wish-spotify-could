export const SCOPES = [
    'playlist-read-private',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-read-currently-playing',
    'user-read-private',
    'user-read-email',
    'user-library-read',
    'user-modify-playback-state',
    'user-top-read'
]
// Public spotify urls
export const AUTHORIZE_ENDPOINT = "https://accounts.spotify.com/authorize";

// Redirect url for spotify's oauth. Derived from the live browser origin
// rather than a build-time host, so the callback always lands on the same
// origin that started the login (sessionStorage is partitioned per-origin).
export const getRedirectUrl = () => `${window.location.origin}/callback`;

// Backend APIs
export const POST_TOKEN_ENDPOINT = `${process.env.NEXT_PUBLIC_SERVER_HOST}/api/oauth/`;
export const GET_TOTAL_SONGS_ENDPOINT = `${process.env.NEXT_PUBLIC_SERVER_HOST}/api/songs/total`;
export const GET_SONGS_ENDPOINT = `${process.env.NEXT_PUBLIC_SERVER_HOST}/api/songs/`;
export const POST_REFRESH_SONGS_ENDPOINT = `${process.env.NEXT_PUBLIC_SERVER_HOST}/api/songs/refresh`;
export const GET_PLAYLISTS_ENDPOINT = `${process.env.NEXT_PUBLIC_SERVER_HOST}/api/playlists/`;
export const POST_PLAYLISTS_ADD_SONG_ENDPOINT = `${process.env.NEXT_PUBLIC_SERVER_HOST}/api/playlists/add-song`;
export const GET_PLAYLIST_PINS_ENDPOINT = `${process.env.NEXT_PUBLIC_SERVER_HOST}/api/playlists/pins`;
export const POST_PLAYLIST_PIN_ENDPOINT = `${process.env.NEXT_PUBLIC_SERVER_HOST}/api/playlists/pin`;
// Playlist-cleanup / song-propagation: reading/removing/adding songs within
// one playlist. GET takes offset/limit/sort (and, for propagation,
// exclude_playlist_id) as query params, DELETE takes { songId } as its body.
// excludePlaylistId is appended here rather than left to the caller so both
// features build the same URL shape; callers that also need offset/limit/
// sort should merge them into this URL's existing search params rather than
// overwriting it.
export const getPlaylistSongsEndpoint = (playlistId: string, excludePlaylistId?: string) => {
    const base = `${process.env.NEXT_PUBLIC_SERVER_HOST}/api/playlists/${playlistId}/songs`;
    return excludePlaylistId
        ? `${base}?${new URLSearchParams({ exclude_playlist_id: excludePlaylistId }).toString()}`
        : base;
};
export const PUT_START_PLAYBACK_ENDPOINT = `${process.env.NEXT_PUBLIC_SERVER_HOST}/api/playback/start`;
export const PUT_STOP_PLAYBACK_ENDPOINT = `${process.env.NEXT_PUBLIC_SERVER_HOST}/api/playback/stop`;
export const DELETE_LOGOUT_ENDPOINT = `${process.env.NEXT_PUBLIC_SERVER_HOST}/api/oauth/logout`;