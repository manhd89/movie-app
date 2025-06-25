import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import Select from 'react-select';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import { FaAngleRight, FaTimes, FaHistory, FaTrashAlt } from 'react-icons/fa'; // Import FaHistory, FaTrashAlt

import 'react-lazy-load-image-component/src/effects/blur.css';
import './Home.css'; // Đảm bảo đã import Home.css

const BASE_API_URL = process.env.REACT_APP_API_URL;
const V1_API_URL = `${process.env.REACT_APP_API_URL}/v1/api`;
const DEFAULT_PAGE_LIMIT = 12;
const WATCH_HISTORY_KEY = 'watchHistory'; // NEW: Key for watch history

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

// Hàm tiện ích để định dạng thời gian từ giây sang phút:giây (có thể không dùng trong Home.js nhưng giữ lại nếu cần)
// const formatTime = (seconds) => {
//     const minutes = Math.floor(seconds / 60);
//     const remainingSeconds = Math.floor(seconds % 60);
//     return `${minutes} phút ${remainingSeconds} giây`;
// };

// NEW: Component riêng cho section Lịch sử đã xem
function HistorySection({ historyMovies, onDeleteHistoryItem }) {
    const navigate = useNavigate();

    // Hàm xử lý "Tiếp tục xem"
    const handleContinueWatching = useCallback((movieSlug, episodeSlug) => {
        // Điều hướng tới trang chi tiết phim với tập cụ thể
        navigate(`/movie/${movieSlug}/${episodeSlug}`);
    }, [navigate]);

    // Chỉ render nếu có phim trong lịch sử
    if (!historyMovies || historyMovies.length === 0) {
        return null;
    }

    // Lấy tối đa 10 phim để hiển thị trên trang chủ
    const displayMovies = historyMovies.slice(0, 10);
    const hasMoreHistory = historyMovies.length > 10;

    return (
        <div className="history-section">
            <div className="section-header">
                <h2>Lịch Sử Đã Xem</h2>
                {hasMoreHistory && (
                    // Bạn có thể tạo một trang riêng cho lịch sử hoặc sử dụng modal để hiển thị tất cả
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
                            {/* Hiển thị thông tin tập phim đã xem */}
                            {movie.episode?.name && (
                                <p>Tập: {movie.episode.name} ({movie.episode.server_name || 'N/A'})</p>
                            )}
                            {!movie.episode?.name && movie.year && <p>{movie.year}</p>} {/* Fallback nếu không có tập */}
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


// Component HomePageSection (không thay đổi nhiều, chỉ đảm bảo nó hoạt động bình thường)
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
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const [movies, setMovies] = useState([]);
    const [loadingMain, setLoadingMain] = useState(true);
    const [totalPages, setTotalPages] = useState(1);

    const [filterCategory, setFilterCategory] = useState('');
    const [filterCountry, setFilterCountry] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [keyword, setKeyword] = useState('');

    const [genres, setGenres] = useState([]);
    const [countries, setCountries] = useState([]);

    const [seoData, setSeoData] = useState({
        titleHead: 'PhimAPI - Trang Chủ',
        descriptionHead: 'Xem phim mới cập nhật nhanh nhất, tổng hợp phim bộ, phim lẻ, TV Shows.'
    });

    const [homeSectionsData, setHomeSectionsData] = useState({
        recentMovies: [], seriesMovies: [], singleMovies: [], tvShows: [],
        dubbedMovies: [], cartoonMovies: [], longTiengMovies: [],
        vietnamMovies: [], chinaMovies: [], usEuMovies: [], japanMovies: [], koreaMovies: [],
    });
    const [loadingSections, setLoadingSections] = useState(true);

    // NEW: State cho lịch sử xem
    const [watchHistory, setWatchHistory] = useState([]);

    const urlCategorySlug = searchParams.get('category');
    const urlCountrySlug = searchParams.get('country');
    const urlYear = searchParams.get('year');
    const urlKeyword = searchParams.get('keyword');

    const showMainMovieGrid = !!urlKeyword || !!urlCategorySlug || !!urlCountrySlug || !!urlYear;

    useEffect(() => {
        setKeyword(urlKeyword || '');
        setFilterCategory(urlCategorySlug || '');
        setFilterCountry(urlCountrySlug || '');
        setFilterYear(urlYear || '');
        setCurrentPage(parseInt(searchParams.get('page')) || 1);
    }, [searchParams, urlCategorySlug, urlCountrySlug, urlYear, urlKeyword]);

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

    const COUNTRIES_MAPPING = [
        { slug: 'viet-nam', name: 'Việt Nam' },
        { slug: 'trung-quoc', name: 'Trung Quốc' },
        { slug: 'au-my', name: 'Âu Mỹ' },
        { slug: 'nhat-ban', name: 'Nhật Bản' },
        { slug: 'han-quoc', name: 'Hàn Quốc' },
    ];

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

    useEffect(() => {
        const fetchFilters = async () => {
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
            fetchFilters();
        }

        // NEW: Load watch history on component mount
        const history = JSON.parse(localStorage.getItem(WATCH_HISTORY_KEY) || '[]');
        // Sort history by timestamp (most recent first)
        setWatchHistory(history.sort((a, b) => b.timestamp - a.timestamp));

    }, []);

    // NEW: Hàm xóa phim khỏi lịch sử xem
    const handleDeleteHistoryItem = useCallback((slugToRemove) => {
        setWatchHistory(prevHistory => {
            const updatedHistory = prevHistory.filter(item => item.slug !== slugToRemove);
            localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(updatedHistory));
            return updatedHistory;
        });
    }, []);


    useEffect(() => {
        if (showMainMovieGrid) {
            setLoadingSections(false);
            return;
        }

        const fetchHomePageSections = async () => {
            setLoadingSections(true);

            const sectionPromises = [
                movieApi.fetchRecentUpdates().then(res => ({ key: 'recentMovies', data: res.data.items || [] })),
                movieApi.fetchMoviesBySlug('category', 'phim-bo').then(res => ({ key: 'seriesMovies', data: res.data.data?.items || [] })),
                movieApi.fetchMoviesBySlug('category', 'phim-le').then(res => ({ key: 'singleMovies', data: res.data.data?.items || [] })),
                movieApi.fetchMoviesBySlug('category', 'tv-shows').then(res => ({ key: 'tvShows', data: res.data.data?.items || [] })),
                movieApi.fetchMoviesBySlug('category', 'hoat-hinh').then(res => ({ key: 'cartoonMovies', data: res.data.data?.items || [] })),
                movieApi.fetchMoviesBySlug('category', 'phim-thuyet-minh').then(res => ({ key: 'dubbedMovies', data: res.data.data?.items || [] })),
                movieApi.fetchMoviesBySlug('category', 'phim-long-tieng').then(res => ({ key: 'longTiengMovies', data: res.data.data?.items || [] })),
                movieApi.fetchMoviesBySlug('country', 'viet-nam').then(res => ({ key: 'vietnamMovies', data: res.data.data?.items || [] })),
                movieApi.fetchMoviesBySlug('country', 'trung-quoc').then(res => ({ key: 'chinaMovies', data: res.data.data?.items || [] })),
                movieApi.fetchMoviesBySlug('country', 'au-my').then(res => ({ key: 'usEuMovies', data: res.data.data?.items || [] })),
                movieApi.fetchMoviesBySlug('country', 'nhat-ban').then(res => ({ key: 'japanMovies', data: res.data.data?.items || [] })),
                movieApi.fetchMoviesBySlug('country', 'han-quoc').then(res => ({ key: 'koreaMovies', data: res.data.data?.items || [] })),
            ];

            try {
                const results = await Promise.allSettled(sectionPromises);
                const newSectionsData = {};
                results.forEach(result => {
                    if (result.status === 'fulfilled') {
                        newSectionsData[result.value.key] = result.value.data;
                    } else {
                        console.error(`Failed to fetch section ${result.reason?.config?.url || ''}:`, result.reason);
                    }
                });
                setHomeSectionsData(prev => ({ ...prev, ...newSectionsData }));
            } catch (error) {
                console.error('Unexpected error fetching home page sections:', error);
            } finally {
                setLoadingSections(false);
            }
        };

        if (showMainMovieGrid) {
            setLoadingSections(false); // Khi ở trang kết quả tìm kiếm/lọc, không cần load các section phụ
            return;
        }

        fetchHomePageSections();
    }, [showMainMovieGrid]);


    useEffect(() => {
        const fetchMainMovies = async () => {
            setLoadingMain(true);
            let url = '';
            let params = { page: currentPage, limit: DEFAULT_PAGE_LIMIT };
            let newSeoData = {
                titleHead: 'PhimAPI - Trang Chủ',
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
                    // Khi không có bộ lọc nào, không cần fetch main movie grid
                    setMovies([]);
                    setTotalPages(1);
                    setLoadingMain(false);
                    return;
                }

                const response = await axios.get(url, { params });

                let items = [];
                let paginationData = {};
                let seoOnPageData = {};

                // Điều chỉnh logic phân tích phản hồi API tùy thuộc vào cấu trúc của API bạn
                if (url === `${BASE_API_URL}/danh-sach/phim-moi-cap-nhat`) {
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
        };

        if (showMainMovieGrid) {
            fetchMainMovies();
        } else {
            // Khi không ở chế độ grid (trên trang chủ mặc định), không cần fetch main movies
            setLoadingMain(false);
            setMovies([]);
            setTotalPages(1);
        }
    }, [currentPage, urlKeyword, urlCategorySlug, urlCountrySlug, urlYear, genres, countries, showMainMovieGrid, CATEGORIES_MAPPING]);


    const handleFilterChange = useCallback((type, selectedValue) => {
        const value = selectedValue ? selectedValue.value : '';
        const newSearchParams = new URLSearchParams();

        if (value) {
            newSearchParams.set('page', '1');
            if (type === 'category') {
                newSearchParams.set('category', value);
            } else if (type === 'country') {
                newSearchParams.set('country', value);
            } else if (type === 'year') {
                newSearchParams.set('year', value);
            }
        }
        navigate(`/?${newSearchParams.toString()}`);
        onCloseFilterModal();
    }, [navigate, onCloseFilterModal]);


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
            return urlCategorySlug; // Fallback nếu không tìm thấy
        }
        if (urlCountrySlug) return countries.find(c => c.slug === urlCountrySlug)?.name || urlCountrySlug;
        if (urlYear) return `Phim năm ${urlYear}`;
        return 'Danh sách phim';
    };

    // Kiểm soát spinner toàn cục: chỉ hiển thị nếu đang tải trang chính HOẶC đang tải các section TRÊN TRANG CHỦ MẶC ĐỊNH
    const showGlobalSpinner = (loadingMain && showMainMovieGrid) || (loadingSections && !showMainMovieGrid);

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
                    {movies.length === 0 && !loadingMain ? (
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
                    )}
                    {totalPages > 1 && (
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
            ) : ( // Chỉ hiển thị các section khi không có bộ lọc / tìm kiếm
                <div className="home-sections-container">
                    {/* NEW: Lịch sử đã xem */}
                    {/* `watchHistory.length > 0` đảm bảo section này chỉ hiển thị khi có dữ liệu */}
                    {watchHistory.length > 0 && (
                        <HistorySection
                            historyMovies={watchHistory}
                            onDeleteHistoryItem={handleDeleteHistoryItem}
                        />
                    )}

                    <HomePageSection
                        title="Phim Mới Cập Nhật"
                        movies={homeSectionsData.recentMovies}
                        linkToAll="/?category=phim-moi-cap-nhat&page=1"
                        isLoading={loadingSections}
                    />

                    <HomePageSection
                        title="Phim Bộ"
                        movies={homeSectionsData.seriesMovies}
                        linkToAll="/?category=phim-bo&page=1"
                        isLoading={loadingSections}
                    />
                    <HomePageSection
                        title="Phim Lẻ"
                        movies={homeSectionsData.singleMovies}
                        linkToAll="/?category=phim-le&page=1"
                        isLoading={loadingSections}
                    />
                    <HomePageSection
                        title="TV Shows"
                        movies={homeSectionsData.tvShows}
                        linkToAll="/?category=tv-shows&page=1"
                        isLoading={loadingSections}
                    />
                    <HomePageSection
                        title="Phim Thuyết Minh"
                        movies={homeSectionsData.dubbedMovies}
                        linkToAll="/?category=phim-thuyet-minh&page=1"
                        isLoading={loadingSections}
                    />
                    <HomePageSection
                        title="Hoạt Hình"
                        movies={homeSectionsData.cartoonMovies}
                        linkToAll="/?category=hoat-hinh&page=1"
                        isLoading={loadingSections}
                    />
                    <HomePageSection
                        title="Phim Lồng Tiếng"
                        movies={homeSectionsData.longTiengMovies}
                        linkToAll="/?category=phim-long-tieng&page=1"
                        isLoading={loadingSections}
                    />
                    <HomePageSection
                        title="Phim Việt Nam"
                        movies={homeSectionsData.vietnamMovies}
                        linkToAll="/?country=viet-nam&page=1"
                        isLoading={loadingSections}
                    />
                    <HomePageSection
                        title="Phim Trung Quốc"
                        movies={homeSectionsData.chinaMovies}
                        linkToAll="/?country=trung-quoc&page=1"
                        isLoading={loadingSections}
                    />
                    <HomePageSection
                        title="Phim Âu Mỹ"
                        movies={homeSectionsData.usEuMovies}
                        linkToAll="/?country=au-my&page=1"
                        isLoading={loadingSections}
                    />
                    <HomePageSection
                        title="Phim Nhật Bản"
                        movies={homeSectionsData.japanMovies}
                        linkToAll="/?country=nhat-ban&page=1"
                        isLoading={loadingSections}
                    />
                    <HomePageSection
                        title="Phim Hàn Quốc"
                        movies={homeSectionsData.koreaMovies}
                        linkToAll="/?country=han-quoc&page=1"
                        isLoading={loadingSections}
                    />
                </div>
            )}
        </div>
    );
}

export default Home;
