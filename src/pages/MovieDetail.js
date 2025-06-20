import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import Hls from 'hls.js';
import { FaArrowLeft, FaRegPlayCircle } from 'react-icons/fa';
import 'react-toastify/dist/ReactToastify.css';
import 'react-lazy-load-image-component/src/effects/blur.css';
import './MovieDetail.css';

// Ad-blocking CSS (giữ nguyên)
const adBlockCSS = `
  .bg-opacity-40.bg-white.w-full.text-center.space-x-2.bottom-0.absolute {
    display: none !important;
  }
`;

// KHÔNG CẦN CÁC HẰNG SỐ VÀ HÀM NÀY NỮA, CHÚNG ĐÃ ĐƯỢC CHUYỂN LÊN SERVICE WORKER
// const config = { /* ... */ };
// const caches = { blob: {} };
// function getTotalDuration(playlist) { /* ... */ }
// function isContainAds(playlist) { /* ... */ }
// function getExceptionDuration(url) { /* ... */ }

// Hàm removeAds sẽ đơn giản hơn nhiều khi có Service Worker
async function removeAds(playlistUrl) {
  // Service Worker sẽ tự động chặn và xử lý request này
  return playlistUrl;
}

function MovieDetail() {
  const { slug, episodeSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [movie, setMovie] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [selectedServer, setSelectedServer] = useState(() => {
    return parseInt(localStorage.getItem(`selectedServer-${slug}`)) || 0;
  });
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [showMovieInfoPanel, setShowMovieInfoPanel] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState(false);
  const videoRef = useRef(null);
  const hlsInstanceRef = useRef(null);

  // Inject ad-blocking CSS (giữ nguyên)
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = adBlockCSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  // Effect 1: Fetch movie data. CHỈ chạy khi `slug` thay đổi.
  useEffect(() => {
    const fetchMovieData = async () => {
      try {
        setInitialLoading(true);
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/phim/${slug}`, {
          timeout: 5000,
        });
        setMovie(response.data.movie);
        setEpisodes(response.data.episodes || []);
        setInitialLoading(false);
      } catch (error) {
        console.error('Lỗi khi lấy dữ liệu phim:', error);
        if (error.response?.status === 404) {
          toast.error('Phim hoặc tập phim không tồn tại.');
        } else {
          toast.error('Lỗi kết nối server. Vui lòng thử lại sau.');
        }
        setInitialLoading(false);
      }
    };
    fetchMovieData();
  }, [slug]);

  // Effect 2: Cập nhật currentEpisode và `showMovieInfoPanel` ban đầu
  useEffect(() => {
    if (movie && episodes.length > 0) {
      const validServerIndex = selectedServer < episodes.length ? selectedServer : 0;
      setSelectedServer(validServerIndex);

      const serverData = episodes[validServerIndex]?.server_data;

      if (!episodeSlug) {
        setShowMovieInfoPanel(true);
        setCurrentEpisode(null);
      } else {
        if (serverData && serverData.length > 0) {
          const episodeToLoad = serverData.find((ep) => ep.slug === episodeSlug);
          if (episodeToLoad) {
            setCurrentEpisode(episodeToLoad);
            setShowMovieInfoPanel(false);
          } else {
            setCurrentEpisode(null);
            setShowMovieInfoPanel(true);
            toast.warn('Tập phim không tồn tại trên server này. Đã quay lại trang chi tiết.');
            navigate(`/movie/${slug}`, { replace: true });
          }
        } else {
          setCurrentEpisode(null);
          setShowMovieInfoPanel(true);
          toast.warn('Server hoặc tập phim không tồn tại. Đã quay lại trang chi tiết.');
          navigate(`/movie/${slug}`, { replace: true });
        }
      }
    } else if (movie && episodes.length === 0) {
      setCurrentEpisode(null);
      setShowMovieInfoPanel(true);
      toast.info('Bộ phim này hiện chưa có tập nào.');
      if (episodeSlug) {
        navigate(`/movie/${slug}`, { replace: true });
      }
    }
  }, [movie, episodes, selectedServer, episodeSlug, navigate, slug]);

  // Effect 3: Persist selected server (giữ nguyên)
  useEffect(() => {
    localStorage.setItem(`selectedServer-${slug}`, selectedServer);
  }, [selectedServer, slug]);

  // Effect 4: Handle video playback with HLS.js. CHỈ chạy khi `currentEpisode` thay đổi
  const loadVideo = useCallback(async () => {
    if (showMovieInfoPanel || !currentEpisode?.link_m3u8 || !videoRef.current) {
        setVideoLoading(false);
        if (videoRef.current) {
            videoRef.current.src = '';
            videoRef.current.removeAttribute('src');
            videoRef.current.load();
        }
        if (!showMovieInfoPanel && currentEpisode && !isValidUrl(currentEpisode.link_m3u8)) {
            toast.error('Video không khả dụng cho tập này.');
        }
        return;
    }

    const video = videoRef.current;
    setVideoLoading(true);

    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
    }

    try {
      // Gọi hàm removeAds để lấy URL gốc
      const originalM3u8Url = await removeAds(currentEpisode.link_m3u8);

      if (Hls.isSupported()) {
        const hls = new Hls();
        hlsInstanceRef.current = hls;
        hls.loadSource(originalM3u8Url); // HLS.js sẽ fetch từ URL gốc, Service Worker sẽ chặn và xử lý
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setVideoLoading(false);
          video.play().catch(error => {
            console.warn("Autoplay was prevented:", error);
            // Optionally: Show a user prompt to click play if autoplay failed
            // toast.info("Vui lòng nhấn nút phát để tiếp tục xem video.");
          });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS.js error:', data);
          setVideoLoading(false);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                toast.error('Lỗi mạng khi tải video. Vui lòng kiểm tra kết nối.');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                toast.error('Lỗi phát video. Có thể do định dạng không hỗ trợ.');
                hls.recoverMediaError();
                break;
              default:
                toast.error('Lỗi video nghiêm trọng. Vui lòng thử tập khác.');
                hls.destroy();
                break;
            }
          }
        });

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Đối với trình duyệt hỗ trợ HLS native, nó cũng sẽ fetch từ URL gốc, Service Worker sẽ xử lý
        video.src = originalM3u8Url;
        video.play().catch(error => console.warn("Autoplay was prevented (native):", error));
        setVideoLoading(false);
      } else {
        toast.error('Trình duyệt không hỗ trợ phát HLS. Vui lòng cập nhật.');
        setVideoLoading(false);
      }
    } catch (error) {
      console.error('Error loading video:', error);
      setVideoLoading(false);
      toast.error('Không thể tải video: ' + error.message);
    }
  }, [currentEpisode, showMovieInfoPanel]);

  useEffect(() => {
    loadVideo();
    return () => {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      // Không cần URL.revokeObjectURL cho Blob URL nữa vì chúng ta không dùng chúng
      if (videoRef.current) {
        videoRef.current.src = '';
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
    };
  }, [currentEpisode, loadVideo]);

  // --- NEW EFFECT: Handle page visibility for video playback ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      const video = videoRef.current;
      // If the document is visible, a video is loaded, and it's not currently playing
      // then try to play it.
      if (document.visibilityState === 'visible' && video && !video.paused) {
        video.play().catch(error => {
          console.warn("Autoplay was prevented on visibility change:", error);
          // Only show toast if user expects autoplay and it fails
          if (!video.muted) { // If video is not muted, autoplay will likely fail
             toast.info("Vui lòng nhấn nút phát để tiếp tục xem video.");
          }
        });
      }
    };

    // Add event listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Clean up event listener when component unmounts
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // Empty dependency array means this effect runs once on mount and cleans up on unmount


  // handleServerChange: Chuyển server, cố gắng giữ tập hiện tại hoặc chọn tập đầu tiên của server mới.
  // Luôn hiển thị player.
  const handleServerChange = useCallback((index) => {
    if (episodes.length === 0) return;

    setSelectedServer(index);
    setShowMovieInfoPanel(false);

    const newServerData = episodes[index]?.server_data;
    let targetEpisode = null;

    if (newServerData && newServerData.length > 0) {
      targetEpisode = newServerData.find(ep => ep.slug === currentEpisode?.slug);
      if (!targetEpisode) {
        targetEpisode = newServerData[0];
        toast.info('Tập hiện tại không có trên server này. Đã chuyển sang tập đầu tiên.');
      }
      setCurrentEpisode(targetEpisode);
      navigate(`/movie/${slug}/${targetEpisode.slug}`, { replace: true });
    } else {
      setCurrentEpisode(null);
      toast.warn('Server này không có tập phim nào.');
      navigate(`/movie/${slug}`, { replace: true });
    }
  }, [slug, navigate, episodes, currentEpisode]);

  // handleEpisodeSelect: Chọn một tập cụ thể. Luôn hiển thị player.
  const handleEpisodeSelect = useCallback((episode) => {
    setCurrentEpisode(episode);
    setShowMovieInfoPanel(false);
    navigate(`/movie/${slug}/${episode.slug}`);
  }, [slug, navigate]);

  // Các hàm tiện ích khác (giữ nguyên)
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

  if (initialLoading) {
    return (
      <div className="container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!movie) {
    return <div className="container">Phim không tồn tại.</div>;
  }

  return (
    <div className="container">
      <Helmet>
        <title>
          {currentEpisode
            ? `${movie.name} - ${currentEpisode.name || 'Tập phim'}`
            : movie.seoOnPage?.titleHead || movie.name}
        </title>
        <meta
          name="description"
          content={movie.seoOnPage?.descriptionHead || truncateDescription(movie.content)}
        />
      </Helmet>
      <ToastContainer />
      <h1 className="movie-title">
        {movie.name}
        {currentEpisode && ` - ${currentEpisode.name || 'Tập phim'}`}
      </h1>
      <div className="movie-detail">
        {showMovieInfoPanel ? (
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
              <p>
                <strong>Thể loại:</strong>{' '}
                {movie.category?.map((cat) => cat.name).join(', ') || 'N/A'}
              </p>
              <p>
                <strong>Quốc gia:</strong>{' '}
                {movie.country?.map((c) => c.name).join(', ') || 'N/A'}
              </p>
              <p><strong>Chất lượng:</strong> {movie.quality || 'N/A'}</p>
              <p><strong>Ngôn ngữ:</strong> {movie.lang || 'N/A'}</p>
              <p><strong>Thời lượng:</strong> {movie.time || 'N/A'}</p>
              <p><strong>Trạng thái:</strong> {movie.episode_current || 'Full'}</p>
              <p><strong>Nội dung:</strong> {movie.content || 'Không có mô tả.'}</p>
            </div>
          </>
        ) : (
          <>
            <div className="video-player">
              {videoLoading && (
                <div className="video-overlay-spinner">
                  <div className="spinner"></div>
                </div>
              )}
              {currentEpisode && isValidUrl(currentEpisode.link_m3u8) ? (
                <video
                  ref={videoRef}
                  controls
                  width="100%"
                  height="100%"
                  aria-label={`Video player for ${currentEpisode.name || 'Tập phim'}`}
                  className={videoLoading ? 'hidden-video' : ''}
                />
              ) : (
                <div className="video-error-message" style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#fff',
                    fontSize: '1.2rem',
                    textAlign: 'center',
                    padding: '20px',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    borderRadius: '8px',
                    zIndex: 5
                }}>
                    <p>Video không khả dụng cho tập này.</p>
                    <FaRegPlayCircle style={{ fontSize: '3rem', marginTop: '10px' }} />
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setShowMovieInfoPanel(true);
                setCurrentEpisode(null);
                navigate(`/movie/${slug}`, { replace: true });
              }}
              className="back-button"
              aria-label="Quay lại thông tin phim"
            >
              <FaArrowLeft className="icon" /> Quay lại thông tin phim
            </button>
          </>
        )}
      </div>
      {episodes.length > 0 && (
        <div className="episode-list">
          <h3>Danh sách tập</h3>
          <div className="server-list">
            {episodes.map((server, index) => (
              <button
                key={server.server_name}
                onClick={() => handleServerChange(index)}
                className={`server-button ${index === selectedServer ? 'active' : ''}`}
                aria-label={`Chọn server ${server.server_name}`}
              >
                <FaRegPlayCircle className="icon" /> {server.server_name}
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
