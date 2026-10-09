import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import VideoBackground from '../components/VideoBackground';
import { ScrambleIn } from '../components/ScrambleText';
import { features, VIDEO_URLS } from '../data/features';

const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 25 },
    whileInView: { opacity: 1, y: 0 },
    transition: { duration: 0.9, delay, ease: [0.215, 0.610, 0.355, 1.000] },
    viewport: { once: true, amount: 0.3 },
});

const METRICS = [
    { value: '< 3s', label: 'Failure Detection' },
    { value: '≥ 50%', label: 'Route Flap Reduction' },
    { value: 'SHA-256', label: 'Transfer Integrity' },
    { value: '≤ 10%', label: 'Emulation Error' },
    { value: '5×', label: 'Repeatability Runs' },
    { value: '0', label: 'Cloud Dependencies' },
];

function HeroSection() {
    const [show, setShow] = useState(false);
    useEffect(() => { const t = setTimeout(() => setShow(true), 800); return () => clearTimeout(t); }, []);

    return (
        <section className="relative h-screen min-h-[600px] flex flex-col">
            <VideoBackground src={VIDEO_URLS.hero} scrub overlay="bg-black/20" />
            {/* Dot grid */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.05]"
                style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ paddingTop: '50px' }}>
                <span className="uppercase tracking-[-4px] opacity-[0.10] select-none"
                    style={{
                        fontFamily: '"Anton SC", sans-serif',
                        fontSize: 'clamp(120px, 30vw, 521px)',
                        background: 'radial-gradient(circle, rgba(142,127,148,0) 0%, #8E7F94 70%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}>
                    RESILIENCE
                </span>
            </div>

            {/* Content */}
            <motion.div
                className="relative z-10 flex-1 flex flex-col px-4 sm:px-6 md:px-8 pt-20 sm:pt-24 pb-8 sm:pb-12"
                initial={{ opacity: 0 }}
                animate={{ opacity: show ? 1 : 0 }}
                transition={{ duration: 1 }}
            >
                <div className="flex-1" />
                <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="font-light leading-[0.95] tracking-[-0.03em]" style={{ fontSize: 'clamp(40px, 10vw, 100px)' }}>
                            <ScrambleIn text="Self-Healing" delay={200} /><br />
                            <ScrambleIn text="Networks" delay={500} />
                        </h1>
                        <motion.p {...fadeUp(0.2)} className="max-w-sm text-[13px] sm:text-[15px] text-white/60 mt-4 leading-relaxed">
                            A software-defined overlay that recovers from node failure, schedules multipath transfers with research-proven algorithms, and emulates real network conditions using the Linux kernel.
                        </motion.p>
                    </div>
                    <h1 className="font-light leading-[0.95] tracking-[-0.03em] md:text-right" style={{ fontSize: 'clamp(40px, 10vw, 100px)' }}>
                        <ScrambleIn text="One" delay={700} /><br />
                        <ScrambleIn text="System" delay={1000} />
                    </h1>
                </div>
            </motion.div>
        </section>
    );
}

function CinematicSection() {
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
    const yValue = useTransform(scrollYProgress, [0, 1], [60, -120]);
    const opacity = useTransform(scrollYProgress, [0.2, 0.4], [0, 1]);

    return (
        <section ref={ref} className="relative min-h-screen flex items-center justify-center">
            <VideoBackground src={VIDEO_URLS.cinematic} overlay="bg-black/50" />
            <div className="absolute top-0 left-0 right-0 h-[180px] z-10"
                style={{ background: 'linear-gradient(to bottom, #010103, transparent)' }} />
            <motion.div className="relative z-20 max-w-5xl px-6 sm:px-12 text-center" style={{ y: yValue, opacity, perspective: 400 }}>
                <p className="text-[22px] sm:text-[30px] md:text-[36px] lg:text-[42px] leading-[1.35] tracking-[-0.02em] select-none font-light">
                    A network resilience platform built on peer-reviewed research. NetRescue translates routing instability into measurable recovery. Every heartbeat, every chunk, every failure becomes observable. The system continuously rebuilds forwarding state as topology changes. Biological noise is replaced by kernel-level truth.
                </p>
            </motion.div>
        </section>
    );
}

