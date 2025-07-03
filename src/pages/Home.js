import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import Select from 'react-select';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import { FaAngleRight, FaTimes, FaHistory, FaTrashAlt } from 'react-icons/fa';

import 'react-lazy-load-image-component/src/effects/blur.css';
import './Home.css';
import useIntersectionObserver from '../hooks/useIntersectionObserver'; // Import the hook

const BASE_API_URL = process.env.REACT_APP_API_URL;
const V1_API_URL = `${process.env.REACT_APP_API_URL}/v1/api`;
const DEFAULT_PAGE_LIMIT = 12;
const WATCH_HISTORY_KEY = 'watchHistory';

const getImageUrl = (url) => {
    if (url && url.startsWith('https://')) {
        return url;
    }
    return url ? `${process.env.REACT_APP_API_CDN_IMAGE}/${url}` : '/placeholder.jpg';
};

const movieApi = {
    fetchGenres: () => axios.get(`${BASE_API_URL}/the-loai`),
    fetchCountries: () => axios.get(`${BASE_API_URL}/quoc-gia`),
    fetchRecentUpdates: (page = 1) => axios.get(`${BASE_API_URL}/danh-sach/phim-moi-cap-nhat?page=${page}`),
    fetchMoviesBySlug: (type, slug, page = 1, limit = DEFAULT_PAGE_LIMIT, filters = {}) => {
        let url;
        if (type === 'category') url = `${V1_API_URL}/danh-sach/${slug}`;
        else if (type === 'genre') url = `${V1_API_URL}/the-loai/${slug}`;
        else if (type === 'country') url = `${V1_API_URL}/quoc-gia/${slug}`;
        else if (type === 'year') url = `${V1_API_URL}/nam/${slug}`;
        else if (type === 'search') url = `${V1_API_URL}/tim-kiem`;
        else return Promise.reject(new Error("Invalid fetch type for movieApi.fetchMoviesBySlug"));

        return axios.get(url, { params: { page, limit, ...filters } });
    }
};

const CATEGORIES_MAPPING = [
    { slug: 'phim-moi-cap-nhat', name: 'Phim Mới Cập Nhật' },
    { slug: 'phim-bo', name: 'Phim Bộ' },
    { slug: 'phim-le', name: 'Phim Lẻ' },
    { slug: 'tv-shows', name: 'TV Shows' },
    { slug: 'hoat-hinh', name: 'Hoạt Hình' },
    { slug: 'phim-vietsub', name: 'Phim Vietsub' },
    { slug: 'phim-thuyet-minh', name: 'Phim Thuyết Minh' },
    { slug: 'phim-long-tieng', name: 'Phim Lồng Tiếng' },
];

