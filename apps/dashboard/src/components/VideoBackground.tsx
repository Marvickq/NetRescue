import React, { useRef, useEffect } from 'react';

interface VideoBackgroundProps {
    src: string;
    className?: string;
    overlay?: string;
    scrub?: boolean;
}

export default function VideoBackground({
    src,
    className = '',
    overlay = 'bg-black/40',
    scrub = false,
}: VideoBackgroundProps) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (!scrub) return;
        const video = videoRef.current;
        if (!video) return;

        video.pause();

        const handleMouse = (e: MouseEvent) => {
            if (!video.duration) return;
            const x = e.clientX / window.innerWidth;
            const targetTime = x * video.duration * 0.8;
            video.currentTime = targetTime;
        };

        window.addEventListener('mousemove', handleMouse);
        return () => window.removeEventListener('mousemove', handleMouse);
    }, [scrub]);

    return (
        <div className={`absolute inset-0 overflow-hidden ${className}`}>
            <video
                ref={videoRef}
                src={src}
                className="w-full h-full object-cover"
                autoPlay={!scrub}
                loop={!scrub}
                muted
                playsInline
                preload="metadata"
                aria-hidden="true"
            />
            <div className={`absolute inset-0 ${overlay}`} />
        </div>
    );
}
