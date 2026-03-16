"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

const Landing: React.FC = () => {
  const router = useRouter();
  return (
    <section
      className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-10"
    >
      <article className="glass-surface relative z-10 w-full max-w-2xl rounded-3xl p-8 text-brand-body sm:p-10">
        <p className="mb-2 text-xs uppercase tracking-[0.28em] text-brand-label">I Wish Spotify Could</p>
        <h1 className="text-3xl font-bold leading-tight text-brand-heading sm:text-4xl">do the following</h1>
        <p className="mt-4 text-sm leading-relaxed text-brand-muted sm:text-base">
            try out what&apos;s available!
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Button
            className="btn-brand-primary h-12 text-base font-semibold"
            onClick={() => router.push('/organize')}
          >
            categorize songs
          </Button>
          <Button
            disabled
            className="btn-brand-muted h-12 text-base font-semibold"
          >
            coming soon...
          </Button>
        </div>
      </article>
    </section>
  );
};

export default Landing;