function HistorySection({ historyMovies, onDeleteHistoryItem }) {
    const navigate = useNavigate();

    const handleContinueWatching = useCallback((movieSlug, episodeSlug) => {
        navigate(`/movie/${movieSlug}/${episodeSlug}`);
    }, [navigate]);

    if (!historyMovies || historyMovies.length === 0) {
        return null;
    }

    const displayMovies = historyMovies.slice(0, 10);
    const hasMoreHistory = historyMovies.length > 10;

    return (
        <div className="history-section">
            <div className="section-header">
                <h2>Lịch Sử Đã Xem</h2>
                {hasMoreHistory && (
                    <Link to="/history" className="see-all-link">
                        Xem tất cả <FaAngleRight />
                    </Link>
                )}
            </div>
            <div className="history-movie-list">
                {displayMovies.map((movie) => (
                    <div key={movie.slug + (movie.episode?.slug || '')} className="history-movie-card">
                        <Link to={`/movie/${movie.slug}/${movie.episode?.slug || ''}`}>
                            <LazyLoadImage
                                src={getImageUrl(movie.poster_url)}
                                alt={movie.name}
                                className="movie-poster-horizontal"
                                effect="blur"
                                onError={(e) => (e.target.src = '/placeholder.jpg')}
                            />
                            <h3>{movie.name}</h3>
                            {movie.episode?.name && (
                                <p>Tập: {movie.episode.name} ({movie.episode.server_name || 'N/A'})</p>
                            )}
                            {!movie.episode?.name && movie.year && <p>{movie.year}</p>}
                        </Link>
                        <div className="history-actions">
                            {movie.episode?.slug && (
                                <button
                                    onClick={() => handleContinueWatching(movie.slug, movie.episode.slug)}
                                    className="continue-watching-button"
                                >
                                    <FaHistory /> Tiếp tục xem
                                </button>
                            )}
                            <button
                                onClick={() => onDeleteHistoryItem(movie.slug)}
                                className="delete-history-item-button"
                                title="Xóa khỏi lịch sử"
                            >
                                <FaTrashAlt />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function HomePageSection({ title, movies, linkToAll, isLoading }) {
    if (isLoading) {
        return (
            <div className="homepage-section">
                <h2>{title}</h2>
                <div className="section-loading-spinner">
                    <div className="spinner"></div>
                </div>
            </div>
        );
    }

    if (!movies || movies.length === 0) {
        return null;
    }

    return (
        <div className="homepage-section">
            <div className="section-header">
                <h2>{title}</h2>
                {linkToAll && (
                    <Link to={linkToAll} className="see-all-link">
                        Xem tất cả <FaAngleRight />
                    </Link>
                )}
            </div>
            <div className="movie-horizontal-scroll">
                {movies.map((movie) => (
                    <Link key={movie._id} to={`/movie/${movie.slug}`} className="movie-card-horizontal">
                        <LazyLoadImage
                            src={getImageUrl(movie.poster_url)}
                            alt={movie.name}
                            className="movie-poster-horizontal"
                            effect="blur"
                            onError={(e) => (e.target.src = '/placeholder.jpg')}
                        />
                        <h3>{movie.name}</h3>
                        <p>{movie.year}</p>
                    </Link>
                ))}
            </div>
        </div>
    );
}

function Home({ showFilterModal, onCloseFilterModal }) {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [movies, setMovies] = useState([]);
    const [loadingMain, setLoadingMain] = useState(false);
    const [totalPages, setTotalPages] = useState(1);

    const urlKeyword = searchParams.get('keyword');
    const urlCategorySlug = searchParams.get('category');
    const urlCountrySlug = searchParams.get('country');
    const urlYear = searchParams.get('year');
    const urlPage = parseInt(searchParams.get('page')) || 1;

    const [filterCategory, setFilterCategory] = useState(urlCategorySlug || '');
    const [filterCountry, setFilterCountry] = useState(urlCountrySlug || '');
    const [filterYear, setFilterYear] = useState(urlYear || '');
    const [currentPage, setCurrentPage] = useState(urlPage);

    const [genres, setGenres] = useState([]);
    const [countries, setCountries] = useState([]);

    const [seoData, setSeoData] = useState({
        titleHead: 'Phim Online - Trang Chủ',
        descriptionHead: 'Xem phim mới cập nhật nhanh nhất, tổng hợp phim bộ, phim lẻ, TV Shows.'
    });

    const [homeSectionsData, setHomeSectionsData] = useState({
        recentMovies: null, seriesMovies: null, singleMovies: null, tvShows: null,
        dubbedMovies: null, cartoonMovies: null, longTiengMovies: null,
        vietnamMovies: null, chinaMovies: null, usEuMovies: null, japanMovies: null, koreaMovies: null,
    });
    const [requestedSections, setRequestedSections] = useState(new Set()); // Theo dõi các phần đã được yêu cầu tải

    const [watchHistory, setWatchHistory] = useState([]);

    // Định nghĩa refs riêng cho từng section cần lazy load
    const tvShowsRef = useIntersectionObserver();
    const dubbedMoviesRef = useIntersectionObserver();
    const cartoonMoviesRef = useIntersectionObserver();
    const longTiengMoviesRef = useIntersectionObserver();
    const vietnamMoviesRef = useIntersectionObserver();
    const chinaMoviesRef = useIntersectionObserver();
    const usEuMoviesRef = useIntersectionObserver();
    const japanMoviesRef = useIntersectionObserver();
    const koreaMoviesRef = useIntersectionObserver();

    // Cập nhật state cục bộ khi URL params thay đổi
    useEffect(() => {
        setFilterCategory(urlCategorySlug || '');
        setFilterCountry(urlCountrySlug || '');
        setFilterYear(urlYear || '');
        setCurrentPage(urlPage);
    }, [urlKeyword, urlCategorySlug, urlCountrySlug, urlYear, urlPage]);

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: currentYear - 1970 + 2 }, (_, i) => ({
        value: (currentYear + 1 - i).toString(),
        label: (currentYear + 1 - i).toString()
    }));

    const customSelectStyles = {
        control: (provided) => ({
            ...provided,
            backgroundColor: '#333',
            borderColor: '#555',
            color: '#fff',
            boxShadow: 'none',
            '&:hover': { borderColor: '#007bff' }
        }),
        input: (provided) => ({ ...provided, color: '#fff' }),
        placeholder: (provided) => ({ ...provided, color: '#ccc' }),
        singleValue: (provided) => ({ ...provided, color: '#fff' }),
        option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isFocused ? '#007bff' : '#333',
            color: '#fff',
            '&:active': { backgroundColor: '#0056b3' }
        }),
        menu: (provided) => ({ ...provided, backgroundColor: '#333' }),
        multiValue: (provided) => ({ ...provided, backgroundColor: '#007bff' }),
        multiValueLabel: (provided) => ({ ...provided, color: '#fff' }),
        multiValueRemove: (provided) => ({
            provided,
            color: '#fff',
            '&:hover': { backgroundColor: '#0056b3', color: '#fff' }
        })
    };

    // Fetch genres, countries, and watch history once on mount
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [genreRes, countryRes] = await Promise.all([
                    movieApi.fetchGenres(),
                    movieApi.fetchCountries()
                ]);
                setGenres(genreRes.data);
                setCountries(countryRes.data);
                localStorage.setItem('genres', JSON.stringify(genreRes.data));
                localStorage.setItem('countries', JSON.stringify(countryRes.data));
            } catch (error) {
                console.error('Error fetching filters:', error);
            }
        };

        const cachedGenres = localStorage.getItem('genres');
        const cachedCountries = localStorage.getItem('countries');
        if (cachedGenres && cachedCountries) {
            setGenres(JSON.parse(cachedGenres));
            setCountries(JSON.parse(cachedCountries));
        } else {
            fetchInitialData();
        }

        const history = JSON.parse(localStorage.getItem(WATCH_HISTORY_KEY) || '[]');
        setWatchHistory(history.sort((a, b) => b.timestamp - a.timestamp));
    }, []);

    const handleDeleteHistoryItem = useCallback((slugToRemove) => {
        setWatchHistory(prevHistory => {
            const updatedHistory = prevHistory.filter(item => item.slug !== slugToRemove);
            localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(updatedHistory));
            return updatedHistory;
        });
    }, []);

    // Determine if main movie grid should be shown based on URL params
    const showMainMovieGrid = !!urlKeyword || !!urlCategorySlug || !!urlCountrySlug || !!urlYear;

    // Helper function to fetch a specific section
    const fetchSection = useCallback(async (key, fetchFunc) => {
        if (homeSectionsData[key] === null && !requestedSections.has(key)) {
            setRequestedSections(prev => new Set(prev).add(key)); // Đánh dấu là đã yêu cầu tải
            try {
                const res = await fetchFunc();
                setHomeSectionsData(prev => ({ ...prev, [key]: res.data.items || res.data.data?.items || [] }));
            } catch (error) {
                console.error(`Failed to fetch section ${key}:`, error);
                setHomeSectionsData(prev => ({ ...prev, [key]: [] })); // Đặt về mảng rỗng nếu có lỗi
            }
        }
    }, [homeSectionsData, requestedSections]);


    // Unified useEffect for fetching data
    useEffect(() => {
        const fetchData = async () => {
            if (showMainMovieGrid) {
                // Logic cho trang tìm kiếm/filter
                setLoadingMain(true);
                let url = '';
                let params = { page: currentPage, limit: DEFAULT_PAGE_LIMIT };
                let newSeoData = {
                    titleHead: 'Phim Online - Trang Chủ',
                    descriptionHead: 'Xem phim mới cập nhật nhanh nhất, tổng hợp phim bộ, phim lẻ, TV Shows.'
                };

                try {
                    if (urlKeyword) {
                        url = `${V1_API_URL}/tim-kiem`;
                        params.keyword = urlKeyword;
                        newSeoData.titleHead = `Tìm kiếm: ${urlKeyword} - PhimAPI`;
                        newSeoData.descriptionHead = `Kết quả tìm kiếm phim cho từ khóa "${urlKeyword}"`;
                    } else if (urlCategorySlug) {
                        if (urlCategorySlug === 'phim-moi-cap-nhat') {
                            url = `${BASE_API_URL}/danh-sach/phim-moi-cap-nhat`;
                            newSeoData.titleHead = 'Phim Mới Cập Nhật - PhimAPI';
                            newSeoData.descriptionHead = 'Xem phim mới cập nhật nhanh nhất';
                        } else {
                            const isPredefinedListType = CATEGORIES_MAPPING.some(cat => cat.slug === urlCategorySlug);
                            if (isPredefinedListType) {
                                url = `${V1_API_URL}/danh-sach/${urlCategorySlug}`;
                                const typeName = CATEGORIES_MAPPING.find(cat => cat.slug === urlCategorySlug)?.name || urlCategorySlug;
                                newSeoData.titleHead = `${typeName} - PhimAPI`;
                                newSeoData.descriptionHead = `Danh sách ${typeName} mới nhất.`;
                            } else {
                                url = `${V1_API_URL}/the-loai/${urlCategorySlug}`;
                                const catName = genres.find(g => g.slug === urlCategorySlug)?.name || urlCategorySlug;
                                newSeoData.titleHead = `${catName} - PhimAPI`;
                                newSeoData.descriptionHead = `Danh sách phim thể loại ${catName} mới nhất.`;
                            }
                        }
                    } else if (urlCountrySlug) {
                        url = `${V1_API_URL}/quoc-gia/${urlCountrySlug}`;
                        const countryName = countries.find(c => c.slug === urlCountrySlug)?.name || urlCountrySlug;
                        newSeoData.titleHead = `Phim ${countryName} - PhimAPI`;
                        newSeoData.descriptionHead = `Danh sách phim quốc gia ${countryName} mới nhất.`;
                    } else if (urlYear) {
                        url = `${V1_API_URL}/nam/${urlYear}`;
                        newSeoData.titleHead = `Phim năm ${urlYear} - PhimAPI`;
                        newSeoData.descriptionHead = `Danh sách phim phát hành năm ${urlYear} mới nhất.`;
                    } else {
                        setMovies([]);
                        setTotalPages(1);
                        setLoadingMain(false);
                        return;
                    }

                    const response = await axios.get(url, { params });
                    console.log("API response for main movies:", response.data);

                    let items = [];
                    let paginationData = {};
                    let seoOnPageData = {};

                    if (url.includes('/danh-sach/phim-moi-cap-nhat')) {
                        items = response.data.items || [];
                        paginationData = response.data.pagination || {};
                    } else {
                        items = response.data.data?.items || [];
                        paginationData = response.data.data?.params?.pagination || {};
                        seoOnPageData = response.data.data?.seoOnPage || {};
                    }
                    setMovies(items);
                    setTotalPages(paginationData.totalPages || 1);
                    setSeoData(seoOnPageData.titleHead ? seoOnPageData : newSeoData);

                } catch (error) {
                    console.error('Error fetching main movies:', error);
                    setMovies([]);
                    setTotalPages(1);
                } finally {
                    setLoadingMain(false);
                }
            } else {
                // Logic cho các phần trên trang chủ (lazy loading)
                // Luôn tải 3 phần đầu tiên ngay lập tức
                fetchSection('recentMovies', movieApi.fetchRecentUpdates);
                fetchSection('seriesMovies', () => movieApi.fetchMoviesBySlug('category', 'phim-bo'));
                fetchSection('singleMovies', () => movieApi.fetchMoviesBySlug('category', 'phim-le'));

                // Tải các phần khác khi ref tương ứng đi vào tầm nhìn
                if (tvShowsRef[1]?.isIntersecting) {
                    fetchSection('tvShows', () => movieApi.fetchMoviesBySlug('category', 'tv-shows'));
                }
                if (dubbedMoviesRef[1]?.isIntersecting) {
                    fetchSection('dubbedMovies', () => movieApi.fetchMoviesBySlug('category', 'phim-thuyet-minh'));
                }
                if (cartoonMoviesRef[1]?.isIntersecting) {
                    fetchSection('cartoonMovies', () => movieApi.fetchMoviesBySlug('category', 'hoat-hinh'));
                }
                if (longTiengMoviesRef[1]?.isIntersecting) {
                    fetchSection('longTiengMovies', () => movieApi.fetchMoviesBySlug('category', 'phim-long-tieng'));
                }
                if (vietnamMoviesRef[1]?.isIntersecting) {
                    fetchSection('vietnamMovies', () => movieApi.fetchMoviesBySlug('country', 'viet-nam'));
                }
                if (chinaMoviesRef[1]?.isIntersecting) {
                    fetchSection('chinaMovies', () => movieApi.fetchMoviesBySlug('country', 'trung-quoc'));
                }
                if (usEuMoviesRef[1]?.isIntersecting) {
                    fetchSection('usEuMovies', () => movieApi.fetchMoviesBySlug('country', 'au-my'));
                }
                if (japanMoviesRef[1]?.isIntersecting) {
                    fetchSection('japanMovies', () => movieApi.fetchMoviesBySlug('country', 'nhat-ban'));
                }
                if (koreaMoviesRef[1]?.isIntersecting) {
                    fetchSection('koreaMovies', () => movieApi.fetchMoviesBySlug('country', 'han-quoc'));
                }
            }
        };

        fetchData();
    }, [
        currentPage, urlKeyword, urlCategorySlug, urlCountrySlug, urlYear, showMainMovieGrid,
        genres, countries, fetchSection, // useCallback memoizes fetchSection, nhưng vẫn cần đưa vào dep nếu nó phụ thuộc vào các state/props khác
        // Thêm tất cả các ref's isIntersecting để kích hoạt lại useEffect khi tầm nhìn thay đổi
        tvShowsRef[1], dubbedMoviesRef[1], cartoonMoviesRef[1], longTiengMoviesRef[1],
        vietnamMoviesRef[1], chinaMoviesRef[1], usEuMoviesRef[1], japanMoviesRef[1], koreaMoviesRef[1]
    ]);


    const handleFilterChange = useCallback((type, selectedValue) => {
        const value = selectedValue ? selectedValue.value : '';
        const newSearchParams = new URLSearchParams();

        if (urlKeyword && type !== 'keyword') newSearchParams.set('keyword', urlKeyword);
        if (urlCategorySlug && type !== 'category') newSearchParams.set('category', urlCategorySlug);
        if (urlCountrySlug && type !== 'country') newSearchParams.set('country', urlCountrySlug);
        if (urlYear && type !== 'year') newSearchParams.set('year', urlYear);

        newSearchParams.set('page', '1');

        if (type === 'category') {
            if (value) newSearchParams.set('category', value);
            else newSearchParams.delete('category');
            newSearchParams.delete('country');
            newSearchParams.delete('year');
            newSearchParams.delete('keyword');
        } else if (type === 'country') {
            if (value) newSearchParams.set('country', value);
            else newSearchParams.delete('country');
            newSearchParams.delete('category');
            newSearchParams.delete('year');
            newSearchParams.delete('keyword');
        } else if (type === 'year') {
            if (value) newSearchParams.set('year', value);
            else newSearchParams.delete('year');
            newSearchParams.delete('category');
            newSearchParams.delete('country');
            newSearchParams.delete('keyword');
        } else if (type === 'keyword') {
            if (value) newSearchParams.set('keyword', value);
            else newSearchParams.delete('keyword');
            newSearchParams.delete('category');
            newSearchParams.delete('country');
            newSearchParams.delete('year');
        }

        navigate(`/?${newSearchParams.toString()}`);
        onCloseFilterModal();
    }, [navigate, onCloseFilterModal, urlKeyword, urlCategorySlug, urlCountrySlug, urlYear]);

    const handlePageChange = useCallback((newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            const newSearchParams = new URLSearchParams(searchParams);
            newSearchParams.set('page', newPage.toString());
            navigate(`/?${newSearchParams.toString()}`);
        }
    }, [totalPages, searchParams, navigate]);

    const getMainListTitle = () => {
        if (urlKeyword) return `Kết quả tìm kiếm cho: "${urlKeyword}"`;
        if (urlCategorySlug) {
            if (urlCategorySlug === 'phim-moi-cap-nhat') return 'Phim Mới Cập Nhật';
            const predefined = CATEGORIES_MAPPING.find(cat => cat.slug === urlCategorySlug);
            if (predefined) return predefined.name;
            const genre = genres.find(g => g.slug === urlCategorySlug);
            if (genre) return genre.name;
            return urlCategorySlug;
        }
        if (urlCountrySlug) return countries.find(c => c.slug === urlCountrySlug)?.name || urlCountrySlug;
        if (urlYear) return `Phim năm ${urlYear}`;
        return 'Danh sách phim';
    };

    // Spinner chung chỉ hiển thị khi đang tải trang chính hoặc các kết quả tìm kiếm/lọc
    const showGlobalSpinner = (loadingMain && showMainMovieGrid);

    if (showGlobalSpinner) {
        return <div className="container"><div className="spinner"></div></div>;
    }

    return (
        <div className="container">
            <Helmet>
                <title>{seoData.titleHead}</title>
                <meta name="description" content={seoData.descriptionHead} />
            </Helmet>

            {showFilterModal && (
                <div className="filter-modal-overlay" onClick={onCloseFilterModal}>
                    <div className="filter-modal-content" onClick={e => e.stopPropagation()}>
                        <button className="close-modal-button" onClick={onCloseFilterModal}>
                            <FaTimes />
                        </button>
                        <h2 className="modal-title">Bộ Lọc Phim</h2>
                        <div className="filter-container-modal">
                            <Select
                                options={[{ value: '', label: 'Tất cả thể loại' }, ...genres.map(g => ({ value: g.slug, label: g.name }))]}
                                value={filterCategory ? { value: filterCategory, label: genres.find(g => g.slug === filterCategory)?.name || filterCategory } : { value: '', label: 'Tất cả thể loại' }}
                                onChange={(selected) => handleFilterChange('category', selected)}
                                placeholder="Chọn thể loại..."
                                className="filter-select"
                                styles={customSelectStyles}
                            />
                            <Select
                                options={[{ value: '', label: 'Tất cả quốc gia' }, ...countries.map(c => ({ value: c.slug, label: c.name }))]}
                                value={filterCountry ? { value: filterCountry, label: countries.find(c => c.slug === filterCountry)?.name || filterCountry } : { value: '', label: 'Tất cả quốc gia' }}
                                onChange={(selected) => handleFilterChange('country', selected)}
                                placeholder="Chọn quốc gia..."
                                className="filter-select"
                                styles={customSelectStyles}
                            />
                            <Select
                                options={[{ value: '', label: 'Tất cả năm' }, ...years]}
                                value={filterYear ? { value: filterYear, label: filterYear } : { value: '', label: 'Tất cả năm' }}
                                onChange={(selected) => handleFilterChange('year', selected)}
                                placeholder="Chọn năm..."
                                className="filter-select"
                                styles={customSelectStyles}
                            />
                        </div>
                    </div>
                </div>
            )}

            {showMainMovieGrid && (
                <h1 className="main-list-title">
                    {getMainListTitle()}
                </h1>
            )}

            {showMainMovieGrid ? (
                <>
                    {loadingMain ? (
                        <div className="main-grid-spinner">
                            <div className="spinner"></div>
                        </div>
                    ) : (movies.length === 0 ? (
                        <p className="no-movies-found">Không tìm thấy phim nào phù hợp với lựa chọn của bạn.</p>
                    ) : (
                        <div className="movie-grid">
                            {movies.map((movie) => (
                                <Link key={movie._id} to={`/movie/${movie.slug}`} className="movie-card">
                                    <LazyLoadImage
                                        src={getImageUrl(movie.poster_url)}
                                        alt={movie.name}
                                        className="movie-poster"
                                        effect="blur"
                                        onError={(e) => (e.target.src = '/placeholder.jpg')}
                                    />
                                    <h3>{movie.name}</h3>
                                    <p>{movie.year}</p>
                                    {movie.quality && <span className="movie-quality">{movie.quality}</span>}
                                    {movie.episode_current && <span className="movie-status">{movie.episode_current}</span>}
                                </Link>
                            ))}
                        </div>
                    ))}
                    {totalPages > 1 && !loadingMain && (
                        <div className="pagination">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="pagination-button"
                            >
                                Trang trước
                            </button>
                            <span className="pagination-info">
                                Trang {currentPage} / {totalPages}
                            </span>
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="pagination-button"
                            >
                                Trang sau
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div className="home-sections-container">
                    {/* Luôn tải các phần ban đầu này */}
                    <HomePageSection
                        title="Phim Mới Cập Nhật"
                        movies={homeSectionsData.recentMovies}
                        linkToAll="/?category=phim-moi-cap-nhat&page=1"
                        isLoading={homeSectionsData.recentMovies === null}
                    />

                    <HomePageSection
                        title="Phim Bộ"
                        movies={homeSectionsData.seriesMovies}
                        linkToAll="/?category=phim-bo&page=1"
                        isLoading={homeSectionsData.seriesMovies === null}
                    />
                    <HomePageSection
                        title="Phim Lẻ"
                        movies={homeSectionsData.singleMovies}
                        linkToAll="/?category=phim-le&page=1"
                        isLoading={homeSectionsData.singleMovies === null}
                    />
                    {watchHistory.length > 0 && (
                        <HistorySection
                            historyMovies={watchHistory}
                            onDeleteHistoryItem={handleDeleteHistoryItem}
                        />
                    )}

                    {/* Các phần được tải lười biếng - mỗi phần với ref riêng */}
                    {/* TV Shows */}
                    <div ref={tvShowsRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="TV Shows"
                            movies={homeSectionsData.tvShows}
                            linkToAll="/?category=tv-shows&page=1"
                            // isLoading chỉ true khi dữ liệu chưa tải VÀ div này đang trong tầm nhìn
                            isLoading={homeSectionsData.tvShows === null && tvShowsRef[1]?.isIntersecting}
                        />
                    </div>

                    {/* Phim Thuyết Minh */}
                    <div ref={dubbedMoviesRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="Phim Thuyết Minh"
                            movies={homeSectionsData.dubbedMovies}
                            linkToAll="/?category=phim-thuyet-minh&page=1"
                            isLoading={homeSectionsData.dubbedMovies === null && dubbedMoviesRef[1]?.isIntersecting}
                        />
                    </div>

                    {/* Hoạt Hình */}
                    <div ref={cartoonMoviesRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="Hoạt Hình"
                            movies={homeSectionsData.cartoonMovies}
                            linkToAll="/?category=hoat-hinh&page=1"
                            isLoading={homeSectionsData.cartoonMovies === null && cartoonMoviesRef[1]?.isIntersecting}
                        />
                    </div>

                    {/* Phim Lồng Tiếng */}
                    <div ref={longTiengMoviesRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="Phim Lồng Tiếng"
                            movies={homeSectionsData.longTiengMovies}
                            linkToAll="/?category=phim-long-tieng&page=1"
                            isLoading={homeSectionsData.longTiengMovies === null && longTiengMoviesRef[1]?.isIntersecting}
                        />
                    </div>

                    {/* Phim Việt Nam */}
                    <div ref={vietnamMoviesRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="Phim Việt Nam"
                            movies={homeSectionsData.vietnamMovies}
                            linkToAll="/?country=viet-nam&page=1"
                            isLoading={homeSectionsData.vietnamMovies === null && vietnamMoviesRef[1]?.isIntersecting}
                        />
                    </div>

                    {/* Phim Trung Quốc */}
                    <div ref={chinaMoviesRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="Phim Trung Quốc"
                            movies={homeSectionsData.chinaMovies}
                            linkToAll="/?country=trung-quoc&page=1"
                            isLoading={homeSectionsData.chinaMovies === null && chinaMoviesRef[1]?.isIntersecting}
                        />
                    </div>

                    {/* Phim Âu Mỹ */}
                    <div ref={usEuMoviesRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="Phim Âu Mỹ"
                            movies={homeSectionsData.usEuMovies}
                            linkToAll="/?country=au-my&page=1"
                            isLoading={homeSectionsData.usEuMovies === null && usEuMoviesRef[1]?.isIntersecting}
                        />
                    </div>

                    {/* Phim Nhật Bản */}
                    <div ref={japanMoviesRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="Phim Nhật Bản"
                            movies={homeSectionsData.japanMovies}
                            linkToAll="/?country=nhat-ban&page=1"
                            isLoading={homeSectionsData.japanMovies === null && japanMoviesRef[1]?.isIntersecting}
                        />
                    </div>

                    {/* Phim Hàn Quốc */}
                    <div ref={koreaMoviesRef[0]} className="lazy-load-trigger-point">
                        <HomePageSection
                            title="Phim Hàn Quốc"
                            movies={homeSectionsData.koreaMovies}
                            linkToAll="/?country=han-quoc&page=1"
                            isLoading={homeSectionsData.koreaMovies === null && koreaMoviesRef[1]?.isIntersecting}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default Home;
