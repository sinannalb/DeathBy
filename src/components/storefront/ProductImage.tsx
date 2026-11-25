"use client";

import { useState } from "react";

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  priority?: boolean;
}

export function ProductImage({
  src,
  alt,
  className = "w-full h-full object-cover",
  priority = false,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        aria-label={alt}
        className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#2C1A12] via-[#3A2218] to-[#1D110C] text-[#E6C79C] select-none relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_30%_20%,#C68B3C,transparent_60%)]" />
        <span className="font-serif text-lg sm:text-xl font-bold tracking-[0.2em] text-[#F5E6D0] relative z-10">
          DBC
        </span>
        <span className="text-[9px] uppercase tracking-[0.18em] text-[#C68B3C] mt-0.5 relative z-10">
          Belçika Çikolatası
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
