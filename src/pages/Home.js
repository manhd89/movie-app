import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import Select from 'react-select';
import { ToastContainer, toast } from 'react-toastify';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-toastify/dist/ReactToastify.css';
import 'react-lazy-load-image-component/src/effects/blur.css';
import './Home.css';

function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page')) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [category, setCategory] = useState(searchParams.get('category') || 'phim-moi-cap-nhat');
  const [keyword, setKeyword] = useState(searchParams.get('keyword') || '');
  const [filterCategories, setFilterCategories] = useState(
    searchParams.get('filterCategory')?.split(',').filter(Boolean) || []
  );
  const [filterCountries, setFilterCountries] = useState(
    searchParams.get('filterCountry')?.split(',').filter(Boolean) || []
  );
  const [filterYear, setFilterYear] = useState(searchParams.get('filterYear') || '');
  const [genres, setGenres] = useState([]);
  const [countries, setCountries] = useState([]);
  const [seoData, setSeoData] = useState({
    titleHead: 'PhimAPI - Phim Mới Cập Nhật',
    descriptionHead: 'Xem phim mới cập nhật nhanh nhất'
  });

  const categories = [
    { slug: 'phim-moi-cap-nhat', name: 'Phim Mới Cập Nhật' },
    { slug: 'phim-bo', name: 'Phim Bộ' },
    { slug: 'phim-le', name: 'Phim Lẻ' },
    { slug: 'tv-shows', name: 'TV Shows' },
    { slug: 'hoat-hinh', name: 'Hoạt Hình' },
    { slug: 'phim-vietsub', name: 'Phim Vietsub' },
    { slug: 'phim-thuyet-minh', name: 'Phim Thuyết Minh' },
    { slug: 'phim-long-tieng', name: 'Phim Lồng Tiếng' },
  ];

  const years = Array.from({ length: 6 }, (_, i) => ({
    value: (2025 - i).toString(),
    label: (2025 - i).toString()
  }));

  // Tùy chỉnh styles cho react-select
  const customSelectStyles = {
    control: (provided) => ({
      ...provided,
      backgroundColor: '#333',
      borderColor: '#555',
      color: '#fff',
      boxShadow: 'none',
      '&:hover': {
        borderColor: '#007bff'
      }
    }),
    input: (provided) => ({
      ...provided,
      color: '#fff'
    }),
    placeholder: (provided) => ({
      ...provided,
      color: '#ccc'
    }),
    singleValue: (provided) => ({
      ...provided,
      color: '#fff'
    }),
    multiValue: (provided) => ({
      ...provided,
      backgroundColor: '#007bff'
    }),
    multiValueLabel: (provided) => ({
      ...provided,
      color: '#fff'
    }),
    multiValueRemove: (provided) => ({
      ...provided,
      color: '#fff',
      '&:hover': {
        backgroundColor: '#0056b3',
        color: '#fff'
      }
    })
  };

  // Đồng bộ searchParams với state
  useEffect(() => {
    setKeyword(searchParams.get('keyword') || '');
    setCategory(searchParams.get('category') || 'phim-moi-cap-nhat');
    setCurrentPage(parseInt(searchParams.get('page')) || 1);
    setFilterCategories(searchParams.get('filterCategory')?.split(',').filter(Boolean) || []);
    setFilterCountries(searchParams.get('filterCountry')?.split(',').filter(Boolean) || []);
    setFilterYear(searchParams.get('filterYear') || '');
  }, [searchParams]);

  // Lấy danh sách thể loại và quốc gia
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [genreRes, countryRes] = await Promise.all([
          axios.get(`https://phimapi.com/the-loai`),
          axios.get(`https://phimapi.com/quoc-gia`)
        ]);
        setGenres(genreRes.data);
        setCountries(countryRes.data);
        localStorage.setItem('genres', JSON.stringify(genreRes.data));
        localStorage.setItem('countries', JSON.stringify(countryRes.data));
      } catch (error) {
        console.error('Error fetching filters:', error);
        toast.error('Không thể tải danh sách bộ lọc.');
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
  }, []);

  // Lấy danh sách phim
  useEffect(() => {
    const fetchMovies = async () => {
      try {
        setLoading(true);
        let url, params = { page: currentPage };
        let response;

        if (keyword) {
          url = `https://phimapi.com/v1/api/tim-kiem`;
          params.keyword = keyword;
          if (filterCategories.length) params.filterCategory = filterCategories.join(',');
          if (filterCountries.length) params.filterCountry = filterCountries.join(',');
          if (filterYear) params.filterYear = filterYear;
          response = await axios.get(url, { params });
          const data = response.data.data;
          setMovies(data.items || []);
          setTotalPages(data.params?.pagination?.totalPages || 1);
          setSeoData(data.seoOnPage || {
            titleHead: `Tìm kiếm: ${keyword}`,
            descriptionHead: `Kết quả tìm kiếm phim cho từ khóa ${keyword}`
          });
        } else if (category === 'phim-moi-cap-nhat') {
          url = `https://phimapi.com/danh-sach/phim-moi-cap-nhat`;
          response = await axios.get(url, { params });
          setMovies(response.data.items || []);
          setTotalPages(response.data.pagination?.totalPages || 1);
          setSeoData({
            titleHead: 'Phim Mới Cập Nhật 2025',
            descriptionHead: 'Xem phim mới cập nhật nhanh nhất.'
          });
        } else if (filterCategories.length === 1 && !filterCountries.length && !filterYear) {
          url = `https://phimapi.com/v1/api/the-loai/${filterCategories[0]}`;
          response = await axios.get(url, { params });
          setMovies(response.data.data?.items || []);
          setTotalPages(response.data.data?.params?.pagination?.totalPages || 1);
          setSeoData(response.data.data?.seoOnPage || seoData);
        } else if (filterCountries.length === 1 && !filterCategories.length && !filterYear) {
          url = `https://phimapi.com/v1/api/quoc-gia/${filterCountries[0]}`;
          response = await axios.get(url, { params });
          setMovies(response.data.data?.items || []);
          setTotalPages(response.data.data?.params?.pagination?.totalPages || 1);
          setSeoData(response.data.data?.seoOnPage || seoData);
        } else {
          url = `https://phimapi.com/v1/api/danh-sach/${category}`;
          if (filterCategories.length) params.filterCategory = filterCategories.join(',');
          if (filterCountries.length) params.filterCountry = filterCountries.join(',');
          if (filterYear) params.filterYear = filterYear;
          response = await axios.get(url, { params });
          setMovies(response.data.data?.items || []);
          setTotalPages(response.data.data?.params?.pagination?.totalPages || 1);
          setSeoData(response.data.data?.seoOnPage || seoData);
        }

        if (!response.data.data?.items?.length && !response.data.items?.length) {
          toast.warn('Không tìm thấy phim nào phù hợp.');
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching movies:', error);
        toast.error('Lỗi khi tải danh sách phim.');
        setMovies([]);
        setTotalPages(1);
        setLoading(false);
      }
    };
    fetchMovies();
  }, [category, keyword, filterCategories, filterCountries, filterYear, currentPage]);

  const handleCategoryChange = (newCategory) => {
    setCategory(newCategory);
    setKeyword('');
    setFilterCategories([]);
    setFilterCountries([]);
    setFilterYear('');
    setCurrentPage(1);
    setSearchParams({ category: newCategory, page: '1' });
  };

  const handleFilterChange = (type, selected) => {
    const newParams = { category, page: '1' };
    if (keyword) newParams.keyword = keyword;
    if (type === 'categories') {
      const values = selected ? selected.map(opt => opt.value).filter(Boolean) : [];
      setFilterCategories(values);
      if (values.length) newParams.filterCategory = values.join(',');
    } else if (type === 'countries') {
      const values = selected ? selected.map(opt => opt.value).filter(Boolean) : [];
      setFilterCountries(values);
      if (values.length) newParams.filterCountry = values.join(',');
    } else if (type === 'year') {
      setFilterYear(selected ? selected.value : '');
      if (selected) newParams.filterYear = selected.value;
    }
    setCurrentPage(1);
    setSearchParams(newParams);
  };

  const handleResetFilters = () => {
    setFilterCategories([]);
    setFilterCountries([]);
    setFilterYear('');
    setCurrentPage(1);
    setSearchParams({ category, page: '1', ...(keyword && { keyword }) });
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      const params = { category, page: newPage.toString() };
      if (keyword) params.keyword = keyword;
      if (filterCategories.length) params.filterCategory = filterCategories.join(',');
      if (filterCountries.length) params.filterCountry = filterCountries.join(',');
      if (filterYear) params.filterYear = filterYear;
      setSearchParams(params);
    }
  };

  const getImageUrl = (url) => {
    if (url && url.startsWith('https://')) {
      return url;
    }
    return `https://phimimg.com/${url}`;
  };

  // Modified loading return statement
  if (loading) return <div className="container"><div className="spinner"></div></div>;

  return (
    <div className="container">
      <Helmet>
        <title>{seoData.titleHead}</title>
        <meta name="description" content={seoData.descriptionHead} />
      </Helmet>
      <ToastContainer />
      <h1>{keyword ? `Tìm kiếm: ${keyword}` : categories.find(cat => cat.slug === category)?.name || 'Phim Mới Cập Nhật'}</h1>
      <div className="category-selector">
        {categories.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => handleCategoryChange(cat.slug)}
            className={category === cat.slug && !keyword ? 'active' : ''}
          >
            {cat.name}
          </button>
        ))}
      </div>
      <div className="filter-container">
        <Select
          isMulti
          options={[{ value: '', label: 'Tất cả thể loại' }, ...genres.map(g => ({ value: g.slug, label: g.name }))]}
          value={filterCategories.map(slug => ({ value: slug, label: genres.find(g => g.slug === slug)?.name || '' }))}
          onChange={(selected) => handleFilterChange('categories', selected)}
          placeholder="Chọn thể loại..."
          isDisabled={category === 'phim-moi-cap-nhat' && !keyword}
          className="filter-select"
          styles={customSelectStyles}
        />
        <Select
          isMulti
          options={[{ value: '', label: 'Tất cả quốc gia' }, ...countries.map(c => ({ value: c.slug, label: c.name }))]}
          value={filterCountries.map(slug => ({ value: slug, label: countries.find(c => c.slug === slug)?.name || '' }))}
          onChange={(selected) => handleFilterChange('countries', selected)}
          placeholder="Chọn quốc gia..."
          isDisabled={category === 'phim-moi-cap-nhat' && !keyword}
          className="filter-select"
          styles={customSelectStyles}
        />
        <Select
          options={[{ value: '', label: 'Tất cả năm' }, ...years]}
          value={filterYear ? { value: filterYear, label: filterYear } : { value: '', label: 'Tất cả năm' }}
          onChange={(selected) => handleFilterChange('year', selected)}
          placeholder="Chọn năm..."
          isDisabled={category === 'phim-moi-cap-nhat' && !keyword}
          className="filter-select"
          styles={customSelectStyles}
        />
        <button onClick={handleResetFilters} className="reset-button">Xóa bộ lọc</button>
      </div>
      {movies.length === 0 ? (
        <p>Không tìm thấy phim nào.</p>
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
              {(keyword || category !== 'phim-moi-cap-nhat') && (
                <>
                  {movie.quality && <p>Chất lượng: {movie.quality}</p>}
                  {movie.lang && <p>Ngôn ngữ: {movie.lang}</p>}
                  {movie.episode_current && <p>Tập: {movie.episode_current}</p>}
                  {movie.category && movie.category.length > 0 && (
                    <p>Thể loại: {movie.category.map(cat => cat.name).join(', ')}</p>
                  )}
                  {movie.country && movie.country.length > 0 && (
                    <p>Quốc gia: {movie.country.map(c => c.name).join(', ')}</p>
                  )}
                </>
              )}
            </Link>
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default Home;
