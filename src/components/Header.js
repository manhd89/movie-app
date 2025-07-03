import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import './Header.css';
import { FaBars, FaSearch, FaTimes } from 'react-icons/fa';

// --- Constants ---
// Use environment variables for API URLs
const V1_API_URL = `${process.env.REACT_APP_API_URL}/v1/api`;
const CDN_IMAGE_URL = process.env.REACT_APP_API_CDN_IMAGE;

function Header({ onOpenFilters }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false); // NEW: State to control visibility of the search bar
  const navigate = useNavigate();
  const searchContainerRef = useRef(null);
  const inputRef = useRef(null);

  // Hàm để làm sạch và đóng tất cả liên quan đến tìm kiếm
  const clearSearchAndHideSearchBar = useCallback(() => {
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setShowSearchBar(false); // NEW: Hide the search bar itself
    if (inputRef.current) {
      inputRef.current.blur(); // Đảm bảo ẩn bàn phím ảo
    }
  }, []); // Không có dependencies vì nó chỉ reset trạng thái

  // Toggle search bar visibility
  const toggleSearchBar = () => {
    if (showSearchBar) {
      clearSearchAndHideSearchBar(); // Hide and clear if currently visible
    } else {
      setShowSearchBar(true); // Show the search bar
      // Optional: Focus the input field after showing
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 0);
    }
  };

  // Gọi API để lấy gợi ý phim
  const fetchSuggestions = async (value) => {
    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      // Use V1_API_URL for search
      const response = await axios.get(
        `${V1_API_URL}/tim-kiem?keyword=${encodeURIComponent(value)}`
      );
      const items = response.data.data?.items || [];
      setSuggestions(items.slice(0, 5));
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
    e.preventDefault();

    if (searchQuery.trim()) {
      const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
      if (!history.includes(searchQuery)) {
        history.unshift(searchQuery);
        localStorage.setItem('searchHistory', JSON.stringify(history.slice(0, 5)));
      }
      navigate(`/?keyword=${encodeURIComponent(searchQuery)}&page=1`);
    } else {
      navigate('/');
    }
    // Sau khi tìm kiếm hoặc navigate, đóng và làm sạch search bar
    clearSearchAndHideSearchBar();
  };

  // Xử lý khi chọn gợi ý
  const handleSuggestionClick = (item) => {
    if (item.slug) {
      navigate(`/movie/${item.slug}`);
    } else {
      const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
      if (!history.includes(item.name)) {
        history.unshift(item.name);
        localStorage.setItem('searchHistory', JSON.stringify(history.slice(0, 5)));
      }
      navigate(`/?keyword=${encodeURIComponent(item.name)}&page=1`);
    }
    // Sau khi chọn gợi ý, đóng và làm sạch search bar
    clearSearchAndHideSearchBar();
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

  // Hiển thị lịch sử tìm kiếm khi focus vào input và không có query
  const handleInputFocus = () => {
    if (searchQuery === '') {
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
    if (e.key === 'Enter' || e.key === 'Done' || e.key === 'Go' || e.key === 'Search') {
      e.preventDefault();
      handleSearch(e);
    }
  };

  // Ẩn search bar và gợi ý khi nhấp ra ngoài search container
  useEffect(() => {
    const handleClickOutside = (event) => {
      // If the search bar is shown and the click is outside the search container AND not on the search toggle button
      if (
        showSearchBar &&
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target) &&
        !event.target.closest('.search-toggle-button') // Exclude the toggle button itself
      ) {
        clearSearchAndHideSearchBar();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearchBar, clearSearchAndHideSearchBar]);

  return (
    <header className="header">
      <Link to="/" className="logo">
        Phim Online
      </Link>

      {/* NEW: Search toggle button */}
      <button className="search-toggle-button" onClick={toggleSearchBar}>
        {showSearchBar ? <FaTimes /> : <FaSearch />} {/* Show X icon when search bar is open */}
      </button>

      {/* Search container, only render if showSearchBar is true */}
      {showSearchBar && (
        <div className="search-container active" ref={searchContainerRef}> {/* Add 'active' class */}
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
            {/* Removed the 'Tìm' button, as the toggle button now handles opening/closing and Enter key handles submission */}
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
                      src={`${CDN_IMAGE_URL}/${item.thumb_url}`} // Use CDN_IMAGE_URL here
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
      )}

      {/* Hamburger menu button */}
      <button className="hamburger-menu" onClick={onOpenFilters}>
        <FaBars />
      </button>
    </header>
  );
}

export default Header;
