"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

const Landing: React.FC = () => {
  const router = useRouter();
  return (
    <section
      className="relative isolate flex flex-1 items-center justify-center overflow-hidden px-6 py-10"
    >
      <article className="relative z-10 w-full max-w-2xl rounded-3xl border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.85),rgba(245,255,248,0.7))] p-8 text-slate-800 shadow-[0_25px_80px_rgba(19,72,96,0.35)] backdrop-blur-md sm:p-10">
        <p className="mb-2 text-xs uppercase tracking-[0.28em] text-emerald-700/90">I Wish Spotify Could</p>
        <h1 className="text-3xl font-bold leading-tight text-[#185a57] sm:text-4xl">do the following</h1>
        <p className="mt-4 text-sm leading-relaxed text-[#2a4d52] sm:text-base">
            try out what's available!
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Button
            className="h-12 rounded-full border border-white/90 bg-[linear-gradient(90deg,#3fd15a,#5bc6f5)] text-base font-semibold text-[#033524] shadow-lg transition hover:scale-[1.01] hover:brightness-105"
            onClick={() => router.push('/organize')}
          >
            categorize songs
          </Button>
          <Button
            className="h-12 rounded-full border border-[#8bcbe3]/70 bg-[linear-gradient(90deg,rgba(255,255,255,0.85),rgba(226,249,255,0.9))] text-base font-semibold text-[#1f5f69] shadow-lg transition hover:scale-[1.01] hover:brightness-105"
          >
            coming soon...
          </Button>
        </div>
      </article>
    </section>
  );
};

export default Landing;
