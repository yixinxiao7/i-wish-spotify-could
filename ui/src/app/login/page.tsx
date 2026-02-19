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
      `&scope=${scopes_url_params}`;
    window.location.href = authUrl;
  };

  return (
    <section
      className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-6 py-12"
      style={{
        background:
          'linear-gradient(145deg, #d5f7ff 0%, #8fdfff 26%, #6cb4ef 48%, #6fdc94 72%, #b8f487 100%)',
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(255,255,255,0.72),transparent_46%),radial-gradient(circle_at_78%_14%,rgba(176,248,255,0.58),transparent_42%),radial-gradient(circle_at_22%_82%,rgba(163,255,154,0.46),transparent_44%),radial-gradient(circle_at_84%_74%,rgba(255,243,146,0.42),transparent_38%),radial-gradient(circle_at_48%_54%,rgba(96,163,255,0.38),transparent_52%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.16),rgba(255,255,255,0)_35%,rgba(26,132,223,0.12)_62%,rgba(121,208,95,0.2)_100%)] mix-blend-soft-light" />
      <div className="absolute inset-0 opacity-30 [background-image:repeating-linear-gradient(125deg,rgba(255,255,255,0.26)_0px,rgba(255,255,255,0.26)_1px,transparent_1px,transparent_14px)]" />

      <article className="relative z-10 w-full max-w-md rounded-3xl border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.85),rgba(245,255,248,0.7))] p-8 text-slate-800 shadow-[0_25px_80px_rgba(19,72,96,0.35)] backdrop-blur-md">
        <p className="mb-2 text-xs uppercase tracking-[0.28em] text-emerald-700/90">I Wish Spotify Could</p>
        <h1 className="text-4xl font-bold leading-tight text-[#185a57]">better organize your songs</h1>
        <p className="mt-4 text-sm leading-relaxed text-[#2a4d52]">
          but there's little things missing, so here's a couple of tools to help you out!
        </p>
        <Button
          onClick={handleLogin}
          size="lg"
          className="mt-8 h-12 w-full rounded-full border border-white/90 bg-[linear-gradient(90deg,#3fd15a,#5bc6f5)] text-base font-semibold text-[#033524] shadow-lg transition hover:scale-[1.01] hover:brightness-105"
        >
          Log in
        </Button>
      </article>
    </section>
  );
};

export default Login;
