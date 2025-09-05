/**
 * Wind speed conversion utilities for hurricane tracking
 * 
 * NHC APIs provide wind speeds in knots, but users often expect to see mph.
 * This module provides consistent conversion functions.
 */

// Conversion factor: 1 knot = 1.15078 mph
export const KNOT_TO_MPH = 1.15078;

/**
 * Convert knots to mph
 * @param knots Wind speed in knots
 * @returns Wind speed in mph, rounded to nearest integer
 */
export const knotsToMph = (knots: number): number => {
  return Math.round(knots * KNOT_TO_MPH);
};

/**
 * Convert mph to knots
 * @param mph Wind speed in mph
 * @returns Wind speed in knots, rounded to nearest integer
 */
export const mphToKnots = (mph: number): number => {
  return Math.round(mph / KNOT_TO_MPH);
};

/**
 * Format wind speed for display showing both knots and mph
 * @param knots Wind speed in knots (from NHC API)
 * @returns Formatted string like "100 knots (115 mph)"
 */
export const formatWindSpeed = (knots: number): string => {
  const mph = knotsToMph(knots);
  return `${knots} knots (${mph} mph)`;
};

/**
 * Format wind speed for display showing only mph
 * @param knots Wind speed in knots (from NHC API)
 * @returns Formatted string like "115 mph"
 */
export const formatWindSpeedMphOnly = (knots: number): string => {
  const mph = knotsToMph(knots);
  return `${mph} mph`;
};

/**
 * Get Saffir-Simpson category from wind speed in knots
 * @param knots Wind speed in knots
 * @returns Hurricane category (0-5)
 */
export const getHurricaneCategoryFromKnots = (knots: number): number => {
  if (knots >= 157) return 5;
  if (knots >= 130) return 4;
  if (knots >= 111) return 3;
  if (knots >= 96) return 2;
  if (knots >= 74) return 1;
  return 0; // Tropical Storm or Depression
};

/**
 * Get intensity category name from wind speed in knots
 * @param knots Wind speed in knots
 * @returns Category string like "TD", "TS", "1", "2", etc.
 */
export const getIntensityCategoryFromKnots = (knots: number): string => {
  if (knots < 34) return 'TD';
  else if (knots < 64) return 'TS';
  else if (knots < 83) return '1';
  else if (knots < 96) return '2';
  else if (knots < 113) return '3';
  else if (knots < 137) return '4';
  else return '5';
};
