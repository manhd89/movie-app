// src/App.js

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import Header from './components/Header';
import Home from './pages/Home';
import MovieDetail from './pages/MovieDetail';
import HistoryPage from './pages/HistoryPage';
import FilterMenu from './components/FilterMenu'; // Import FilterMenu
import Footer from './components/Footer';
import './App.css';

function App() {
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false); // Renamed state for clarity

  const handleOpenFilterMenu = () => { // Renamed handler
    setIsFilterMenuOpen(true);
  };

  const handleCloseFilterMenu = () => { // Renamed handler
    setIsFilterMenuOpen(false);
  };

  return (
    <BrowserRouter>
      <div className="app">
        {/* Header is placed here to be visible on all pages */}
        <Header onOpenFilterMenu={handleOpenFilterMenu} /> {/* Pass the new handler */}

        {/* FilterMenu component, controlled by its own state */}
        <FilterMenu isOpen={isFilterMenuOpen} onClose={handleCloseFilterMenu} />

        <main className="main-content">
          <Routes>
            <Route
              path="/"
              // Home component no longer receives filter modal props
              element={<Home />}
            />
            {/* Routes for movie detail and episode */}
            <Route path="/movie/:slug" element={<MovieDetail />} />
            <Route path="/movie/:slug/:episodeSlug" element={<MovieDetail />} />
            {/* Route for the dedicated history page */}
            <Route path="/history" element={<HistoryPage />} />
            {/* 404 - Not Found Route */}
            <Route path="*" element={<h2 style={{color: '#fff', textAlign: 'center', marginTop: '50px'}}>404 - Trang không tìm thấy</h2>} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
