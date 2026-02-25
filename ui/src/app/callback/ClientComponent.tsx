'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const CallBackClient = ({ token_expires_in, state }: { token_expires_in: number | undefined, state: string | undefined }) => {
    const router = useRouter();
    const hasHandledCallback = useRef(false);

    useEffect(() => {
      if (hasHandledCallback.current) {
        return;
      }
      hasHandledCallback.current = true;

      const storedState = sessionStorage.getItem('oauth_state');
      if (!state || state !== storedState) {
        router.push("/login");
        return;
      }
      sessionStorage.removeItem('oauth_state');

      if (token_expires_in) {
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const expiresAt = currentTimestamp + token_expires_in;
        sessionStorage.setItem('token_expiry', String(expiresAt));
        router.push("/");
      } else {
        router.push("/login");
      }
    }, []);

    return <p>Loading...</p>;
  }

export default CallBackClient