function MetricsSection() {
    return (
        <section id="metrics" className="relative min-h-screen flex flex-col items-center justify-center py-20">
            <VideoBackground src={VIDEO_URLS.metrics} overlay="bg-black/60" />
            <motion.p className="relative z-10 text-white/40 text-[13px] sm:text-[14px] tracking-[0.2em] uppercase mb-20 text-center"
                initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ duration: 1.2 }} viewport={{ once: true, amount: 0.3 }}>
                Measured Outcomes
            </motion.p>
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-8 max-w-5xl px-8 w-full">
                {METRICS.map((m, i) => (
                    <motion.div key={m.label}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: i * 0.15 }}
                        viewport={{ once: true, amount: 0.3 }}
                        className="text-center"
                    >
                        <div className="font-light tracking-[-0.04em] leading-none" style={{ fontSize: 'clamp(48px, 10vw, 96px)' }}>
                            {m.value}
                        </div>
                        <div className="text-white/40 text-[13px] sm:text-[15px] mt-4">{m.label}</div>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}

function FeaturesGrid() {
    return (
        <section className="relative min-h-screen flex flex-col justify-center py-20">
            <VideoBackground src={VIDEO_URLS.features} overlay="bg-black/60" />
            <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 md:px-8 w-full">
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6 mb-16">
                    <motion.h2 {...fadeUp()} className="font-light leading-[0.95] tracking-[-0.03em]" style={{ fontSize: 'clamp(36px, 8vw, 72px)' }}>
                        Three<br />Features
                    </motion.h2>
                    <motion.p {...fadeUp(0.1)} className="text-white/50 max-w-xs md:text-right md:pt-2 text-[14px] leading-relaxed">
                        Each feature is independently demonstrable, backed by peer-reviewed algorithms, and validated under Linux tc/netem emulation. Click any card to open its full specification.
                    </motion.p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
                    {features.map((f, i) => (
                        <motion.div key={f.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, delay: 0.3 + i * 0.1 }}
                            viewport={{ once: true, amount: 0.3 }}
                        >
                            <Link
                                to={`/features/${f.id}`}
                                className="group block border border-white/10 rounded-lg p-6 h-full text-left transition-all hover:bg-white/[0.03] hover:border-white/25 hover:-translate-y-0.5 focus-visible:outline outline-1 outline-white/40"
                            >
                                <h3 className="text-[14px] sm:text-[16px] mb-2">{f.title}</h3>
                                <p className="text-white/40 text-[12px] sm:text-[14px] leading-relaxed">{f.tagline}</p>
                                <div className="mt-3 text-white/30 group-hover:text-white/60 transition-colors text-[12px]">
                                    →
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function ArchitectureSection() {
    const layers = [
        { label: 'LAYER 01', desc: 'Control Plane' },
        { label: 'LAYER 02', desc: 'Forwarding Plane' },
        { label: 'LAYER 03', desc: 'Kernel Emulation' },
    ];

    return (
        <section id="architecture" className="min-h-screen flex items-center justify-center bg-black py-32">
            <div className="max-w-3xl px-6 text-center">
                <motion.p {...fadeUp()} className="text-white/40 tracking-[0.2em] uppercase mb-8 text-[13px]">
                    Architecture
                </motion.p>
                <motion.h2 {...fadeUp(0.1)} className="font-light leading-[1.15] tracking-[-0.02em] mb-10"
                    style={{ fontSize: 'clamp(28px, 6vw, 56px)' }}>
                    Three layers. Zero cloud.
                </motion.h2>
                <motion.p {...fadeUp(0.2)} className="text-white/45 text-[15px] sm:text-[17px] leading-relaxed max-w-xl mx-auto mb-12">
                    Control plane decides. Forwarding plane moves. Emulation lives in the Linux kernel. PostgreSQL persists everything the run produces.
                </motion.p>
                <motion.div className="flex flex-col gap-4 items-center"
                    initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ duration: 1.2, delay: 0.4 }} viewport={{ once: true, amount: 0.4 }}>
                    {layers.map(l => (
                        <div key={l.label} className="max-w-md w-full h-[72px] border border-white/10 rounded-lg flex items-center justify-between px-6">
                            <span className="text-white/30 text-[13px] tracking-[0.2em]">{l.label}</span>
                            <span className="text-white/70 text-[14px]">{l.desc}</span>
                        </div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}

export default function LandingPage() {
    useEffect(() => { document.title = 'NetRescue — Self-Healing Networks'; }, []);
    return (
        <motion.main initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26, duration: 0.35 }}>
            <HeroSection />
            <CinematicSection />
            <MetricsSection />
            <FeaturesGrid />
            <ArchitectureSection />
        </motion.main>
    );
}
