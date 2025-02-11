import React from 'react';
import { Button } from "@/components/ui/button"
import Row from "@/components/ui/Row"
// import 'tailwindcss/tailwind.css'

const Landing: React.FC = () => {
    return (
        <>
            <Row className="justify-center bg-red-500">
                <Button>yeet!</Button>
            </Row>
            <Row>
                <Button>yeety!</Button>
            </Row>
        </>
    );
};

export default Landing;