import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import Hls from 'hls.js';
import 'react-toastify/dist/ReactToastify.css';
import 'react-lazy-load-image-component/src/effects/blur.css';
import './MovieDetail.css';

function MovieDetail() {
  const { slug, episodeSlug } = useParams();
  const [movie, setMovie] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [selectedServer, setSelectedServer] = useState(() => {
    return parseInt(localStorage.getItem(`selectedServer-${slug}`)) || 0;
  });
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [loading, setLoading] = useState(true);
  const videoRef = useRef(null);

  useEffect(() => {
    const fetchMovie = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/phim/${slug}`, {
          timeout: 5000,
        });
        setMovie(response.data.movie);
        setEpisodes(response.data.episodes || []);

        const validServerIndex = selectedServer < response.data.episodes.length ? selectedServer : 0;
        setSelectedServer(validServerIndex);

        const episode = episodeSlug
          ? response.data.episodes[validServerIndex]?.server_data.find(
              (ep) => ep.slug === episodeSlug
            )
          : null;

        setCurrentEpisode(episode || null);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching movie:', error);
        if (error.response?.status === 404) {
          toast.error('Phim hoặc tập phim không tồn tại.');
        } else {
          toast.error('Lỗi kết nối server. Vui lòng thử lại sau.');
        }
        setLoading(false);
      }
    };
    fetchMovie();
  }, [slug, episodeSlug, selectedServer]);

  useEffect(() => {
    localStorage.setItem(`selectedServer-${slug}`, selectedServer);
  }, [selectedServer, slug]);

  useEffect(() => {
    if (currentEpisode?.link_m3u8 && videoRef.current) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(currentEpisode.link_m3u8);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            toast.error('Lỗi tải video. Vui lòng thử tập khác.');
          }
        });
        return () => hls.destroy(); // Cleanup on unmount
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (e.g., Safari)
        videoRef.current.src = currentEpisode.link_m3u8;
      } else {
        toast.error('Trình duyệt không hỗ trợ phát HLS.');
      }
    }
  }, [currentEpisode]);

  const handleServerChange = (index) => {
    setSelectedServer(index);
    setCurrentEpisode(null);
    window.history.pushState({}, '', `/movie/${slug}`);
  };

  const handleEpisodeSelect = (episode) => {
    setCurrentEpisode(episode);
    window.history.pushState({}, '', `/movie/${slug}/${episode.slug}`);
  };

  const getImageUrl = (url) => {
    if (url && url.startsWith('https://')) {
      return url;
    }
    return url ? `${process.env.REACT_APP_API_CDN_IMAGE}/${url}` : '/fallback-image.jpg';
  };

  const truncateDescription = (text, maxLength = 160) => {
    if (!text) return '';
    const stripped = text.replace(/<[^>]+>/g, '');
    return stripped.length > maxLength ? stripped.substring(0, maxLength) + '...' : stripped;
  };

  const isValidUrl = (url) => {
    try {
      new URL(url);
      return url.startsWith('https://');
    } catch {
      return false;
    }
  };

  if (loading) return <div className="container"><div className="spinner"></div></div>;
  if (!movie) return <div className="container">Phim không tồn tại.</div>;

  return (
    <div className="container">
      <Helmet>
        <title>
          {currentEpisode
            ? `${movie.name} - ${currentEpisode.name || 'Tập phim'}`
            : movie.seoOnPage?.titleHead || movie.name}
        </title>
        <meta name="description" content={movie.seoOnPage?.descriptionHead || truncateDescription(movie.content)} />
      </Helmet>
      <ToastContainer />
      <h1 className="movie-title">{movie.name}{currentEpisode ? ` - ${currentEpisode.name || 'Tập phim'}` : ''}</h1>
      <div className="movie-detail">
        {currentEpisode && isValidUrl(currentEpisode.link_m3u8) ? (
          <>
            <div className="video-player">
              <video
                ref={videoRef}
                controls
                width="100%"
                height="100%"
                aria-label={`Video player for ${currentEpisode.name || 'Tập phim'}`}
              />
            </div>
            <button
              onClick={() => {
                setCurrentEpisode(null);
                window.history.pushState({}, '', `/movie/${slug}`);
              }}
              className="back-button"
              aria-label="Quay lại thông tin phim"
            >
              Quay lại thông tin phim
            </button>
          </>
        ) : currentEpisode ? (
          <p>Video không khả dụng cho tập này.</p>
        ) : (
          <>
            <LazyLoadImage
              src={getImageUrl(movie.poster_url)}
              alt={movie.name}
              className="movie-poster"
              effect="blur"
              width="300"
              height="450"
            />
            <div className="movie-info">
              <p><strong>Tên gốc:</strong> {movie.origin_name}</p>
              <p><strong>Năm:</strong> {movie.year}</p>
              <p><strong>Thể loại:</strong> {movie.category?.map((cat) => cat.name).join(', ') || 'N/A'}</p>
              <p><strong>Quốc gia:</strong> {movie.country?.map((c) => c.name).join(', ') || 'N/A'}</p>
              <p><strong>Chất lượng:</strong> {movie.quality || 'N/A'}</p>
              <p><strong>Ngôn ngữ:</strong> {movie.lang || 'N/A'}</p>
              <p><strong>Thời lượng:</strong> {movie.time || 'N/A'}</p>
              <p><strong>Trạng thái:</strong> {movie.episode_current || 'Full'}</p>
              <p><strong>Nội dung:</strong> {movie.content || 'Không có mô tả.'}</p>
            </div>
          </>
        )}
      </div>
      {episodes.length > 0 && (
        <div className="episode-list">
          <h3>Danh sách tập</h3>
          <div className="server-list">
            <h4>Chọn server/ngôn ngữ:</h4>
            {episodes.map((server, index) => (
              <button
                key={server.server_name}
                onClick={() => handleServerChange(index)}
                className={`server-button ${index === selectedServer ? 'active' : ''}`}
                aria-label={`Chọn server ${server.server_name}`}
              >
                {server.server_name}
              </button>
            ))}
          </div>
          <div className="episodes">
            {episodes[selectedServer]?.server_data?.length > 0 ? (
              episodes[selectedServer].server_data.map((ep, index) => (
                <button
                  key={ep.slug}
                  onClick={() => handleEpisodeSelect(ep)}
                  className={`episode-button ${ep.slug === currentEpisode?.slug ? 'active' : ''}`}
                  aria-label={`Xem ${ep.name || `Tập ${index + 1}`}`}
                >
                  {ep.name || `Tập ${index + 1}`}
                </button>
              ))
            ) : (
              <p>Không có tập phim cho server này.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MovieDetail;
