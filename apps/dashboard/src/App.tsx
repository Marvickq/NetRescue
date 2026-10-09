import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import FeaturesIndexPage from './pages/FeaturesIndexPage';
import FeatureDetailPage from './pages/FeatureDetailPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
    return (
        <Routes>
            <Route element={<Layout />}>
                <Route path="/" element={<LandingPage />} />
                <Route path="/features" element={<FeaturesIndexPage />} />
                <Route path="/features/:id" element={<FeatureDetailPage />} />
                <Route path="*" element={<NotFoundPage />} />
            </Route>
        </Routes>
    );
}
