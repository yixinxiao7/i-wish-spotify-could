import React from 'react';
import { SCOPES, AUTHORIZE_ENDPOINT, REDIRECT_URL } from '@/utils/config';

const client_id = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID
const redirect_url = String(REDIRECT_URL)
const scopes_url_params = SCOPES.join("%20")

const Login: React.FC = () => {
    const handleLogin = () => {
        const authUrl = `${AUTHORIZE_ENDPOINT}?client_id=${client_id}` +
                        `&response_type=code` +
                        `&redirect_uri=${encodeURIComponent(redirect_url)}` +
                        `&scope=${scopes_url_params}`;
        window.location.href = authUrl;
    }

    return(
        <div>
            <button onClick={handleLogin}> Log in</button>
        </div>
    )

}

export default Login;