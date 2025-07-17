import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import Hls from 'hls.js';
import { FaArrowLeft, FaRegPlayCircle, FaHistory } from 'react-icons/fa';
import { debounce } from 'lodash';
import 'react-lazy-load-image-component/src/effects/blur.css';
import './MovieDetail.css';

const PLAYBACK_SAVE_THRESHOLD_SECONDS = 5;
const LAST_PLAYED_KEY_PREFIX = 'lastPlayedPosition-';
const WATCH_HISTORY_KEY = 'watchHistory';
const SAVE_INTERVAL_SECONDS = 10;

function MovieDetail() {
  const { slug, episodeSlug } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [selectedServer, setSelectedServer] = useState(0); // Single server assumption
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [showMovieInfoPanel, setShowMovieInfoPanel] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState(false);
  const videoRef = useRef(null);
  const hlsInstanceRef = useRef(null);
  const saveIntervalRef = useRef(null);
  const [lastViewedPosition, setLastViewedPosition] = useState(0);
  const [lastViewedEpisodeInfo, setLastViewedEpisodeInfo] = useState(null);

  useEffect(() => {
    const fetchMovieData = async () => {
      setInitialLoading(true);
      const response = await axios.get(`/api/movie?slug=${slug}`);
      setMovie(response.data.movie);
      setEpisodes(response.data.episodes);
      setInitialLoading(false);

      const history = JSON.parse(localStorage.getItem(WATCH_HISTORY_KEY) || '[]');
      const currentMovieHistory = history.find(item => item.slug === slug);
      if (currentMovieHistory) {
        setLastViewedPosition(currentMovieHistory.position);
        setLastViewedEpisodeInfo(currentMovieHistory.episode || null);
      }
    };
    fetchMovieData();
  }, [slug]);

  useEffect(() => {
    if (movie && episodes.length > 0) {
      const serverData = episodes[0].server_data; // Single server
      if (!episodeSlug) {
        setShowMovieInfoPanel(true);
        setCurrentEpisode(null);
      } else {
        const episodeToLoad = serverData.find((ep) => ep.slug === episodeSlug);
        if (episodeToLoad) {
          setCurrentEpisode(episodeToLoad);
          setShowMovieInfoPanel(false);
        } else {
          setCurrentEpisode(null);
          setShowMovieInfoPanel(true);
          navigate(`/movie/${slug}`, { replace: true });
        }
      }
    }
  }, [movie, episodes, episodeSlug, navigate, slug]);

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
        server_name: episodes[0]?.server_name || '#Hà Nội (Vietsub)',
      },
      position: Math.floor(position),
      timestamp: Date.now(),
    };

    let history = JSON.parse(localStorage.getItem(WATCH_HISTORY_KEY) || '[]');
    history = history.filter(item => item.slug !== movieData.slug);
    history.unshift(historyEntry);
    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
  }, [episodes]);

  const savePlaybackPosition = useCallback(() => {
    const video = videoRef.current;
    if (video && currentEpisode && video.currentTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
      const key = getPlaybackPositionKey(currentEpisode.slug);
      localStorage.setItem(key, video.currentTime.toString());
      if (movie) {
        saveMovieToHistory(movie, currentEpisode, video.currentTime);
      }
    }
  }, [currentEpisode, getPlaybackPositionKey, movie, saveMovieToHistory]);

  const debouncedSavePlayback = useCallback(
    debounce(savePlaybackPosition, SAVE_INTERVAL_SECONDS * 1000),
    [savePlaybackPosition]
  );

  const loadVideo = useCallback(() => {
    const video = videoRef.current;
    if (showMovieInfoPanel || !currentEpisode?.link_m3u8 || !video) {
      setVideoLoading(false);
      if (video) {
        video.src = '';
        video.removeAttribute('src');
        video.load();
      }
      return;
    }

    setVideoLoading(true);

    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }

    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
    }

    const originalM3u8Url = currentEpisode.link_m3u8;

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        maxBufferSize: 100 * 1000 * 1000,
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
        } else {
          video.currentTime = 0;
        }
        video.play();
      });
    } else {
      video.src = originalM3u8Url;
      video.onloadedmetadata = () => {
        const savedPositionKey = getPlaybackPositionKey(currentEpisode.slug);
        const savedTime = parseFloat(localStorage.getItem(savedPositionKey));
        if (!isNaN(savedTime) && savedTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
          video.currentTime = savedTime;
        } else {
          video.currentTime = 0;
        }
        setVideoLoading(false);
        video.play();
      };
    }
  }, [currentEpisode, showMovieInfoPanel, getPlaybackPositionKey]);

  useEffect(() => {
    const video = videoRef.current;
    loadVideo();
    return () => {
      savePlaybackPosition();
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      if (video) {
        video.src = '';
        video.removeAttribute('src');
        video.load();
      }
      debouncedSavePlayback.cancel();
    };
  }, [currentEpisode, loadVideo, savePlaybackPosition, debouncedSavePlayback]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVideoPause = () => {
      savePlaybackPosition();
    };

    const handleTimeUpdate = () => {
      if (!video.paused) {
        debouncedSavePlayback();
      }
    };

    video.addEventListener('pause', handleVideoPause);
    video.addEventListener('timeupdate', handleTimeUpdate);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (!video.paused) {
          video.pause();
        }
        savePlaybackPosition();
      } else if (video.src && !showMovieInfoPanel) {
        video.play();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      video.removeEventListener('pause', handleVideoPause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      debouncedSavePlayback.cancel();
    };
  }, [showMovieInfoPanel, savePlaybackPosition, debouncedSavePlayback]);

  const handleEpisodeSelect = useCallback((episode) => {
    savePlaybackPosition();
    setCurrentEpisode(episode);
    setShowMovieInfoPanel(false);
    navigate(`/movie/${slug}/${episode.slug}`);
  }, [slug, navigate, savePlaybackPosition]);

  const handleContinueWatching = useCallback(() => {
    const targetEpisode = episodes[0].server_data.find(ep => ep.slug === lastViewedEpisodeInfo.slug);
    if (targetEpisode) {
      setCurrentEpisode(targetEpisode);
      setShowMovieInfoPanel(false);
      navigate(`/movie/${movie.slug}/${targetEpisode.slug}`);
    }
  }, [episodes, lastViewedEpisodeInfo, navigate, movie]);

  const getImageUrl = (url) => {
    return url || '/fallback-image.jpg';
  };

  const truncateDescription = (text, maxLength = 160) => {
    if (!text) return '';
    const stripped = text.replace(/<[^>]+>/g, '');
    return stripped.length > maxLength ? stripped.substring(0, maxLength) + '...' : stripped;
  };

  if (initialLoading) {
    return (
      <div className="container">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="container">
      <Helmet>
        <title>
          {currentEpisode
            ? `${movie.name} - ${currentEpisode.name || 'Tập phim'}`
            : movie.name}
        </title>
        <meta
          name="description"
          content={truncateDescription(movie.content)}
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
                {movie.category.map((cat) => cat.name).join(', ')}
              </p>
              <p>
                <strong>Quốc gia:</strong>{' '}
                {movie.country.map((c) => c.name).join(', ')}
              </p>
              <p><strong>Chất lượng:</strong> {movie.quality}</p>
              <p><strong>Ngôn ngữ:</strong> {movie.lang}</p>
              <p><strong>Thời lượng:</strong> {movie.time}</p>
              <p><strong>Trạng thái:</strong> {movie.episode_current}</p>
              <p><strong>Nội dung:</strong> {movie.content}</p>
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
              <video
                ref={videoRef}
                controls
                width="100%"
                height="100%"
                aria-label={`Video player for ${currentEpisode.name || 'Tập phim'}`}
                className={videoLoading ? 'hidden-video' : ''}
              />
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
      <div className="episode-list">
        <h3>Danh sách tập</h3>
        <div className="episodes">
          {episodes[0].server_data.map((ep, index) => (
            <button
              key={ep.slug}
              onClick={() => handleEpisodeSelect(ep)}
              className={`episode-button ${ep.slug === currentEpisode?.slug ? 'active' : ''}`}
              aria-label={`Xem ${ep.name || `Tập ${index + 1}`}`}
            >
              {ep.name || `Tập ${index + 1}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MovieDetail;
