// src/components/Header.js

import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import './Header.css';
import { FaBars, FaSearch, FaTimes } from 'react-icons/fa';

// --- Constants ---
const V1_API_URL = `${process.env.REACT_APP_API_URL}/v1/api`;
const CDN_IMAGE_URL = process.env.REACT_APP_API_CDN_IMAGE;

function Header({ onOpenFilterMenu }) { // Renamed prop
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const navigate = useNavigate();
  const searchContainerRef = useRef(null);
  const inputRef = useRef(null);

  const clearSearchAndHideSearchBar = useCallback(() => {
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setShowSearchBar(false);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  }, []);

  const toggleSearchBar = () => {
    if (showSearchBar) {
      clearSearchAndHideSearchBar();
    } else {
      setShowSearchBar(true);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 0);
    }
  };

  // Using a ref for debounced function to ensure it doesn't change on re-renders
  const fetchSuggestionsRef = useRef();

  useEffect(() => {
    // Define the debounced function once
    fetchSuggestionsRef.current = debounce(async (value) => {
      if (value.trim().length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      try {
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
    }, 300); // 300ms debounce
  }, []); // Empty dependency array means this runs once on mount

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (value.trim() === '') {
      // If input is empty, show history
      const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
      if (history.length) {
        setSuggestions(
          history.map((item, index) => ({
            _id: `history_${index}`,
            name: item,
            year: 'Lịch sử tìm kiếm',
            isHistory: true // Flag to identify history items
          }))
        );
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } else {
      fetchSuggestionsRef.current(value); // Call the debounced function
    }
  };

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
    clearSearchAndHideSearchBar();
  };

  const handleSuggestionClick = (item) => {
    if (item.isHistory) { // Use the flag to identify history items
      const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
      if (!history.includes(item.name)) {
        history.unshift(item.name);
        localStorage.setItem('searchHistory', JSON.stringify(history.slice(0, 5)));
      }
      navigate(`/?keyword=${encodeURIComponent(item.name)}&page=1`);
    } else {
      navigate(`/movie/${item.slug}`);
    }
    clearSearchAndHideSearchBar();
  };

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
          isHistory: true
        }))
      );
      setShowSuggestions(updatedHistory.length > 0);
    }
  };

  const handleInputFocus = () => {
    if (searchQuery === '') {
      const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
      if (history.length) {
        setSuggestions(
          history.map((item, index) => ({
            _id: `history_${index}`,
            name: item,
            year: 'Lịch sử tìm kiếm',
            isHistory: true
          }))
        );
        setShowSuggestions(true);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'Done' || e.key === 'Go' || e.key === 'Search') {
      e.preventDefault();
      handleSearch(e);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showSearchBar &&
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target) &&
        !event.target.closest('.search-toggle-button') &&
        !event.target.closest('.hamburger-menu') // Exclude the hamburger menu button
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

      <button className="search-toggle-button" onClick={toggleSearchBar} aria-label="Tìm kiếm">
        {showSearchBar ? <FaTimes /> : <FaSearch />}
      </button>

      {showSearchBar && (
        <div className="search-container active" ref={searchContainerRef}>
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
              aria-label="Nhập từ khóa tìm kiếm"
            />
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
                      src={`${CDN_IMAGE_URL}/${item.thumb_url}`}
                      alt={item.name}
                      className="suggestion-thumb"
                      onError={(e) => (e.target.src = '/placeholder.jpg')}
                    />
                  )}
                  <div className="suggestion-info">
                    <span className="suggestion-title">{item.name}</span>
                    <span className="suggestion-year">{item.year}</span>
                  </div>
                  {item.isHistory && ( // Only show remove button for history items
                    <button
                      className="remove-history-button"
                      onClick={(e) => handleRemoveHistoryItem(item.name, e)}
                      aria-label={`Xóa "${item.name}" khỏi lịch sử`}
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

      {/* Hamburger Menu button to open FilterMenu */}
      <button className="hamburger-menu" onClick={onOpenFilterMenu} aria-label="Mở menu bộ lọc">
        <FaBars />
      </button>
    </header>
  );
}

// Helper debounce function
function debounce(func, delay) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}

export default Header;
