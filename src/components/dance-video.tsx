"use client";

import Image from "next/image";
import { useState } from "react";

type DanceVideoProps = {
  src: string;
  poster: string;
  label: string;
};

// El <video> no se monta hasta que se pulsa play: la página no descarga nada del video al cargar.
export function DanceVideo({ src, poster, label }: DanceVideoProps) {
  const [started, setStarted] = useState(false);

  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl border border-white/10 bg-card">
      {started ? (
        <video
          src={src}
          controls
          autoPlay
          playsInline
          className="h-full w-full object-cover"
        />
      ) : (
        <button
          type="button"
          onClick={() => setStarted(true)}
          aria-label={`Reproducir video: ${label}`}
          className="group absolute inset-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold"
        >
          <Image
            src={poster}
            alt=""
            fill
            sizes="(min-width: 1024px) 288px, 320px"
            className="object-cover"
          />
          <span className="absolute top-1/2 left-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gold text-[#1a1408] shadow-lg transition group-hover:scale-105 group-hover:bg-gold-soft">
            <svg aria-hidden viewBox="0 0 24 24" className="ml-1 h-7 w-7 fill-current">
              <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
