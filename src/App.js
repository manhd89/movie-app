// src/App.js (Ví dụ)
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import MovieDetail from './pages/MovieDetail';
import HistoryPage from './pages/HistoryPage'; // Import HistoryPage mới

function App() {
    const [showFilterModal, setShowFilterModal] = useState(false);

    const handleOpenFilterModal = () => setShowFilterModal(true);
    const handleCloseFilterModal = () => setShowFilterModal(false);

    return (
        <Router>
            <Routes>
                <Route
                    path="/"
                    element={
                        <Home
                            showFilterModal={showFilterModal}
                            onCloseFilterModal={handleCloseFilterModal}
                        />
                    }
                />
                <Route path="/movie/:slug" element={<MovieDetail />} />
                <Route path="/movie/:slug/:episodeSlug" element={<MovieDetail />} />
                <Route path="/history" element={<HistoryPage />} /> {/* Thêm Route mới cho HistoryPage */}
            </Routes>
        </Router>
    );
}

export default App;
