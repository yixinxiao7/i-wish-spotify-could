"use client";

import React from 'react';
import { Button } from "@/components/ui/button"
import { useRouter } from 'next/navigation'

const Landing: React.FC = () => {
    const router = useRouter();
    return (
        <div className="h-screen flex items-center justify-center bg-gradient-to-r from-purple-900 to-blue-900">
            <div className="flex gap-12 flex-col sm:flex-row">
                <Button 
                    className="px-8 py-6 text-lg hover:scale-105 transition-transform bg-[#1DB954] text-black hover:bg-[#1ed760] border-none"
                    onClick={() => router.push('/organize')}
                >
                    Categorize Songs
                </Button>
                <Button 
                    className="px-8 py-6 text-lg hover:scale-105 transition-transform bg-[#1DB954] text-black hover:bg-[#1ed760] border-none"
                >
                    yeety!
                </Button>
            </div>
        </div>
    );
};

export default Landing;