import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import Hls from 'hls.js';
import { FaArrowLeft, FaRegPlayCircle, FaHistory } from 'react-icons/fa';
import 'react-lazy-load-image-component/src/effects/blur.css';
import './MovieDetail.css';

// Constants
const PLAYBACK_SAVE_THRESHOLD_SECONDS = 5;
const LAST_PLAYED_KEY_PREFIX = 'lastPlayedPosition-';
const WATCH_HISTORY_KEY = 'watchHistory';
const SAVE_INTERVAL_SECONDS = 10;

// Ad removal configuration
const ADS_REGEX_LIST = [
  new RegExp(
    '(?<!#EXT-X-DISCONTINUITY[\\s\\S]*)#EXT-X-DISCONTINUITY\\n(?:.*?\\n){18,24}#EXT-X-DISCONTINUITY\\n(?![\\s\\S]*#EXT-X-DISCONTINUITY)',
    'g'
  ),
  /#EXT-X-DISCONTINUITY\n(?:#EXT-X-KEY:METHOD=NONE\n(?:.*\n){18,24})?#EXT-X-DISCONTINUITY\n|convertv7\//g,
  /#EXT-X-DISCONTINUITY\n#EXTINF:3\.920000,\n.*\n#EXTINF:0\.760000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:2\.500000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:2\.420000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:0\.780000,\n.*\n#EXTINF:1\.960000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:1\.760000,\n.*\n#EXTINF:3\.200000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:1\.360000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:0\.720000,\n.*/g,
];

