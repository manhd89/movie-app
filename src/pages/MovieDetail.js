import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import Hls from 'hls.js';
import { FaArrowLeft, FaRegPlayCircle, FaPlay } from 'react-icons/fa';
import 'react-lazy-load-image-component/src/effects/blur.css';
import './MovieDetail.css';

// Ad-blocking CSS
const adBlockCSS = `
  .bg-opacity-40.bg-white.w-full.text-center.space-x-2.bottom-0.absolute {
    display: none !important;
  }
`;

async function removeAds(playlistUrl) {
  return playlistUrl;
}

const PLAYBACK_SAVE_THRESHOLD_SECONDS = 5;
const LAST_PLAYED_KEY_PREFIX = 'lastPlayedPosition-';
const HISTORY_KEY = 'movieHistory';

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
  const currentPlaybackPositionRef = useRef(0);

  // Check if there's a saved playback position for the current episode
  const hasSavedPlayback = useCallback(() => {
    if (!currentEpisode) return false;
    const key = `${LAST_PLAYED_KEY_PREFIX}${slug}-${currentEpisode.slug}`;
    const savedTime = parseFloat(localStorage.getItem(key));
    return !isNaN(savedTime) && savedTime > PLAYBACK_SAVE_THRESHOLD_SECONDS;
  }, [currentEpisode, slug]);

  // Save movie to history
  const saveToHistory = useCallback(() => {
    if (!movie || !currentEpisode || currentPlaybackPositionRef.current <= PLAYBACK_SAVE_THRESHOLD_SECONDS) return;

    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const newEntry = {
      _id: movie._id,
      slug: movie.slug,
      name: movie.name,
      poster_url: movie.poster_url,
      year: movie.year,
      episode_slug: currentEpisode.slug,
      episode_name: currentEpisode.name || 'Tập phim',
      playback_position: currentPlaybackPositionRef.current,
      timestamp: Date.now(),
    };

    // Remove existing entry for this movie to update it
    const updatedHistory = history.filter(item => item.slug !== movie.slug || item.episode_slug !== currentEpisode.slug);
    updatedHistory.unshift(newEntry); // Add to the start
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory.slice(0, 50))); // Limit to 50 entries
  }, [movie, currentEpisode]);

  // Inject ad-blocking CSS
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = adBlockCSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  // Fetch movie data
  useEffect(() => {
    const fetchMovieData = async () => {
      try {
        setInitialLoading(true);
        const response = await axios.get(`/api/movie?slug=${slug}`, {
          timeout: 5000,
        });
        setMovie(response.data.movie);
        setEpisodes(response.data.episodes || []);
        setInitialLoading(false);
      } catch (error) {
        console.error('Lỗi khi lấy dữ liệu phim:', error);
        setInitialLoading(false);
      }
    };
    fetchMovieData();
  }, [slug]);

  // Update currentEpisode and showMovieInfoPanel
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

  // Persist selected server
  useEffect(() => {
    localStorage.setItem(`selectedServer-${slug}`, selectedServer);
  }, [selectedServer, slug]);

  const getPlaybackPositionKey = useCallback((epSlug) => {
    return `${LAST_PLAYED_KEY_PREFIX}${slug}-${epSlug}`;
  }, [slug]);

  const savePlaybackPosition = useCallback(() => {
    const video = videoRef.current;
    if (video && currentEpisode && video.currentTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
      const key = getPlaybackPositionKey(currentEpisode.slug);
      localStorage.setItem(key, video.currentTime.toString());
      currentPlaybackPositionRef.current = video.currentTime;
      saveToHistory(); // Save to history when playback position is saved
    }
  }, [currentEpisode, getPlaybackPositionKey, saveToHistory]);

  const loadVideo = useCallback(async () => {
    const video = videoRef.current;
    if (showMovieInfoPanel || !currentEpisode?.link_m3u8 || !video) {
      setVideoLoading(false);
      if (video) {
        video.src = '';
        video.removeAttribute('src');
        video.load();
      }
      if (!showMovieInfoPanel && currentEpisode && !isValidUrl(currentEpisode.link_m3u8)) {
        console.error('Video không khả dụng cho tập này.');
      }
      return;
    }

    setVideoLoading(true);

    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
    }

    try {
      const originalM3u8Url = await removeAds(currentEpisode.link_m3u8);

      if (Hls.isSupported()) {
        const hls = new Hls({
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          maxBufferSize: 60 * 1000 * 1000,
          startFragPrefetch: true,
          enableWorker: true,
        });
        hlsInstanceRef.current = hls;
        hls.loadSource(originalM3u8Url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setVideoLoading(false);
          const savedPositionKey = getPlaybackPositionKey(currentEpisode.slug);
          const savedTime = parseFloat(localStorage.getItem(savedPositionKey));

          if (!isNaN(savedTime) && savedTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
            video.currentTime = savedTime;
            console.log(`Restored playback position for ${currentEpisode.name}: ${savedTime}s`);
          } else {
            video.currentTime = 0;
          }

          video.play().catch(error => {
            console.warn("Autoplay was prevented:", error);
          });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS.js error:', data);
          setVideoLoading(false);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('Lỗi mạng khi tải video.');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('Lỗi phát video.');
                hls.recoverMediaError();
                break;
              default:
                console.error('Lỗi video nghiêm trọng.');
                hls.destroy();
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = originalM3u8Url;
        const savedPositionKey = getPlaybackPositionKey(currentEpisode.slug);
        const savedTime = parseFloat(localStorage.getItem(savedPositionKey));

        video.onloadedmetadata = () => {
          if (!isNaN(savedTime) && savedTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
            video.currentTime = savedTime;
            console.log(`Restored playback position (native) for ${currentEpisode.name}: ${savedTime}s`);
          } else {
            video.currentTime = 0;
          }
          setVideoLoading(false);
          video.play().catch(error => console.warn("Autoplay was prevented (native):", error));
        };
      } else {
        console.error('Trình duyệt không hỗ trợ phát HLS.');
        setVideoLoading(false);
      }
    } catch (error) {
      console.error('Error loading video:', error);
      setVideoLoading(false);
    }
  }, [currentEpisode, showMovieInfoPanel, getPlaybackPositionKey]);

  useEffect(() => {
    loadVideo();
    return () => {
      savePlaybackPosition();
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.src = '';
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
    };
  }, [currentEpisode, loadVideo, savePlaybackPosition]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVideoPause = () => {
      savePlaybackPosition();
    };

    const handleTimeUpdate = () => {
      currentPlaybackPositionRef.current = video.currentTime;
    };

    video.addEventListener('pause', handleVideoPause);
    video.addEventListener('timeupdate', handleTimeUpdate);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (!video.paused) {
          video.pause();
          console.log("Video paused due to tab going into background.");
        }
        savePlaybackPosition();
      } else {
        if (video.src && !showMovieInfoPanel) {
          if (hlsInstanceRef.current && hlsInstanceRef.current.media && hlsInstanceRef.current.media.readyState < 4) {
            console.log("Attempting to recover HLS.js media error on foreground.");
            hlsInstanceRef.current.recoverMediaError();
            hlsInstanceRef.current.startLoad();
          }
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
      video.removeEventListener('pause', handleVideoPause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
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
              {hasSavedPlayback() && (
                <button
                  onClick={() => {
                    const serverData = episodes[selectedServer]?.server_data;
                    const lastEpisode = serverData.find(ep => ep.slug === episodeSlug) || serverData[0];
                    if (lastEpisode) {
                      setCurrentEpisode(lastEpisode);
                      setShowMovieInfoPanel(false);
                      navigate(`/movie/${slug}/${lastEpisode.slug}`);
                    }
                  }}
                  className="continue-watching-button"
                  aria-label={`Tiếp tục xem ${movie.name} - ${currentEpisode?.name || 'Tập phim'}`}
                >
                  <FaPlay className="icon" /> Tiếp tục xem
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
                <video
                  ref={videoRef}
                  controls
                  width="100%"
                  height="100%"
                  aria-label={`Video player for ${movie.name} - ${currentEpisode.name || 'Tập phim'}`}
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
              <FaArrowLeft className="icon" aria-hidden="true" /> Quay lại thông tin phim
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
                <FaRegPlayCircle className="icon" aria-hidden="true" /> {server.server_name}
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
