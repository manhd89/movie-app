// src/components/VideoPlayer.js
import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import shaka from 'shaka-player/dist/shaka-player.ui.js';
import 'shaka-player/dist/controls.css';

const VideoPlayer = forwardRef(({ src, onPlaybackTimeUpdate, onLoaded, onPlay, onPause, onEnded, initialPlaybackTime }, ref) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const uiRef = useRef(null);

  useImperativeHandle(ref, () => ({
    play: () => {
      if (videoRef.current) {
        videoRef.current.play().catch(error => console.warn("Autoplay was prevented by imperative handle:", error));
      }
    },
    pause: () => {
      if (videoRef.current) {
        videoRef.current.pause();
      }
    },
    currentTime: videoRef.current ? videoRef.current.currentTime : 0,
    duration: videoRef.current ? videoRef.current.duration : 0,
  }));

  const initPlayer = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
    if (uiRef.current) {
        uiRef.current.destroy();
        uiRef.current = null;
    }

    const player = new shaka.Player(video);
    playerRef.current = player;

    player.configure({
      streaming: {
        bufferingGoal: 60,
        rebufferingGoal: 5,
        bufferBehind: 30,
      },
      abr: {
        enabled: true,
      },
    });

    const ui = new shaka.ui.Overlay(player, video, video.parentNode);
    uiRef.current = ui;

    // --- FIX START ---
    // The big play button is usually shown by default.
    // If you need to explicitly control it, you would typically get the controls first.
    // For example, if 'getControls()' was a method to access the controls object:
    // const controls = ui.getControls();
    // if (controls) {
    //    controls.showBigPlayButton(true);
    // }
    // However, the `shaka.ui.Overlay` often manages this directly.
    // The line `ui.get -->().showBigPlayButton(true);` is invalid.
    // Let's remove or correct it.
    // If you want to force the big play button to show (it usually does by default),
    // you might set a configuration or call a specific UI method if it exists.
    // For now, removing the problematic line is the safest fix for the syntax error.
    // If you later find the big play button isn't showing, consult Shaka Player UI docs.
    // --- FIX END ---


    player.addEventListener('error', (event) => {
      console.error('Shaka Error code:', event.detail.code, 'object:', event.detail.originalError);
    });

    video.addEventListener('timeupdate', () => {
      if (onPlaybackTimeUpdate) {
        onPlaybackTimeUpdate(video.currentTime);
      }
    });

    video.addEventListener('loadedmetadata', () => {
        if (initialPlaybackTime && initialPlaybackTime > 0) {
            video.currentTime = initialPlaybackTime;
            console.log(`Shaka Player: Restored playback to ${initialPlaybackTime}s`);
        }
        if (onLoaded) {
            onLoaded();
        }
    });

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);

    try {
      await player.load(src);
      console.log('The video has been loaded by Shaka Player!');
      video.play().catch(error => {
        console.warn("Shaka Player Autoplay prevented:", error);
      });
    } catch (e) {
      console.error('Error loading video with Shaka Player:', e);
      if (onLoaded) {
          onLoaded(true);
      }
    }
  }, [src, onPlaybackTimeUpdate, onLoaded, onPlay, onPause, onEnded, initialPlaybackTime]);

  useEffect(() => {
    if (src) {
      initPlayer();
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      if (uiRef.current) {
          uiRef.current.destroy();
          uiRef.current = null;
      }
    };
  }, [src, initPlayer]);

  return (
    <div className="shaka-player-container">
      <video
        ref={videoRef}
        className="shaka-video"
        poster="/path/to/your/poster.jpg"
      />
    </div>
  );
});

export default VideoPlayer;
