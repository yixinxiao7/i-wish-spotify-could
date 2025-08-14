"use client";

import React from 'react';
import { Button } from "@/components/ui/button"
import { useRouter } from 'next/navigation'

const Landing: React.FC = () => {
    const router = useRouter();
    return (
        <div>
            <Button onClick={() => router.push('/organize')}>Categorize Songs</Button>
            <Button>yeety!</Button>
        </div>
    );
};

export default Landing;