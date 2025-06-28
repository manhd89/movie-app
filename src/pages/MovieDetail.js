import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import { LazyLoadImage } from 'react-lazy-load-image-component';
// import Hls from 'hls.js'; // Xóa dòng này
import { FaArrowLeft, FaRegPlayCircle, FaHistory } from 'react-icons/fa';
import 'react-lazy-load-image-component/src/effects/blur.css';
import './MovieDetail.css';
import ShakaPlayerComponent from '../components/ShakaPlayerComponent'; // Import Shaka Player Component

// Ad-blocking CSS (giữ nguyên)
const adBlockCSS = `
  .bg-opacity-40.bg-white.w-full.text-center.space-x-2.bottom-0.absolute {
    display: none !important;
  }
`;

const PLAYBACK_SAVE_THRESHOLD_SECONDS = 5;
const LAST_PLAYED_KEY_PREFIX = 'lastPlayedPosition-';
const WATCH_HISTORY_KEY = 'watchHistory';
const SAVE_INTERVAL_SECONDS = 10;

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
  // const videoRef = useRef(null); // Không cần ref cho video nữa
  // const hlsInstanceRef = useRef(null); // Không cần ref cho HLS nữa
  const currentPlaybackPositionRef = useRef(0);
  const [lastViewedPosition, setLastViewedPosition] = useState(0);
  const [lastViewedEpisodeInfo, setLastViewedEpisodeInfo] = useState(null);
  const saveIntervalRef = useRef(null);
  const shakaPlayerInstanceRef = useRef(null); // Ref để giữ instance của Shaka Player

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = adBlockCSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    const fetchMovieData = async () => {
      try {
        setInitialLoading(true);
        const response = await axios.get(`/api/movie?slug=${slug}`, {
          timeout: 5000,
        });
        if (response.data && response.data.movie && response.data.episodes) {
          setMovie(response.data.movie);
          setEpisodes(response.data.episodes || []);
        } else if (response.data && response.data.item) {
            setMovie(response.data.item);
            setEpisodes(response.data.item.episodes || []);
        } else {
            console.error("Dữ liệu API không đúng định dạng:", response.data);
            setMovie(null);
            setEpisodes([]);
        }

        setInitialLoading(false);

        const history = JSON.parse(localStorage.getItem(WATCH_HISTORY_KEY) || '[]');
        const currentMovieHistory = history.find(item => item.slug === slug);
        if (currentMovieHistory) {
            setLastViewedPosition(currentMovieHistory.position);
            setLastViewedEpisodeInfo(currentMovieHistory.episode || null);
        } else {
            setLastViewedPosition(0);
            setLastViewedEpisodeInfo(null);
        }

      } catch (error) {
        console.error('Lỗi khi lấy dữ liệu phim:', error);
        setInitialLoading(false);
      }
    };
    fetchMovieData();
  }, [slug]);

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
            navigate(`/movie/${slug}`, { replace: true });
          }
        } else {
          setCurrentEpisode(null);
          setShowMovieInfoPanel(true);
          navigate(`/movie/${slug}`, { replace: true });
        }
      }
    } else if (movie && episodes.length === 0) {
      setCurrentEpisode(null);
      setShowMovieInfoPanel(true);
      if (episodeSlug) {
        navigate(`/movie/${slug}`, { replace: true });
      }
    }
  }, [movie, episodes, selectedServer, episodeSlug, navigate, slug]);

  useEffect(() => {
    localStorage.setItem(`selectedServer-${slug}`, selectedServer);
  }, [selectedServer, slug]);

  const getPlaybackPositionKey = useCallback((epSlug) => {
    return `${LAST_PLAYED_KEY_PREFIX}${slug}-${epSlug}`;
  }, [slug]);

  const saveMovieToHistory = useCallback((movieData, episodeData, position) => {
    if (!movieData || !episodeData || position < PLAYBACK_SAVE_THRESHOLD_SECONDS) return;

    const historyEntry = {
      slug: movieData.slug,
      name: movieData.name,
      origin_name: movieData.origin_name,
      poster_url: movieData.poster_url,
      year: movieData.year,
      quality: movieData.quality,
      episode_current: movieData.episode_current,
      episode: {
        slug: episodeData.slug,
        name: episodeData.name,
        server_name: episodes[selectedServer]?.server_name || 'N/A',
      },
      position: Math.floor(position),
      timestamp: Date.now(),
    };

    let history = JSON.parse(localStorage.getItem(WATCH_HISTORY_KEY) || '[]');
    history = history.filter(item => item.slug !== movieData.slug);
    history.unshift(historyEntry);
    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
    console.log(`Saved movie to history: ${movieData.name} - ${episodeData.name} at ${position}s`);
  }, [episodes, selectedServer]);


  const savePlaybackPosition = useCallback(() => {
    const video = shakaPlayerInstanceRef.current?.getVideo(); // Lấy video element từ Shaka Player
    if (video && currentEpisode && video.currentTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
      const key = getPlaybackPositionKey(currentEpisode.slug);
      localStorage.setItem(key, video.currentTime.toString());
      console.log(`Saved playback position for ${currentEpisode.name}: ${video.currentTime}s`);

      if (movie) {
        saveMovieToHistory(movie, currentEpisode, video.currentTime);
      }
    }
  }, [currentEpisode, getPlaybackPositionKey, movie, saveMovieToHistory]);

  const handleShakaTimeUpdate = useCallback((currentTime) => {
    currentPlaybackPositionRef.current = currentTime;
  }, []);

  const handleShakaEnded = useCallback(() => {
    // Xử lý khi video kết thúc
    savePlaybackPosition(); // Đảm bảo lưu lại vị trí cuối cùng
    // Có thể chuyển sang tập tiếp theo, hoặc hiển thị màn hình kết thúc
    console.log('Video ended.');
  }, [savePlaybackPosition]);

  const handleShakaPlayerReady = useCallback((player) => {
    shakaPlayerInstanceRef.current = player;
    setVideoLoading(false);

    // Bắt đầu lưu định kỳ sau khi player sẵn sàng
    if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
    }
    saveIntervalRef.current = setInterval(() => {
        const video = shakaPlayerInstanceRef.current?.getVideo();
        if (video && !video.paused) {
            savePlaybackPosition();
        }
    }, SAVE_INTERVAL_SECONDS * 1000);
    console.log(`Started periodic save every ${SAVE_INTERVAL_SECONDS} seconds.`);
  }, [savePlaybackPosition]);

  useEffect(() => {
    // Cleanup interval on unmount or episode change
    return () => {
      savePlaybackPosition(); // Lưu lần cuối trước khi rời khỏi trang/chuyển tập
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
        saveIntervalRef.current = null;
        console.log("Cleared periodic save interval.");
      }
      if (shakaPlayerInstanceRef.current) {
        shakaPlayerInstanceRef.current.destroy();
        shakaPlayerInstanceRef.current = null;
      }
    };
  }, [currentEpisode, savePlaybackPosition]);


  useEffect(() => {
    const video = shakaPlayerInstanceRef.current?.getVideo();
    if (!video) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (!video.paused) {
          video.pause();
          console.log("Video paused due to tab going into background.");
        }
        savePlaybackPosition();
      } else {
        if (video.src && !showMovieInfoPanel) {
            // Attempt to play only if video is not currently playing and we are not on info panel
            video.play().catch(error => {
                console.warn("Autoplay was prevented on visibility change:", error);
            });
            console.log("Video attempted to play due to tab coming into foreground.");
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [showMovieInfoPanel, savePlaybackPosition]);


  const handleServerChange = useCallback((index) => {
    if (episodes.length === 0) return;

    savePlaybackPosition();

    setSelectedServer(index);
    setShowMovieInfoPanel(false);

    const newServerData = episodes[index]?.server_data;
    let targetEpisode = null;

    if (newServerData && newServerData.length > 0) {
      targetEpisode = newServerData.find(ep => ep.slug === currentEpisode?.slug);
      if (!targetEpisode) {
        targetEpisode = newServerData[0];
      }
      setCurrentEpisode(targetEpisode);
      navigate(`/movie/${slug}/${targetEpisode.slug}`, { replace: true });
    } else {
      setCurrentEpisode(null);
      navigate(`/movie/${slug}`, { replace: true });
    }
  }, [slug, navigate, episodes, currentEpisode, savePlaybackPosition]);


  const handleEpisodeSelect = useCallback((episode) => {
    savePlaybackPosition();

    setCurrentEpisode(episode);
    setShowMovieInfoPanel(false);
    navigate(`/movie/${slug}/${episode.slug}`);
  }, [slug, navigate, savePlaybackPosition]);

  const handleContinueWatching = useCallback(() => {
    if (lastViewedEpisodeInfo && movie) {
        const serverIndex = episodes.findIndex(server => server.server_name === lastViewedEpisodeInfo.server_name);

        if (serverIndex !== -1) {
            setSelectedServer(serverIndex);
            const targetEpisode = episodes[serverIndex].server_data.find(ep => ep.slug === lastViewedEpisodeInfo.slug);
            if (targetEpisode) {
                setCurrentEpisode(targetEpisode);
                setShowMovieInfoPanel(false);
                navigate(`/movie/${movie.slug}/${targetEpisode.slug}`);
            } else {
                let foundOnOtherServer = false;
                for (let i = 0; i < episodes.length; i++) {
                    const ep = episodes[i].server_data.find(epData => epData.slug === lastViewedEpisodeInfo.slug);
                    if (ep) {
                        setSelectedServer(i);
                        setCurrentEpisode(ep);
                        setShowMovieInfoPanel(false);
                        navigate(`/movie/${movie.slug}/${ep.slug}`);
                        foundOnOtherServer = true;
                        break;
                    }
                }
                if (!foundOnOtherServer) {
                    console.warn("Episode not found on any server, showing movie info.");
                    setCurrentEpisode(null);
                    setShowMovieInfoPanel(true);
                    navigate(`/movie/${movie.slug}`, { replace: true });
                }
            }
        } else {
            console.warn("Server not found, showing movie info.");
            setCurrentEpisode(null);
            setShowMovieInfoPanel(true);
            navigate(`/movie/${movie.slug}`, { replace: true });
        }
    } else {
        console.warn("No last viewed episode info, showing movie info.");
        setCurrentEpisode(null);
        setShowMovieInfoPanel(true);
        navigate(`/movie/${movie.slug}`, { replace: true });
    }
  }, [episodes, lastViewedEpisodeInfo, navigate, movie]);


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

              {lastViewedPosition > PLAYBACK_SAVE_THRESHOLD_SECONDS && lastViewedEpisodeInfo && (
                <button
                  onClick={handleContinueWatching}
                  className="continue-watching-detail-button"
                  aria-label={`Tiếp tục xem ${lastViewedEpisodeInfo.name || 'Tập phim'}`}
                >
                  <FaHistory /> Tiếp tục xem{' '}
                  {lastViewedEpisodeInfo.name || `Tập cuối cùng`}
                  {' '}tại {Math.floor(lastViewedPosition / 60)} phút {Math.floor(lastViewedPosition % 60)} giây
                </button>
              )}
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
                <ShakaPlayerComponent
                  src={currentEpisode.link_m3u8}
                  onTimeUpdate={handleShakaTimeUpdate}
                  onEnded={handleShakaEnded}
                  initialPlaybackPosition={parseFloat(localStorage.getItem(getPlaybackPositionKey(currentEpisode.slug)) || 0)}
                  onPlayerReady={handleShakaPlayerReady}
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
