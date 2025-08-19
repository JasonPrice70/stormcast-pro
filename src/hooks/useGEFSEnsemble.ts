import { useEffect, useState } from 'react';
import NHCApiService from '../services/nhcApi';

export interface GEFSMemberTrackPoint { lat: number; lon: number; fhr: number }
export interface GEFSMemberTrack { member: string; track: GEFSMemberTrackPoint[] }
export interface GEFSMeta { filename?: string; modelsPresent: string[]; message?: string }

export const useGEFSEnsemble = (stormId: string | null, year: number | null) => {
  const [tracks, setTracks] = useState<GEFSMemberTrack[]>([]);
  const [meta, setMeta] = useState<GEFSMeta>({ modelsPresent: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!stormId || !year) {
        setTracks([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const api = new NHCApiService(true, false);
        const resp = await api.getGEFSAdeckTracks(stormId);
        if (!cancelled) {
          // Transform API response to match expected interface
          const transformedTracks: GEFSMemberTrack[] = resp?.tracks?.map(track => ({
            member: track.modelId,
            track: track.points.map(point => ({
              lat: point.lat,
              lon: point.lon,
              fhr: point.tau // Map tau to fhr
            }))
          })) || [];
          
          setTracks(transformedTracks);
          setMeta({ filename: resp?.filename || '', modelsPresent: resp?.modelsPresent || [] });
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to fetch GEFS ensemble tracks');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [stormId, year]);

  return { tracks, loading, error, meta };
};
