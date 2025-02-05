import React from 'react';
import { useEffect } from "react";
import { useRouter } from "next/router";

const Callback = () => {
    const router = useRouter();
  
    useEffect(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
  
      if (code) {
        // Store the code (or exchange it for a token)
        localStorage.setItem("spotify_auth_code", code);
  
        // Redirect to landing
        router.push("/landing");
      } else {
        // If there's no code, redirect to login page
        router.push("/");
      }
    }, []);
};

export default Callback;