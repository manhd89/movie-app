import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './Header.css';

function Header() {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigate = useNavigate();
  const searchContainerRef = useRef(null);
  const inputRef = useRef(null);

  // Gọi API để lấy gợi ý phim
  const fetchSuggestions = async (value) => {
    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const response = await axios.get(
        `https://phimapi.com/v1/api/tim-kiem?keyword=${encodeURIComponent(value)}`
      );
      const items = response.data.data?.items || [];
      setSuggestions(items.slice(0, 5)); // Giới hạn 5 gợi ý
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Xử lý khi nhập từ khóa
  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    fetchSuggestions(value);
  };

  // Xử lý tìm kiếm (Enter hoặc nút Tìm)
  const handleSearch = (e) => {
    e.preventDefault(); // Luôn ngăn chặn hành vi mặc định của form
    if (searchQuery.trim()) {
      // Lưu lịch sử tìm kiếm
      const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
      if (!history.includes(searchQuery)) {
        history.unshift(searchQuery);
        localStorage.setItem('searchHistory', JSON.stringify(history.slice(0, 5)));
      }
      navigate(`/?keyword=${encodeURIComponent(searchQuery)}&page=1`);
      setSearchQuery('');
    } else {
      navigate('/'); // Về trang chủ nếu không có từ khóa
    }
    // Đảm bảo ẩn và xóa gợi ý sau khi xử lý tìm kiếm
    setShowSuggestions(false);
    setSuggestions([]);
    // Ẩn bàn phím ảo
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  // Xử lý khi chọn gợi ý
  const handleSuggestionClick = (item) => {
    setSearchQuery('');
    setShowSuggestions(false);
    setSuggestions([]); // Clear suggestions after selection
    if (item.slug) {
      navigate(`/movie/${item.slug}`); // Chuyển đến Movie.js
    } else {
      // Lưu lại lịch sử nếu chọn từ khóa lịch sử
      const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
      if (!history.includes(item.name)) {
        history.unshift(item.name);
        localStorage.setItem('searchHistory', JSON.stringify(history.slice(0, 5)));
      }
      navigate(`/?keyword=${encodeURIComponent(item.name)}&page=1`);
    }
  };

  // Xóa một từ khóa trong lịch sử
  const handleRemoveHistoryItem = (keyword, e) => {
    e.stopPropagation();
    const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    const updatedHistory = history.filter((item) => item !== keyword);
    localStorage.setItem('searchHistory', JSON.stringify(updatedHistory));
    if (!searchQuery) {
      setSuggestions(
        updatedHistory.map((item, index) => ({
          _id: `history_${index}`,
          name: item,
          year: 'Lịch sử tìm kiếm',
        }))
      );
      setShowSuggestions(updatedHistory.length > 0);
    }
  };

  // Hiển thị lịch sử tìm kiếm khi focus
  const handleInputFocus = () => {
    if (!searchQuery) {
      const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
      if (history.length) {
        setSuggestions(
          history.map((item, index) => ({
            _id: `history_${index}`,
            name: item,
            year: 'Lịch sử tìm kiếm',
          }))
        );
        setShowSuggestions(true);
      }
    }
  };

  // Xử lý phím Enter
  const handleKeyDown = (e) => {
    // Check for common "submit" keys on mobile keyboards
    if (e.key === 'Enter' || e.key === 'Done' || e.key === 'Go' || e.key === 'Search') {
      e.preventDefault();
      handleSearch(e); // Gọi handleSearch để đóng gợi ý và xử lý tìm kiếm
    }
  };

  // Ẩn gợi ý khi nhấp ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSuggestions(false);
        setSuggestions([]); // Clear suggestions when clicking outside
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="header">
      <Link to="/" className="logo">
        PhimAPI
      </Link>
      <div className="search-container" ref={searchContainerRef}>
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="search"
            inputMode="search"
            ref={inputRef}
            value={searchQuery}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            placeholder="Tìm kiếm phim..."
            className="search-input"
            autoComplete="off"
          />
          <button
            type="submit" // Vẫn giữ type="submit" để có thể nhấn Enter trong input
            className="search-button"
            // Thêm onClick để đảm bảo hàm xử lý được gọi ngay lập tức
            onClick={handleSearch}
          >
            Tìm
          </button>
        </form>
        {showSuggestions && suggestions.length > 0 && (
          <ul className="suggestions-list">
            {suggestions.map((item) => (
              <li
                key={item._id}
                className="suggestion-item"
                onClick={() => handleSuggestionClick(item)}
              >
                {item.slug && (
                  <img
                    src={`https://phimimg.com/${item.thumb_url}`}
                    alt={item.name}
                    className="suggestion-thumb"
                    onError={(e) => (e.target.src = '/placeholder.jpg')}
                  />
                )}
                <div className="suggestion-info">
                  <span className="suggestion-title">{item.name}</span>
                  <span className="suggestion-year">{item.year}</span>
                </div>
                {!item.slug && (
                  <button
                    className="remove-history-button"
                    onClick={(e) => handleRemoveHistoryItem(item.name, e)}
                  >
                    X
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <nav>
        <Link to="/">Trang chủ</Link>
      </nav>
    </header>
  );
}

export default Header;
