// src/App.js

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import MovieDetail from './pages/MovieDetail';
import HistoryPage from './pages/HistoryPage';
import './App.css';

function App() {
  const [showFilterModal, setShowFilterModal] = useState(false);

  const handleOpenFilterModal = () => {
    setShowFilterModal(true);
  };

  const handleCloseFilterModal = () => {
    setShowFilterModal(false);
  };

  return (
    <BrowserRouter>
      <div className="app">
        {/* Header được đặt ở đây để hiển thị trên tất cả các trang */}
        <Header onOpenFilters={handleOpenFilterModal} />
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
          <Route path="/history" element={<HistoryPage />} /> {/* <--- Thêm Route này */}
        </Routes>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
