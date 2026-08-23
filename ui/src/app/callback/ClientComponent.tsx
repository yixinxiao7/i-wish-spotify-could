'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { POST_TOKEN_ENDPOINT, getRedirectUrl } from '@/utils/config';
import { Button } from '@/components/ui/button';

type AuthErrorKind = 'declined' | 'incomplete' | 'unverifiable' | 'exchange_failed';

const ERROR_MESSAGES: Record<AuthErrorKind, string> = {
  declined: 'Authorization was declined.',
  incomplete: 'The login response from Spotify was incomplete.',
  unverifiable: 'This login could not be verified.',
  exchange_failed: 'Login could not be completed.',
};

const isSessionValid = () => {
  const expiry = sessionStorage.getItem('token_expiry');
  if (!expiry) return false;
  const now = Math.floor(Date.now() / 1000);
  return parseInt(expiry, 10) > now;
};

interface CallbackClientProps {
  code: string | undefined;
  state: string | undefined;
  error: string | undefined;
}

const CallBackClient = ({ code, state, error }: CallbackClientProps) => {
  const router = useRouter();
  const hasHandledCallback = useRef(false);
  const [authError, setAuthError] = useState<AuthErrorKind | null>(null);

  const retry = () => router.push('/login');

  useEffect(() => {
    if (hasHandledCallback.current) {
      return;
    }
    hasHandledCallback.current = true;

    if (isSessionValid()) {
      router.push('/');
      return;
    }

    if (error) {
      setAuthError('declined');
      return;
    }

    if (!code) {
      setAuthError('incomplete');
      return;
    }

    const storedState = sessionStorage.getItem('oauth_state');
    if (!state || !storedState || state !== storedState) {
      setAuthError('unverifiable');
      return;
    }
    sessionStorage.removeItem('oauth_state');

    const redirect_uri = sessionStorage.getItem('oauth_redirect_uri') ?? getRedirectUrl();
    sessionStorage.removeItem('oauth_redirect_uri');

    fetch(POST_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri }),
    })
      .then(async (response) => {
        if (response.status !== 200) {
          setAuthError('exchange_failed');
          return;
        }
        const data = await response.json();
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const expiresAt = currentTimestamp + data.expires_in;
        sessionStorage.setItem('token_expiry', String(expiresAt));
        router.push('/');
      })
      .catch(() => {
        setAuthError('exchange_failed');
      });
  }, []);

  if (authError) {
    return (
      <section className="auth-bg relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
        <article className="glass-surface relative w-full max-w-md rounded-3xl p-6 text-brand-body sm:p-8">
          <p className="mb-2 text-xs uppercase tracking-[0.28em] text-brand-label">I Wish Spotify Could</p>
          <h1 className="text-3xl font-bold leading-tight text-brand-heading sm:text-4xl">login failed</h1>
          <p role="alert" className="mt-3 text-sm leading-relaxed text-brand-muted sm:mt-4">
            {ERROR_MESSAGES[authError]}
          </p>
          <Button
            onClick={retry}
            size="lg"
            variant="brand"
            className="mt-8 h-12 w-full text-base font-semibold motion-reduce:transition-none"
          >
            Try again
          </Button>
        </article>
      </section>
    );
  }

  return <p>Loading...</p>;
};

export default CallBackClient;
