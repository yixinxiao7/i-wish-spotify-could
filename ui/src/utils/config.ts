export const SCOPES = [
    'playlist-read-private',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-read-currently-playing',
    'user-read-private',
    'user-read-email',
    'user-library-read',
    'user-modify-playback-state'
]
// Public spotify urls
export const AUTHORIZE_ENDPOINT = "https://accounts.spotify.com/authorize";

// Redirect url for spotify's oauth
export const REDIRECT_URL = `${process.env.NEXT_PUBLIC_WEB_HOST}/callback`;

// Backend APIs
export const POST_TOKEN_ENDPOINT = `${process.env.NEXT_PUBLIC_SERVER_HOST}/api/oauth`;
export const GET_TOTAL_SONGS_ENDPOINT = `${process.env.NEXT_PUBLIC_SERVER_HOST}/api/songs/total`; 
export const GET_SONGS_ENDPOINT = `${process.env.NEXT_PUBLIC_SERVER_HOST}/api/songs`;
export const GET_PLAYLISTS_ENDPOINT = `${process.env.NEXT_PUBLIC_SERVER_HOST}/api/playlists`;
export const POST_PLAYLISTS_ADD_SONG_ENDPOINT = `${process.env.NEXT_PUBLIC_SERVER_HOST}/api/playlists/add-song`;
export const PUT_START_PLAYBACK_ENDPOINT = `${process.env.NEXT_PUBLIC_SERVER_HOST}/api/playback/start`;
export const PUT_STOP_PLAYBACK_ENDPOINT = `${process.env.NEXT_PUBLIC_SERVER_HOST}/api/playback/stop`;