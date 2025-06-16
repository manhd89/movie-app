import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import VideoPlayer from './VideoPlayer';
import 'react-toastify/dist/ReactToastify.css';
import './Watch.css';

function Watch() {
  const { slug, episodeSlug } = useParams();
  const [movie, setMovie] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [selectedServer, setSelectedServer] = useState(() => {
    // Lấy server đã chọn từ localStorage, mặc định là 0 nếu chưa có
    return parseInt(localStorage.getItem(`selectedServer-${slug}`)) || 0;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMovie = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/phim/${slug}`);
        setMovie(response.data.movie);
        setEpisodes(response.data.episodes);

        // Kiểm tra xem server đã chọn có hợp lệ không
        const validServerIndex = selectedServer < response.data.episodes.length ? selectedServer : 0;
        setSelectedServer(validServerIndex);

        // Tìm tập phim từ server đã chọn
        const episode =
          response.data.episodes[validServerIndex]?.server_data.find(
            (ep) => ep.slug === episodeSlug
          ) || response.data.episodes[validServerIndex]?.server_data[0];

        if (episode) {
          setCurrentEpisode(episode);
        } else {
          toast.error('Tập phim không tồn tại.');
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching movie:', error);
        toast.error('Lỗi khi tải thông tin phim.');
        setLoading(false);
      }
    };
    fetchMovie();
  }, [slug, episodeSlug, selectedServer]);

  useEffect(() => {
    // Lưu server đã chọn vào localStorage
    localStorage.setItem(`selectedServer-${slug}`, selectedServer);
  }, [selectedServer, slug]);

  const handleServerChange = (index) => {
    setSelectedServer(index);
    // Chọn tập đầu tiên của server mới
    const newEpisode = episodes[index]?.server_data[0];
    if (newEpisode) {
      setCurrentEpisode(newEpisode);
      // Cập nhật URL
      window.history.pushState({}, '', `/watch/${slug}/${newEpisode.slug}`);
    }
  };

  if (loading) return <div className="container">Loading...</div>;
  if (!movie || !currentEpisode) return <div className="container">Tập phim không tồn tại.</div>;

  const serverData = episodes[selectedServer]?.server_data || [];

  return (
    <div className="container">
      <Helmet>
        <title>{`${movie.name} - ${currentEpisode.name || 'Tập phim'} | ${movie.seoOnPage?.titleHead || movie.name}`}</title>
        <meta name="description" content={movie.seoOnPage?.descriptionHead || movie.content} />
      </Helmet>
      <ToastContainer />
      <h1>{movie.name} - {currentEpisode.name || 'Tập phim'}</h1>
      <div className="server-list">
        <h3>Chọn server/ngôn ngữ:</h3>
        {episodes.map((server, index) => (
          <button
            key={server.server_name}
            onClick={() => handleServerChange(index)}
            className={`server-button ${index === selectedServer ? 'active' : ''}`}
          >
            {server.server_name}
          </button>
        ))}
      </div>
      <VideoPlayer videoUrl={currentEpisode.link_embed} />
      <div className="episode-list">
        <h3>Danh sách tập ({episodes[selectedServer]?.server_name})</h3>
        {serverData.map((ep, index) => (
          <Link
            key={ep.slug}
            to={`/watch/${movie.slug}/${ep.slug}`}
            className={`episode-button ${ep.slug === currentEpisode.slug ? 'active' : ''}`}
          >
            {ep.name || `Tập ${index + 1}`}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default Watch;
