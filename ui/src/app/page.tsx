"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

const Landing: React.FC = () => {
  const router = useRouter();
  return (
    <section
      className="app-bg relative flex flex-1 items-center justify-center overflow-hidden px-6 py-10"
    >
      <article className="surface-panel relative z-10 w-full max-w-3xl rounded-3xl p-8 text-brand-body sm:p-10">
        <p className="mb-2 text-xs uppercase tracking-[0.28em] text-brand-label">I Wish Spotify Could</p>
        <h1 className="text-3xl font-bold leading-tight text-brand-heading sm:text-4xl">put your liked songs where they belong</h1>
        <p className="mt-4 text-sm leading-relaxed text-brand-muted sm:text-base">
            pick a tool below to get started.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div>
            <Button
              variant="brand"
              className="h-12 w-full text-base font-semibold"
              onClick={() => router.push('/organize')}
            >
              categorize songs
            </Button>
            <p className="mt-2 text-xs leading-relaxed text-brand-muted">
              sort liked songs that aren&apos;t in any playlist into the playlists you already have.
            </p>
          </div>
          <div>
            <Button
              variant="brandMuted"
              className="h-12 w-full text-base font-semibold"
              onClick={() => router.push('/clean')}
            >
              clean up playlists
            </Button>
            <p className="mt-2 text-xs leading-relaxed text-brand-muted">
              find songs you&apos;ve stopped listening to and remove them from a playlist.
            </p>
          </div>
          <div>
            <Button
              variant="brandMuted"
              className="h-12 w-full text-base font-semibold"
              onClick={() => router.push('/propagate')}
            >
              propagate songs
            </Button>
            <p className="mt-2 text-xs leading-relaxed text-brand-muted">
              add songs from one playlist into another that shares its genre or vibe.
            </p>
          </div>
        </div>
      </article>
    </section>
  );
};

export default Landing;
