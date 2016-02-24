import L from 'leaflet';
import { MOSCOW_BBOX } from './projection';
// import { diffSentences } from 'diff';

const center = new L.LatLng(
  (MOSCOW_BBOX[1] + MOSCOW_BBOX[3])/2,
  (MOSCOW_BBOX[0] + MOSCOW_BBOX[2])/2
);

function sqDistance(x1, y1, x2, y2) {
  let dx = x2 - x1,
      dy = y2 - y1;
  return dx * dx + dy * dy;
}

export default function(a, b, center, query) {
  return sqDistance(a.lon, a.lat, center.lng, center.lat) >
         sqDistance(b.lon, b.lat, center.lng, center.lat) ?
         1 : -1;
}
