// src/pages/Home.js

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom'; // Đã thêm Link ở đây
import axios from 'axios';
import { Helmet } from 'react-helmet';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import { FaFilter, FaTimes, FaHistory } from 'react-icons/fa';
import './Home.css';
import Spinner from '../components/Spinner';

// --- Constants ---
const V1_API_URL = `${process.env.REACT_APP_API_URL}/v1/api`;
const CDN_IMAGE_URL = process.env.REACT_APP_API_CDN_IMAGE;

function Home({ showFilterModal, onCloseFilterModal }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [genres, setGenres] = useState([]);
  const [countries, setCountries] = useState([]);
  const [movieTypes, setMovieTypes] = useState([]);
  const [years, setYears] = useState([]);

  // States for selected filters
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedDubbed, setSelectedDubbed] = useState(''); // 'true', 'false', ''

  const initialLoadRef = useRef(true); // Ref to track initial load

  const buildApiUrl = useCallback(() => {
    const params = new URLSearchParams();
    const keyword = searchParams.get('keyword');
    const page = searchParams.get('page') || '1';

    // Cập nhật trạng thái local từ URL params
    const genreParam = searchParams.get('genre') || '';
    const countryParam = searchParams.get('country') || '';
    const yearParam = searchParams.get('year') || '';
    const typeParam = searchParams.get('type') || '';
    const dubbedParam = searchParams.get('dubbed') || '';

    if (selectedGenre !== genreParam) setSelectedGenre(genreParam);
    if (selectedCountry !== countryParam) setSelectedCountry(countryParam);
    if (selectedYear !== yearParam) setSelectedYear(yearParam);
    if (selectedType !== typeParam) setSelectedType(typeParam);
    if (selectedDubbed !== dubbedParam) setSelectedDubbed(dubbedParam);

    if (keyword) {
      params.append('keyword', keyword);
      // Khi có keyword, bỏ qua các bộ lọc khác trên URL nếu có
    } else {
      // Chỉ thêm các bộ lọc nếu không có keyword
      if (genreParam) params.append('genre', genreParam);
      if (countryParam) params.append('country', countryParam);
      if (yearParam) params.append('year', yearParam);
      if (typeParam) params.append('type', typeParam);
      if (dubbedParam) params.append('dubbed', dubbedParam);
    }

    params.append('page', page);

    // Endpoint dựa trên việc có keyword hay không
    const endpoint = keyword ? 'tim-kiem' : 'danh-sach';
    return `${V1_API_URL}/${endpoint}?${params.toString()}`;
  }, [searchParams, selectedGenre, selectedCountry, selectedYear, selectedType, selectedDubbed]);


  // Effect để fetch data chính (movies)
  useEffect(() => {
    const fetchMovies = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = buildApiUrl();
        const response = await axios.get(url, {
          timeout: 10000,
        });

        if (response.data && response.data.data) {
          const { items, pagination } = response.data.data;
          setMovies(items || []);
          setCurrentPage(pagination?.currentPage || 1);
          setTotalPages(pagination?.totalPage || 1);
          setTotalItems(pagination?.totalItems || 0);
        } else {
          setMovies([]);
          setCurrentPage(1);
          setTotalPages(1);
          setTotalItems(0);
          console.warn("API response data is not in expected format:", response.data);
        }
      } catch (err) {
        console.error('Error fetching movies:', err);
        setError('Không thể tải phim. Vui lòng thử lại sau.');
        setMovies([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
  }, [searchParams, buildApiUrl]);

  // Effect để fetch filter options (chỉ chạy một lần khi component mount)
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const [genreRes, countryRes, typeRes] = await Promise.all([
          axios.get(`${V1_API_URL}/the-loai`),
          axios.get(`${V1_API_URL}/quoc-gia`),
          axios.get(`${V1_API_URL}/the-loai-phim-le-phim-bo`),
        ]);

        setGenres(genreRes.data.data || []);
        setCountries(countryRes.data.data || []);
        setMovieTypes(typeRes.data.data || []);

        // Tạo danh sách năm từ hiện tại về trước 50 năm
        const currentYear = new Date().getFullYear();
        const yearsList = Array.from({ length: 50 }, (_, i) => currentYear - i);
        setYears(yearsList);
      } catch (error) {
        console.error('Error fetching filter options:', error);
      }
    };
    fetchFilterOptions();
  }, []);

  // Sync internal filter states with URL params on initial load or URL change
  useEffect(() => {
    if (initialLoadRef.current) {
      setSelectedGenre(searchParams.get('genre') || '');
      setSelectedCountry(searchParams.get('country') || '');
      setSelectedYear(searchParams.get('year') || '');
      setSelectedType(searchParams.get('type') || '');
      setSelectedDubbed(searchParams.get('dubbed') || '');
      initialLoadRef.current = false;
    }
  }, [searchParams]);


  const handleFilterChange = useCallback((filterName, value) => {
    setSearchParams((prevParams) => {
      const newParams = new URLSearchParams(prevParams);
      newParams.delete('keyword');
      newParams.delete('page');

      if (value) {
        newParams.set(filterName, value);
      } else {
        newParams.delete(filterName);
      }
      return newParams;
    }, { replace: true });

    // Cập nhật trạng thái cục bộ
    if (filterName === 'genre') setSelectedGenre(value);
    else if (filterName === 'country') setSelectedCountry(value);
    else if (filterName === 'year') setSelectedYear(value);
    else if (filterName === 'type') setSelectedType(value);
    else if (filterName === 'dubbed') setSelectedDubbed(value);

    onCloseFilterModal();
  }, [setSearchParams, onCloseFilterModal]);

  const handlePageChange = useCallback((page) => {
    setSearchParams((prevParams) => {
      const newParams = new URLSearchParams(prevParams);
      newParams.set('page', page);
      return newParams;
    }, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setSearchParams]);

  const getImageUrl = (url) => {
    if (!url) return '/placeholder.jpg';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `${CDN_IMAGE_URL}/${url}`;
  };

  const clearAllFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
    setSelectedGenre('');
    setSelectedCountry('');
    setSelectedYear('');
    setSelectedType('');
    setSelectedDubbed('');
    onCloseFilterModal();
  }, [setSearchParams, onCloseFilterModal]);

  const isFilterActive = () => {
    return selectedGenre || selectedCountry || selectedYear || selectedType || selectedDubbed || searchParams.get('keyword');
  };

  if (error) {
    return <div className="container error-message">{error}</div>;
  }

  const renderPagination = () => {
    const pages = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    if (startPage > 1) {
      pages.push(
        <button key="first" onClick={() => handlePageChange(1)} className="pagination-button">
          1
        </button>
      );
      if (startPage > 2) {
        pages.push(<span key="dots-prev" className="pagination-dots">...</span>);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`pagination-button ${i === currentPage ? 'active' : ''}`}
        >
          {i}
        </button>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push(<span key="dots-next" className="pagination-dots">...</span>);
      }
      pages.push(
        <button key="last" onClick={() => handlePageChange(totalPages)} className="pagination-button">
          {totalPages}
        </button>
      );
    }

    return (
      <div className="pagination">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="pagination-button"
        >
          Trước
        </button>
        {pages}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="pagination-button"
        >
          Tiếp
        </button>
      </div>
    );
  };

  return (
    <div className="home-page container">
      <Helmet>
        <title>Xem Phim Online Miễn Phí - Phim Mới Nhanh Nhất</title>
        <meta
          name="description"
          content="Xem phim online miễn phí, phim bộ, phim lẻ, phim chiếu rạp mới nhất với chất lượng cao và cập nhật nhanh chóng."
        />
      </Helmet>

      {showFilterModal && (
        <div className="filter-modal-overlay" onClick={onCloseFilterModal}>
          <div className="filter-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="filter-modal-header">
              <h2>Bộ lọc phim</h2>
              <button className="close-filter-btn" onClick={onCloseFilterModal}>
                <FaTimes />
              </button>
            </div>

            <div className="filter-group">
              <label htmlFor="genre-select">Thể loại:</label>
              <select
                id="genre-select"
                value={selectedGenre}
                onChange={(e) => handleFilterChange('genre', e.target.value)}
              >
                <option value="">Tất cả</option>
                {genres.map((genre) => (
                  <option key={genre.slug} value={genre.slug}>
                    {genre.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="country-select">Quốc gia:</label>
              <select
                id="country-select"
                value={selectedCountry}
                onChange={(e) => handleFilterChange('country', e.target.value)}
              >
                <option value="">Tất cả</option>
                {countries.map((country) => (
                  <option key={country.slug} value={country.slug}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="year-select">Năm phát hành:</label>
              <select
                id="year-select"
                value={selectedYear}
                onChange={(e) => handleFilterChange('year', e.target.value)}
              >
                <option value="">Tất cả</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="type-select">Loại phim:</label>
              <select
                id="type-select"
                value={selectedType}
                onChange={(e) => handleFilterChange('type', e.target.value)}
              >
                <option value="">Tất cả</option>
                {movieTypes.map((type) => (
                  <option key={type.slug} value={type.slug}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="dubbed-select">Lồng tiếng:</label>
              <select
                id="dubbed-select"
                value={selectedDubbed}
                onChange={(e) => handleFilterChange('dubbed', e.target.value)}
              >
                <option value="">Tất cả</option>
                <option value="true">Có lồng tiếng</option>
                <option value="false">Không lồng tiếng</option>
              </select>
            </div>

            <div className="filter-actions">
              <button className="clear-filters-btn" onClick={clearAllFilters}>
                Xóa tất cả
              </button>
              <button className="apply-filters-btn" onClick={onCloseFilterModal}>
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="action-bar">
        <button className="filter-button" onClick={onCloseFilterModal}>
          <FaFilter /> Bộ lọc
        </button>
        <button className="history-button" onClick={() => navigate('/history')}>
          <FaHistory /> Lịch sử xem
        </button>
      </div>


      {loading ? (
        <Spinner />
      ) : (
        <>
          {searchParams.get('keyword') && (
            <h2 className="section-title">
              Kết quả tìm kiếm cho: "{searchParams.get('keyword')}" ({totalItems} phim)
            </h2>
          )}
          {!searchParams.get('keyword') && isFilterActive() && (
            <h2 className="section-title">Phim theo bộ lọc ({totalItems} phim)</h2>
          )}
          {!searchParams.get('keyword') && !isFilterActive() && (
            <h2 className="section-title">Phim mới cập nhật ({totalItems} phim)</h2>
          )}

          {movies.length > 0 ? (
            <div className="movie-grid">
              {movies.map((movie) => (
                <div key={movie._id} className="movie-card">
                  <Link to={`/movie/${movie.slug}`}>
                    <LazyLoadImage
                      src={getImageUrl(movie.thumb_url)}
                      alt={movie.name}
                      effect="blur"
                      className="movie-thumbnail"
                      width="200"
                      height="300"
                    />
                    <div className="movie-info-overlay">
                      <h3 className="movie-card-title">{movie.name}</h3>
                      <p className="movie-card-year">{movie.year}</p>
                      <p className="movie-card-status">{movie.episode_current}</p>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-results-message">Không tìm thấy phim nào.</p>
          )}

          {totalPages > 1 && renderPagination()}
        </>
      )}
    </div>
  );
}

export default Home;
