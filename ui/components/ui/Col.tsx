import { ReactNode } from "react";

interface ColProps {
  children: ReactNode;
  size?: string; // Example: "w-1/2" or "w-full"
  className?: string;
}

export default function Col({ children, size = "w-full", className = "" }: ColProps) {
  return <div className={`${size} ${className}`}>{children}</div>;
}