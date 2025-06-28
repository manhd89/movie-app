import React, { useRef, useEffect, useCallback, useState } from 'react';
import shaka from 'shaka-player/dist/shaka-player.compiled';

// Đảm bảo rằng các polyfill cần thiết được cài đặt một lần
if (!window.shakaPolyfillInstalled) {
  shaka.polyfill.installAll();
  window.shakaPolyfillInstalled = true;
}

const ShakaPlayerComponent = ({ src, onTimeUpdate, onEnded, initialPlaybackPosition, onPlayerReady, isVideoLoading }) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);

  // Initialize Shaka Player
  const initPlayer = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    // Destroy existing player if it exists before creating a new one
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    const player = new shaka.Player(video);
    playerRef.current = player;

    // Lắng nghe các sự kiện lỗi của Shaka Player
    player.addEventListener('error', (event) => {
      console.error('Shaka Player Error:', event.detail);
      // Bạn có thể truyền lỗi này lên component cha để xử lý hiển thị
      // if (onError) onError(event.detail);
    });

    // Cấu hình Shaka Player (tùy chọn)
    player.configure({
      streaming: {
        bufferingGoal: 60,
        bufferBehind: 30,
        retryParameters: {
          maxAttempts: 5,
          baseDelay: 500,
          timeout: 30000,
          // Removed 'factor' as it's not a direct config key for retryParameters
        },
      },
      manifest: {
        retryParameters: {
          maxAttempts: 5,
          baseDelay: 500,
          timeout: 30000,
          // Removed 'factor' as it's not a direct config key for retryParameters
        },
      },
      // Thêm cấu hình cho DASH/HLS nếu cần
      // adaptif: { ... }
    });

    try {
      await player.load(src);
      console.log('Shaka Player loaded source:', src);

      // Restore playback position
      if (initialPlaybackPosition && initialPlaybackPosition > 0 && initialPlaybackPosition < video.duration) {
        video.currentTime = initialPlaybackPosition;
        console.log(`Restored Shaka playback position: ${initialPlaybackPosition}s`);
      } else {
        video.currentTime = 0; // Đặt về 0 nếu không có vị trí lưu hoặc vị trí không hợp lệ
      }

      // Try to autoplay
      video.play().catch(error => {
        console.warn("Autoplay was prevented by Shaka Player:", error);
        // Có thể hiển thị một nút play nếu autoplay bị chặn
      });

      // Báo hiệu cho component cha rằng player đã sẵn sàng
      if (onPlayerReady) {
        onPlayerReady(player);
      }

    } catch (e) {
      console.error('Error loading Shaka Player source:', e);
      // Báo hiệu cho component cha rằng có lỗi tải video
      if (onPlayerReady) {
        onPlayerReady(null); // Truyền null hoặc một đối tượng lỗi để báo hiệu lỗi
      }
    }
  }, [src, onPlayerReady, initialPlaybackPosition]);

  useEffect(() => {
    // Chỉ khởi tạo khi src thay đổi và video element đã sẵn sàng
    if (src && videoRef.current) {
      initPlayer();
    }
    // Cleanup function: destroy player when component unmounts or src changes
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
        console.log('Shaka Player destroyed.');
      }
    };
  }, [src, initPlayer]);

  // Lắng nghe sự kiện timeupdate và ended từ video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (onTimeUpdate) {
        onTimeUpdate(video.currentTime);
      }
    };

    const handleEnded = () => {
      if (onEnded) {
        onEnded();
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [onTimeUpdate, onEnded]);


  return (
    <video
      ref={videoRef}
      controls
      autoPlay // Thử autoplay, nhưng trình duyệt có thể chặn
      width="100%"
      height="100%"
      className={isVideoLoading ? 'hidden-video' : ''} // Được kiểm soát bởi MovieDetail
      aria-label="Video player"
      playsInline // Quan trọng cho iOS autoplay
    />
  );
};

export default ShakaPlayerComponent;
