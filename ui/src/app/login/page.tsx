'use client';

import React from 'react';
import { SCOPES, AUTHORIZE_ENDPOINT, REDIRECT_URL } from '@/utils/config';
import { Button } from '@/components/ui/button';

const client_id = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
const redirect_url = String(REDIRECT_URL);
const scopes_url_params = SCOPES.join('%20');

const generateRandomString = (length = 16) => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(36).padStart(2, '0')).join('').slice(0, length);
};

const Login: React.FC = () => {
  const handleLogin = () => {
    const state = generateRandomString();
    sessionStorage.setItem('oauth_state', state);
    const authUrl = `${AUTHORIZE_ENDPOINT}?client_id=${client_id}` +
      '&response_type=code' +
      `&redirect_uri=${encodeURIComponent(redirect_url)}` +
      `&state=${state}` +
      `&scope=${scopes_url_params}` +
      '&show_dialog=true';
    window.location.href = authUrl;
  };

  return (
    <section
      className="auth-bg relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12"
    >
      <article className="glass-surface relative w-full max-w-md rounded-3xl p-6 text-brand-body sm:p-8">
        <p className="mb-2 text-xs uppercase tracking-[0.28em] text-brand-label">I Wish Spotify Could</p>
        <h1 className="text-3xl font-bold leading-tight text-brand-heading sm:text-4xl">better organize your songs</h1>
        <p className="mt-3 text-sm leading-relaxed text-brand-muted sm:mt-4">
          but there&apos;s little things missing, so here&apos;s a couple of tools to help you out!
        </p>
        <Button
          onClick={handleLogin}
          size="lg"
          className="btn-brand-primary mt-8 h-12 w-full text-base font-semibold"
        >
          Log in
        </Button>
      </article>
    </section>
  );
};

export default Login;
