import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { CurriculumProvider } from './context/CurriculumContext';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import RoadmapPage from './pages/RoadmapPage';
import UploadPage from './pages/UploadPage';
import CurriculumPage from './pages/CurriculumPage';
import ResultsPage from './pages/ResultsPage';
import LearnSessionPage from './pages/LearnSessionPage';
import CoachSetupPage from './pages/CoachSetupPage';
import AvatarBuilderPage from './pages/AvatarBuilderPage';
import App from './App'; // Diagnostic test (original)

import './index.css';

/**
 * APEX App Router
 * 
 * Flow:
 * / (login) → /roadmap → /diagnostic (original App) → /results → /roadmap (unlocked)
 *   /signup ↗            → /upload → /curriculum
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CurriculumProvider>
        <Routes>
          {/* Auth */}
          <Route path="/" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Main Pages */}
          <Route path="/roadmap" element={<RoadmapPage />} />
          <Route path="/coach-setup" element={<CoachSetupPage />} />
          <Route path="/avatar-builder" element={<AvatarBuilderPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/curriculum" element={<CurriculumPage />} />
          <Route path="/results" element={<ResultsPage />} />

          {/* Diagnostic Test (original APEX Diagnostic app) */}
          <Route path="/diagnostic" element={<App />} />
          <Route path="/learn" element={<LearnSessionPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </CurriculumProvider>
    </BrowserRouter>
  </StrictMode>,
);
