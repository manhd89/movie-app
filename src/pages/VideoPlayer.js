import { useRef, useEffect } from 'react';
import './VideoPlayer.css';

function VideoPlayer({ videoUrl }) {
  const iframeRef = useRef(null);

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.src = videoUrl;
    }
  }, [videoUrl]);

  return (
    <div className="video-player">
      <iframe
        ref={iframeRef}
        title="Video Player"
        width="100%"
        height="500px"
        allowFullScreen
      />
    </div>
  );
}

export default VideoPlayer;