// Utility functions for ad removal
function getTotalDuration(playlist) {
  const matches = playlist.match(/#EXTINF:([\d.]+)/g) ?? [];
  return matches.reduce((sum, match) => sum + parseFloat(match.split(':')[1]), 0);
}

function isContainAds(playlist) {
  return ADS_REGEX_LIST.some((regex) => {
    regex.lastIndex = 0;
    return regex.test(playlist);
  });
}

async function removeAds(playlistUrl) {
  const caches = { blob: {} }; // In-memory cache for the component's lifecycle
  if (caches.blob[playlistUrl]) {
    return caches.blob[playlistUrl];
  }

  let req;
  try {
    req = await fetch(playlistUrl);
    if (!req.ok) {
      throw new Error(`Failed to fetch playlist: ${req.statusText}`);
    }
  } catch (error) {
    console.error('Failed to fetch playlist:', error);
    return playlistUrl; // Fallback to original URL
  }

  let playlist = await req.text();

  // Resolve relative URLs in the playlist
  playlist = playlist.replace(/^[^#].*$/gm, (line) => {
    try {
      const parsedUrl = new URL(line, playlistUrl);
      return parsedUrl.toString();
    } catch {
      return line;
    }
  });

  // Handle variant playlists (HLS multi-bitrate)
  if (playlist.includes('#EXT-X-STREAM-INF')) {
    const subPlaylistUrl = playlist.trim().split('\n').slice(-1)[0];
    caches.blob[playlistUrl] = await removeAds(subPlaylistUrl);
    return caches.blob[playlistUrl];
  }

  // Remove ads if detected
  if (isContainAds(playlist)) {
    playlist = ADS_REGEX_LIST.reduce((playlist, regex) => {
      return playlist.replaceAll(regex, '');
    }, playlist);
  } else if (getTotalDuration(playlist) > 900) {
    console.warn('Ads not found, but playlist duration exceeds 15 minutes.');
    // Optionally, add a fallback mechanism if needed
  }

  // Create a blob URL for the cleaned playlist
  const blobUrl = URL.createObjectURL(
    new Blob([playlist], { type: req.headers.get('Content-Type') ?? 'text/plain' })
  );
  caches.blob[playlistUrl] = blobUrl;
  return blobUrl;
}

function MovieDetail() {
  const { slug, episodeSlug } = useParams();
  const navigate = useNavigate();
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
  const [lastViewedPosition, setLastViewedPosition] = useState(0);
  const [lastViewedEpisodeInfo, setLastViewedEpisodeInfo] = useState(null);
  const saveIntervalRef = useRef(null);

  useEffect(() => {
    const fetchMovieData = async () => {
      setInitialLoading(true);
      try {
        const response = await axios.get(`/api/movie?slug=${slug}`);
        setMovie(response.data.movie);
        setEpisodes(response.data.episodes);
      } catch (error) {
        console.error('Failed to fetch movie data:', error);
        alert('Unable to load movie data. Please try again later.');
      } finally {
        setInitialLoading(false);
      }
    };
    fetchMovieData();
  }, [slug]);

  useEffect(() => {
    if (movie && episodes.length > 0) {
      const validServerIndex = selectedServer < episodes.length ? selectedServer : 0;
      setSelectedServer(validServerIndex);

      const serverData = episodes[validServerIndex].server_data;

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

  const getPlaybackPositionKey = useCallback(
    (epSlug) => `${LAST_PLAYED_KEY_PREFIX}${slug}-${epSlug}`,
    [slug]
  );

  const saveMovieToHistory = useCallback(
    (movieData, episodeData, position) => {
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
      history = history.filter((item) => item.slug !== movieData.slug);
      history.unshift(historyEntry);
      try {
        localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
      } catch (e) {
        if (e.name === 'QuotaExceededError') {
          console.warn('LocalStorage quota exceeded, clearing old history');
          localStorage.removeItem(WATCH_HISTORY_KEY);
          localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify([historyEntry]));
        }
      }
    },
    [episodes, selectedServer]
  );

  const savePlaybackPosition = useCallback(() => {
    const video = videoRef.current;
    if (video && currentEpisode && video.currentTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
      const key = getPlaybackPositionKey(currentEpisode.slug);
      try {
        localStorage.setItem(key, video.currentTime.toString());
        if (movie) {
          saveMovieToHistory(movie, currentEpisode, video.currentTime);
        }
      } catch (e) {
        if (e.name === 'QuotaExceededError') {
          console.warn('LocalStorage quota exceeded, clearing old history');
          localStorage.removeItem(WATCH_HISTORY_KEY);
          localStorage.setItem(key, video.currentTime.toString());
        }
      }
    }
  }, [currentEpisode, getPlaybackPositionKey, movie, saveMovieToHistory]);

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

    const loadHlsVideo = async () => {
      let playlistUrl = currentEpisode.link_m3u8;
      try {
        // Remove ads from the playlist
        playlistUrl = await removeAds(playlistUrl);
      } catch (error) {
        console.error('Failed to process playlist for ad removal:', error);
        setVideoLoading(false);
        alert('Failed to load video. Please try another server or episode.');
        return;
      }

      if (Hls.isSupported()) {
        const hls = new Hls({
          maxBufferLength: 60,
          maxMaxBufferLength: 120,
          maxBufferSize: 100 * 1000 * 1000,
          startFragPrefetch: true,
          enableWorker: true,
        });
        hlsInstanceRef.current = hls;
        hls.loadSource(playlistUrl);
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
          video.play().catch((error) => {
            console.error('Video playback failed:', error);
            setVideoLoading(false);
          });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          setVideoLoading(false);
          if (data.fatal) {
            console.error('HLS error:', data);
            alert('Failed to load video stream. Please try another server or episode.');
          }
        });
      } else {
        video.src = playlistUrl;
        video.onloadedmetadata = () => {
          const savedPositionKey = getPlaybackPositionKey(currentEpisode.slug);
          const savedTime = parseFloat(localStorage.getItem(savedPositionKey));
          if (!isNaN(savedTime) && savedTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
            video.currentTime = savedTime;
          } else {
            video.currentTime = 0;
          }
          setVideoLoading(false);
          video.play().catch((error) => {
            console.error('Video playback failed:', error);
            setVideoLoading(false);
          });
        };
        video.onerror = () => {
          setVideoLoading(false);
          alert('Failed to load video. Please try another server or episode.');
        };
      }
    };

    loadHlsVideo();

    if (video) {
      saveIntervalRef.current = setInterval(() => {
        if (!video.paused) {
          savePlaybackPosition();
        }
      }, SAVE_INTERVAL_SECONDS * 1000);
    }
  }, [currentEpisode, showMovieInfoPanel, getPlaybackPositionKey, savePlaybackPosition]);

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
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
        saveIntervalRef.current = null;
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

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (!video.paused) {
          video.pause();
        }
        savePlaybackPosition();
      } else if (video.src && !showMovieInfoPanel) {
        video.play().catch(() => {});
      }
    };

    video.addEventListener('pause', handleVideoPause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      video.removeEventListener('pause', handleVideoPause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [showMovieInfoPanel, savePlaybackPosition]);

  const handleServerChange = useCallback(
    (index) => {
      savePlaybackPosition();
      setSelectedServer(index);
      setShowMovieInfoPanel(false);

      const newServerData = episodes[index].server_data;
      const targetEpisode =
        newServerData.find((ep) => ep.slug === currentEpisode?.slug) || newServerData[0];
      setCurrentEpisode(targetEpisode);
      navigate(`/movie/${slug}/${targetEpisode.slug}`, { replace: true });
    },
    [slug, navigate, episodes, currentEpisode, savePlaybackPosition]
  );

  const handleEpisodeSelect = useCallback(
    (episode) => {
      savePlaybackPosition();
      setCurrentEpisode(episode);
      setShowMovieInfoPanel(false);
      navigate(`/movie/${slug}/${episode.slug}`);
    },
    [slug, navigate, savePlaybackPosition]
  );

  const handleContinueWatching = useCallback(() => {
    const serverIndex = episodes.findIndex(
      (server) => server.server_name === lastViewedEpisodeInfo.server_name
    );
    if (serverIndex !== -1) {
      setSelectedServer(serverIndex);
      const targetEpisode = episodes[serverIndex].server_data.find(
        (ep) => ep.slug === lastViewedEpisodeInfo.slug
      );
      if (targetEpisode) {
        setCurrentEpisode(targetEpisode);
        setShowMovieInfoPanel(false);
        navigate(`/movie/${movie.slug}/${targetEpisode.slug}`);
      }
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
              <p>
                <strong>Tên gốc:</strong> {movie.origin_name}
              </p>
              <p>
                <strong>Năm:</strong> {movie.year}
              </p>
              <p>
                <strong>Thể loại:</strong>{' '}
                {movie.category?.map((cat) => cat.name).join(', ') || 'N/A'}
              </p>
              <p>
                <strong>Quốc gia:</strong>{' '}
                {movie.country?.map((c) => c.name).join(', ') || 'N/A'}
              </p>
              <p>
                <strong>Chất lượng:</strong> {movie.quality || 'N/A'}
              </p>
              <p>
                <strong>Ngôn ngữ:</strong> {movie.lang || 'N/A'}
              </p>
              <p>
                <strong>Thời lượng:</strong> {movie.time || 'N/A'}
              </p>
              <p>
                <strong>Trạng thái:</strong> {movie.episode_current || 'Full'}
              </p>
              <p>
                <strong>Nội dung:</strong> {movie.content || 'Không có mô tả.'}
              </p>
              {lastViewedPosition > PLAYBACK_SAVE_THRESHOLD_SECONDS && lastViewedEpisodeInfo && (
                <button
                  onClick={handleContinueWatching}
                  className="continue-watching-detail-button"
                  aria-label={`Tiếp tục xem ${lastViewedEpisodeInfo.name || 'Tập phim'}`}
                >
                  <FaHistory /> Tiếp tục xem {lastViewedEpisodeInfo.name || `Tập cuối cùng`}{' '}
                  tại {Math.floor(lastViewedPosition / 60)} phút{' '}
                  {Math.floor(lastViewedPosition % 60)} giây
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
            {episodes[selectedServer].server_data.map((ep, index) => (
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
      )}
    </div>
  );
}

export default MovieDetail;
