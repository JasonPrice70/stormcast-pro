import { useCallback, useEffect, useState } from 'react';
import NHCApiService from '../services/nhcApi';

// Hook for ECMWF ensemble (EPS) spaghetti tracks for a specific storm
export const useECMWFEnsemble = (enabled: boolean, stormId: string | null, stormName: string | null) => {
  const [tracks, setTracks] = useState<
    | null
    | {
        filename: string | null;
        modelsPresent: string[];
        tracks: Array<{
          modelId: string;
          points: Array<{ tau: number; lat: number; lon: number; vmax: number | null }>;
        }>;
        cycleTime?: string;
        fetchTime?: Date;
      }
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  const fetchTracks = useCallback(async () => {
    if (!enabled || !stormId || !stormName) {
      setTracks(null);
      setAvailable(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const api = new NHCApiService();
      const data = await api.getECMWFEnsembleTracks(stormId, stormName);
      if (data && data.tracks && data.tracks.length > 0) {
        const enrichedData = {
          ...data,
          fetchTime: new Date()
        };
        setTracks(enrichedData);
        setAvailable(true);
      } else {
        setTracks(null);
        setAvailable(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch ECMWF ensemble tracks');
      setTracks(null);
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [enabled, stormId, stormName]);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  return { tracks, loading, error, available, refresh: fetchTracks };
};
