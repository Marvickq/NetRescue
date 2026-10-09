import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navbar from './Navbar';
import Footer from './Footer';

function ScrollToTop() {
    const { pathname } = useLocation();
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);
    return null;
}

export default function Layout() {
    const location = useLocation();
    return (
        <>
            <ScrollToTop />
            <Navbar />
            <AnimatePresence mode="wait">
                <Outlet key={location.pathname} />
            </AnimatePresence>
            <Footer />
        </>
    );
}
