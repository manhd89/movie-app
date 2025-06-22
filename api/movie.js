// api/movie.js

import { Redis } from '@upstash/redis';
import axios from 'axios';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ message: 'Missing slug parameter' });
  }

  const cacheKey = `movie:${slug}`;

  try {
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      if (typeof cachedData === 'object' && cachedData !== null && !Array.isArray(cachedData)) {
        return res.status(200).json(cachedData);
      } else {
        if (cachedData !== null && cachedData !== undefined) {
          await redis.del(cacheKey);
        }
      }
    }

    const apiResponse = await axios.get(`${process.env.REACT_APP_API_URL}/phim/${slug}`, {
      timeout: 8000,
    });
    const movieData = apiResponse.data;

    await redis.set(cacheKey, movieData);

    return res.status(200).json(movieData);

  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        return res.status(404).json({ message: 'Movie not found.' });
      } else if (error.code === 'ECONNABORTED') {
        return res.status(504).json({ message: 'API request timed out.' });
      }
    }
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
