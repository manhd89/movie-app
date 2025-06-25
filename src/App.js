import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import Header from './components/Header';
import Home from './pages/Home';
import MovieDetail from './pages/MovieDetail';
import HistoryPage from './pages/HistoryPage'; // Import HistoryPage
import './App.css';

function App() {
  const [showFilterModal, setShowFilterModal] = useState(false); // State để quản lý hiển thị modal lọc

  const handleOpenFilterModal = () => {
    setShowFilterModal(true);
  };

  const handleCloseFilterModal = () => {
    setShowFilterModal(false);
  };

  // Hàm xử lý tìm kiếm (nếu bạn có thanh tìm kiếm trong Header)
  const handleSearch = (keyword) => {
    // Điều hướng đến trang chủ với tham số tìm kiếm
    window.location.href = `/?keyword=${encodeURIComponent(keyword)}`;
  };

  return (
    <BrowserRouter>
      <div className="app">
        {/* Truyền hàm mở modal lọc và hàm tìm kiếm xuống Header */}
        <Header
          onOpenFilters={handleOpenFilterModal}
          onSearch={handleSearch} // Truyền prop onSearch xuống Header
        />
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
          {/* Route cho trang chi tiết phim có/không có episode slug */}
          <Route path="/movie/:slug" element={<MovieDetail />} />
          <Route path="/movie/:slug/:episodeSlug" element={<MovieDetail />} />

          {/* Route cho trang lịch sử xem */}
          <Route path="/history" element={<HistoryPage />} />

          {/* Đã loại bỏ Route catch-all cho 404 page */}
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
