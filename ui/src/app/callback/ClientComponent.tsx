'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const CallBackClient = (expires_in) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const router = useRouter();

    useEffect(() => {
      if (expires_in) {
        const currentTimestamp = Math.floor(Date.now() / 1000)
        const expiresAt = currentTimestamp + expires_in
        sessionStorage.setItem('token_expiry', expiresAt);
        setIsAuthenticated(true);
      } else {
        router.push("/login")
      }
    }, [expires_in]);
  
    if (!isAuthenticated) {
      return <p>Loading...</p>;
    }
    
    router.push("/")
  }

export default CallBackClient