import React, { useState, useEffect, useRef, useCallback } from 'react';

interface ScrambleTextProps {
    text: string;
    className?: string;
}

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&';

export function ScrambleText({ text, className = '' }: ScrambleTextProps) {
    const [display, setDisplay] = useState(text);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const scramble = useCallback(() => {
        let iteration = 0;
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
            setDisplay(
                text
                    .split('')
                    .map((char, i) => {
                        if (char === ' ') return ' ';
                        if (i < iteration) return text[i];
                        return CHARS[Math.floor(Math.random() * CHARS.length)];
                    })
                    .join('')
            );
            iteration += 1 / 4;
            if (iteration >= text.length) {
                if (intervalRef.current) clearInterval(intervalRef.current);
                setDisplay(text);
            }
        }, 30);
    }, [text]);

    const reset = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setDisplay(text);
    }, [text]);

    useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

    return (
        <span
            className={className}
            onMouseEnter={scramble}
            onMouseLeave={reset}
            style={{ cursor: 'default' }}
        >
            {display}
        </span>
    );
}

interface ScrambleInProps {
    text: string;
    className?: string;
    delay?: number;
}

export function ScrambleIn({ text, className = '', delay = 0 }: ScrambleInProps) {
    const [display, setDisplay] = useState<string>('');
    const [started, setStarted] = useState(false);
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const timer = setTimeout(() => setStarted(true), delay);
        return () => clearTimeout(timer);
    }, [delay]);

    useEffect(() => {
        if (!started) return;
        let iteration = 0;
        const interval = setInterval(() => {
            setDisplay(
                text
                    .split('')
                    .map((char, i) => {
                        if (char === ' ') return ' ';
                        if (i < iteration) return text[i];
                        if (i < iteration + 3) return CHARS[Math.floor(Math.random() * CHARS.length)];
                        return '\u00A0';
                    })
                    .join('')
            );
            iteration += 0.5;
            if (iteration >= text.length) {
                clearInterval(interval);
                setDisplay(text);
            }
        }, 25);
        return () => clearInterval(interval);
    }, [started, text]);

    return (
        <span ref={ref} className={className}>
            {started ? display : '\u00A0'.repeat(text.length)}
        </span>
    );
}
