export const SCOPES = [
    'playlist-read-private',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-read-currently-playing',
    'user-read-private',
    'user-read-email',
    'user-library-read'
]
// Public spotify urls
export const AUTHORIZE_ENDPOINT = "https://accounts.spotify.com/authorize";

// Redirect url for spotify's oauth
export const REDIRECT_URL = `${process.env.NEXT_PUBLIC_WEB_HOST}/callback`;

// Backend APIs
export const GET_SONGS_ENDPOINT = `${process.env.NEXT_PUBLIC_SERVER_HOST}/api/songs`;
