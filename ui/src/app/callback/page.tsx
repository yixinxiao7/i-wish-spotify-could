'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const Callback = () => {
    const router = useRouter();
    console.log("Callback page loaded");
    useEffect(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      console.log(code)
      if (code) {
        // Store the code (or exchange it for a token)
        localStorage.setItem("spotify_auth_code", code);
  
        // Redirect to landing
        router.push("/");
      } else {
        // If there's no code, redirect to login page
        router.push("/login");
      }
    }, []);
};

export default Callback;