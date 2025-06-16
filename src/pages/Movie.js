import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-toastify/dist/ReactToastify.css';
import 'react-lazy-load-image-component/src/effects/blur.css';
import './Movie.css';

function Movie() {
  const { slug } = useParams();
  const [movie, setMovie] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [selectedServer, setSelectedServer] = useState(() => {
    // Lấy server đã chọn từ localStorage, mặc định là 0 nếu chưa có
    return parseInt(localStorage.getItem(`selectedServer-${slug}`)) || 0;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMovie = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/phim/${slug}`);
        setMovie(response.data.movie);
        setEpisodes(response.data.episodes);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching movie:', error);
        toast.error('Lỗi khi tải thông tin phim.');
        setLoading(false);
      }
    };
    fetchMovie();
  }, [slug]);

  useEffect(() => {
    // Lưu server đã chọn vào localStorage khi selectedServer thay đổi
    localStorage.setItem(`selectedServer-${slug}`, selectedServer);
  }, [selectedServer, slug]);

  if (loading) return <div className="container">Loading...</div>;
  if (!movie) return <div className="container">Phim không tồn tại.</div>;

  const getImageUrl = (url) => {
    if (url && url.startsWith('https://')) {
      return url;
    }
    return `${process.env.REACT_APP_API_CDN_IMAGE}/${url}`;
  };

  return (
    <div className="container">
      <Helmet>
        <title>{movie.seoOnPage?.titleHead || movie.name}</title>
        <meta name="description" content={movie.seoOnPage?.descriptionHead || movie.content} />
      </Helmet>
      <ToastContainer />
      <div className="movie-detail">
        <LazyLoadImage
          src={getImageUrl(movie.poster_url)}
          alt={movie.name}
          className="movie-poster"
          effect="blur"
        />
        <div className="movie-info">
          <h1>{movie.name}</h1>
          <p><strong>Tên gốc:</strong> {movie.origin_name}</p>
          <p><strong>Năm:</strong> {movie.year}</p>
          <p><strong>Thể loại:</strong> {movie.category.map((cat) => cat.name).join(', ')}</p>
          <p><strong>Quốc gia:</strong> {movie.country.map((c) => c.name).join(', ')}</p>
          <p><strong>Chất lượng:</strong> {movie.quality || 'N/A'}</p>
          <p><strong>Ngôn ngữ:</strong> {movie.lang || 'N/A'}</p>
          <p><strong>Thời lượng:</strong> {movie.time || 'N/A'}</p>
          <p><strong>Trạng thái:</strong> {movie.episode_current || 'Full'}</p>
          <p><strong>Nội dung:</strong> {movie.content || 'Không có mô tả.'}</p>
          <div className="episode-list">
            <h3>Danh sách tập</h3>
            <div className="server-list">
              <h4>Chọn server/ngôn ngữ:</h4>
              {episodes.map((server, index) => (
                <button
                  key={server.server_name}
                  onClick={() => setSelectedServer(index)}
                  className={`server-button ${index === selectedServer ? 'active' : ''}`}
                >
                  {server.server_name}
                </button>
              ))}
            </div>
            <div className="episodes">
              {episodes[selectedServer]?.server_data.map((ep, index) => (
                <Link
                  key={ep.slug}
                  to={`/watch/${movie.slug}/${ep.slug}`}
                  className="episode-button"
                >
                  {ep.name || `Tập ${index + 1}`}
                </Link>
              )) || <p>Không có tập phim.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Movie;
