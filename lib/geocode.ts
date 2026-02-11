/**
 * Optional geocoding for manual addresses (Nominatim, no API key).
 * Used to get latitude/longitude from city or address for distance ranking.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  display_name?: string;
}

/**
 * Geocode a query (e.g. "Lisboa" or "Rua X, Lisboa, Portugal").
 * Returns first result or null if not found / error.
 */
export async function geocodeQuery(query: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  try {
    const params = new URLSearchParams({
      q: trimmed,
      format: 'json',
      limit: '1',
    });
    const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const first = data[0];
    const lat = parseFloat(first.lat);
    const lon = parseFloat(first.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return {
      latitude: lat,
      longitude: lon,
      display_name: first.display_name,
    };
  } catch {
    return null;
  }
}
