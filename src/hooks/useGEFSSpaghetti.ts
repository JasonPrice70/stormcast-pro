import { useCallback, useEffect, useState } from 'react';
import NHCApiService from '../services/nhcApi';

// Hook for GEFS spaghetti tracks (A-deck proxy) for a specific storm
export const useGEFSSpaghetti = (enabled: boolean, stormId: string | null) => {
  const [tracks, setTracks] = useState<
    | null
    | {
        filename: string;
        modelsPresent: string[];
        tracks: Array<{
          modelId: string;
          points: Array<{ tau: number; lat: number; lon: number; vmax: number | null }>;
        }>;
      }
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  const fetchTracks = useCallback(async () => {
    if (!enabled || !stormId) {
      setTracks(null);
      setAvailable(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const api = new NHCApiService();
      const data = await api.getGEFSAdeckTracks(stormId);
      if (data && data.tracks && data.tracks.length > 0) {
        setTracks(data);
        setAvailable(true);
      } else {
        setTracks(null);
        setAvailable(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch GEFS tracks');
      setTracks(null);
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [enabled, stormId]);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  return { tracks, loading, error, available, refresh: fetchTracks };
};
