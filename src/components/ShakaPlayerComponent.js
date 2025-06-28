// src/components/ShakaPlayerComponent.js
import React, { useRef, useEffect, useState, useCallback } from 'react';
import shaka from 'shaka-player/dist/shaka-player.ui'; // Import shaka player UI
import 'shaka-player/dist/controls.css'; // Import Shaka Player UI CSS

const PLAYBACK_SAVE_THRESHOLD_SECONDS = 5;
const SAVE_INTERVAL_SECONDS = 10;

function ShakaPlayerComponent({
  videoUrl,
  episodeSlug,
  movieSlug,
  onPlaybackPositionChange,
  onVideoLoaded,
  onVideoError,
}) {
  const videoRef = useRef(null);
  const uiRef = useRef(null);
  const playerRef = useRef(null);
  const saveIntervalRef = useRef(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  const getPlaybackPositionKey = useCallback(() => {
    return `lastPlayedPosition-${movieSlug}-${episodeSlug}`;
  }, [movieSlug, episodeSlug]);

  const savePlaybackPosition = useCallback(() => {
    const video = videoRef.current;
    if (video && playerRef.current && video.currentTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
      const key = getPlaybackPositionKey();
      localStorage.setItem(key, video.currentTime.toString());
      // console.log(`Saved playback position for ${episodeSlug}: ${video.currentTime}s`);
      onPlaybackPositionChange && onPlaybackPositionChange(video.currentTime);
    }
  }, [episodeSlug, getPlaybackPositionKey, onPlaybackPositionChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      setIsPlayerReady(false);
      return;
    }

    if (playerRef.current) {
        playerRef.current.destroy(); // Destroy existing player if any
        playerRef.current = null;
    }

    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }

    shaka.polyfill.installAll(); // Ensure polyfills are installed

    // Check if the browser has native HLS support or if Shaka can handle it
    const player = new shaka.Player(video);
    playerRef.current = player;

    // Attach UI
    const ui = new shaka.ui.Overlay(player, uiRef.current, video);
    uiRef.current = ui;
    const controls = ui.get ="//";

    player.addEventListener('error', (event) => {
      console.error('Shaka Error event:', event.detail);
      onVideoError && onVideoError(event.detail);
    });

    player.load(videoUrl)
      .then(() => {
        setIsPlayerReady(true);
        console.log('Shaka Player: The video has been loaded and is now playing!');
        const savedTime = parseFloat(localStorage.getItem(getPlaybackPositionKey()));

        if (!isNaN(savedTime) && savedTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
          video.currentTime = savedTime;
          console.log(`Restored playback position for ${episodeSlug}: ${savedTime}s`);
        } else {
          video.currentTime = 0;
        }

        video.play().catch(error => {
          console.warn("Autoplay was prevented:", error);
        });

        onVideoLoaded && onVideoLoaded();

        saveIntervalRef.current = setInterval(() => {
          if (!video.paused) {
            savePlaybackPosition();
          }
        }, SAVE_INTERVAL_SECONDS * 1000);
      })
      .catch((error) => {
        console.error('Shaka Player: Error loading video', error);
        setIsPlayerReady(false);
        onVideoError && onVideoError(error);
      });

    const handleVideoPause = () => {
        savePlaybackPosition();
    };

    video.addEventListener('pause', handleVideoPause);

    return () => {
      savePlaybackPosition(); // Save on unmount
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
        saveIntervalRef.current = null;
      }
      video.removeEventListener('pause', handleVideoPause);
    };
  }, [videoUrl, episodeSlug, movieSlug, getPlaybackPositionKey, savePlaybackPosition, onVideoLoaded, onVideoError, onPlaybackPositionChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (!video.paused) {
          video.pause();
          console.log("Video paused due to tab going into background.");
        }
        savePlaybackPosition();
      } else {
        if (video.src) { // Check if video source is set
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
  }, [savePlaybackPosition]);


  return (
    <div data-shaka-player-container className="video-player-shaka">
      <video
        ref={videoRef}
        data-shaka-player
        className="shaka-video-element"
      />
      <div data-shaka-player-ui ref={uiRef} className="shaka-player-ui" />
      {!isPlayerReady && (
        <div className="video-overlay-spinner">
          <div className="spinner"></div>
        </div>
      )}
    </div>
  );
}

export default ShakaPlayerComponent;
