'use client';

import React from 'react';
import { SCOPES, AUTHORIZE_ENDPOINT, REDIRECT_URL } from '@/utils/config';
import { Button } from '@/components/ui/button'

const client_id = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID
const redirect_url = String(REDIRECT_URL)
const scopes_url_params = SCOPES.join("%20")

const generateRandomString = (length = 16) => {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(36).padStart(2, '0')).join('').slice(0, length);
}

const Login: React.FC = () => {
    const handleLogin = () => {
        const authUrl = `${AUTHORIZE_ENDPOINT}?client_id=${client_id}` +
                        `&response_type=code` +
                        `&redirect_uri=${encodeURIComponent(redirect_url)}` +
                        `&state=${generateRandomString()}` +
                        `&scope=${scopes_url_params}`;
        window.location.href = authUrl;
    }

    return <Button onClick={handleLogin}>Log in</Button>

}

export default Login;