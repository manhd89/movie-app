// src/App.js

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import Header from './components/Header';
import Home from './pages/Home';
import MovieDetail from './pages/MovieDetail';
import HistoryPage from './pages/HistoryPage'; // Import HistoryPage
import Footer from './components/Footer'; // Import Footer
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
        <main className="main-content"> {/* Thêm thẻ main để bao bọc nội dung chính */}
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
            {/* Route cho chi tiết phim và tập phim */}
            <Route path="/movie/:slug" element={<MovieDetail />} />
            <Route path="/movie/:slug/:episodeSlug" element={<MovieDetail />} />
            {/* Route cho trang lịch sử xem */}
            <Route path="/history" element={<HistoryPage />} />
            {/* Route 404 - Not Found */}
            <Route path="*" element={<h2>404 - Trang không tìm thấy</h2>} />
          </Routes>
        </main>
        <Footer /> {/* Thêm Footer */}
      </div>
    </BrowserRouter>
  );
}

export default App;
