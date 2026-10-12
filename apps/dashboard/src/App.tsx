import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import FeaturesIndexPage from './pages/FeaturesIndexPage';
import FeatureDetailPage from './pages/FeatureDetailPage';
import HysteresisPlaygroundPage from './pages/HysteresisPlaygroundPage';
import MultipathPlaygroundPage from './pages/MultipathPlaygroundPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
    return (
        <Routes>
            <Route element={<Layout />}>
                <Route path="/" element={<LandingPage />} />
                <Route path="/features" element={<FeaturesIndexPage />} />
                {/* Feature A's workbench. Declared before the `:id` route so the
                    static segment wins — `/features/hysteresis/playground` is
                    not a feature called "hysteresis" with a stray segment. */}
                <Route path="/features/hysteresis/playground" element={<HysteresisPlaygroundPage />} />
                <Route path="/features/multipath/playground" element={<MultipathPlaygroundPage />} />
                <Route path="/features/:id" element={<FeatureDetailPage />} />
                <Route path="*" element={<NotFoundPage />} />
            </Route>
        </Routes>
    );
}
