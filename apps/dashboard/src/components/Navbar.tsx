import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import NetRescueLogo from './NetRescueLogo';
import { ScrambleText } from './ScrambleText';

const spring = { stiffness: 350, damping: 28 };

export default function Navbar() {
    const [menuOpen, setMenuOpen] = useState(false);
    const navigate = useNavigate();

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 h-20 flex items-center justify-between px-4 sm:px-6 md:px-8">
            {/* Left: Logo pill + Nav pill */}
            <div className="flex items-center gap-2">
                {/* Logo pill */}
                <Link
                    to="/"
                    className="h-12 px-5 flex items-center gap-2 rounded-[14px] transition-transform hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: 'var(--pill-bg)', backdropFilter: 'blur(12px)' }}
                >
                    <NetRescueLogo size={18} />
                    <span className="text-[16px] font-medium">NetRescue</span>
                </Link>

                {/* Expanding menu pill — desktop */}
                <motion.div
                    className="hidden md:flex items-center overflow-hidden rounded-[14px] h-12"
                    style={{ background: 'var(--pill-bg)', backdropFilter: 'blur(12px)' }}
                    initial={{ width: 48 }}
                    animate={{ width: menuOpen ? 290 : 48 }}
                    transition={{ type: 'spring', ...spring }}
                    onMouseEnter={() => setMenuOpen(true)}
                    onMouseLeave={() => setMenuOpen(false)}
                >
                    <button className="w-12 h-12 flex items-center justify-center flex-shrink-0" aria-label="Menu">
                        <div className="w-[18px] h-[12px] flex flex-col justify-between">
                            <span className="block w-full h-[1.5px] bg-white transition-transform" />
                            <span className="block w-full h-[1.5px] bg-white transition-opacity" />
                            <span className="block w-full h-[1.5px] bg-white transition-transform" />
                        </div>
                    </button>
                    <AnimatePresence>
                        {menuOpen && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-6 px-4 text-[14px] whitespace-nowrap"
                            >
                                <Link to="/features" className="hover:text-white/70 transition-colors">
                                    <ScrambleText text="Features" />
                                </Link>
                                <a href="/#metrics" className="hover:text-white/70 transition-colors">
                                    <ScrambleText text="Metrics" />
                                </a>
                                <a href="/#architecture" className="hover:text-white/70 transition-colors">
                                    <ScrambleText text="Architecture" />
                                </a>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Mobile nav */}
                <button
                    className="md:hidden h-9 w-9 flex items-center justify-center rounded-[10px]"
                    style={{ background: 'var(--pill-bg)' }}
                    onClick={() => setMenuOpen(!menuOpen)}
                    aria-label="Menu"
                >
                    <div className="w-[15px] h-[10px] flex flex-col justify-between">
                        <span className="block w-full h-[1.5px] bg-white" />
                        <span className="block w-full h-[1.5px] bg-white" />
                        <span className="block w-full h-[1.5px] bg-white" />
                    </div>
                </button>
            </div>

            {/* Right: Download button */}
            <motion.a
                href="#"
                className="h-12 sm:h-12 px-6 bg-white text-black rounded-full flex items-center gap-2 text-[14px] font-medium"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
            >
                <i className="bi bi-apple" />
                <ScrambleText text="Download" className="hidden sm:inline" />
            </motion.a>

            {/* Mobile drawer */}
            <AnimatePresence>
                {menuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="md:hidden absolute top-20 left-4 right-4 rounded-lg p-6 flex flex-col gap-4 text-[14px]"
                        style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)', border: '1px solid var(--border-subtle)' }}
                    >
                        <Link to="/features" onClick={() => setMenuOpen(false)} className="text-white/70 hover:text-white">Features</Link>
                        <a href="/#metrics" onClick={() => setMenuOpen(false)} className="text-white/70 hover:text-white">Metrics</a>
                        <a href="/#architecture" onClick={() => setMenuOpen(false)} className="text-white/70 hover:text-white">Architecture</a>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
}
