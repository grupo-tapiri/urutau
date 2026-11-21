export interface PerimeterConfig {
  empresaId?: number | null;
  empresaNome?: string;
  setorId?: number | null;
  setorNome?: string;
  latitude: number | null;
  longitude: number | null;
  allowedRadiusMeters: number;
}

export interface GeofenceEvaluationResult {
  configured: boolean;
  allowed: boolean;
  distanceMeters: number | null;
  allowedRadiusMeters: number;
}

const EARTH_RADIUS_METERS = 6371000;

export function isValidCoordinatePair(
  latitude: unknown,
  longitude: unknown
): boolean {
  if (
    latitude === null ||
    latitude === undefined ||
    longitude === null ||
    longitude === undefined ||
    latitude === '' ||
    longitude === ''
  ) {
    return false;
  }
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return false;
  }
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

export function normalizeAllowedRadiusMeters(
  radius: unknown,
  fallback = 50
): number {
  const parsed = Number(radius);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(50000, Math.max(5, Math.round(parsed)));
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function calculateDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    !isValidCoordinatePair(lat1, lon1) ||
    !isValidCoordinatePair(lat2, lon2)
  ) {
    return Number.POSITIVE_INFINITY;
  }

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLon = Math.sin(dLon / 2);

  const a =
    sinHalfLat * sinHalfLat +
    Math.cos(radLat1) * Math.cos(radLat2) * sinHalfLon * sinHalfLon;

  const clampedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));

  return EARTH_RADIUS_METERS * c;
}

export function evaluatePerimeterAccess(
  userLat: number,
  userLon: number,
  perimeter: PerimeterConfig | null | undefined
): GeofenceEvaluationResult {
  const allowedRadiusMeters = normalizeAllowedRadiusMeters(
    perimeter?.allowedRadiusMeters,
    50
  );

  if (
    !perimeter ||
    !isValidCoordinatePair(perimeter.latitude, perimeter.longitude)
  ) {
    return {
      configured: false,
      allowed: true,
      distanceMeters: null,
      allowedRadiusMeters
    };
  }

  const distanceMeters = calculateDistanceInMeters(
    userLat,
    userLon,
    Number(perimeter.latitude),
    Number(perimeter.longitude)
  );

  return {
    configured: true,
    allowed:
      Number.isFinite(distanceMeters) && distanceMeters <= allowedRadiusMeters,
    distanceMeters: Number.isFinite(distanceMeters)
      ? Math.round(distanceMeters * 100) / 100
      : null,
    allowedRadiusMeters
  };
}
