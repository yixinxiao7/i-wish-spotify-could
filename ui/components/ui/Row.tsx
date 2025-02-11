import { ReactNode } from "react";

interface RowProps {
  children: ReactNode;
  className?: string;
}

export default function Row({ children, className = "" }: RowProps) {
  return <div className={`flex flex-row flex-wrap gap-4 ${className}`}>{children}</div>;
}
