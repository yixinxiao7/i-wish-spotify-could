import React from 'react';

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID
const REDIRECT_URI = String(process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI)
const AUTHORIZE_ENDPOINT = "https://accounts.spotify.com/authorize"
const SCOPES = [
    'playlist-read-private',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-read-currently-playing',
    'user-read-private',
    'user-read-email',
    'user-library-read'
]
const SCOPES_URI_PARAMS = SCOPES.join("%20")

const Login: React.FC = () => {
    const handleLogin = () => {
        const authUrl = `${AUTHORIZE_ENDPOINT}?client_id=${CLIENT_ID}` +
                        `&response_type=code` +
                        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
                        `&scope=${SCOPES_URI_PARAMS}`;
        window.location.href = authUrl;
    }

    return(
        <div>
            <button onClick={handleLogin}> Log in</button>
        </div>
    )

}

export default Login;