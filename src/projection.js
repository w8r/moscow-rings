const L = global.L || require('leaflet');

import d3 from 'd3';

const EARTH_RADIUS =  6378137;
export const MOSCOW_LAT_LNG = [55.751849391735284, 37.61993408203125];
export const MOSCOW_BBOX = [34.1839599609375, 54.999675158535794, 41.2152099609375, 56.50192341572309];

const d3Equidistant = d3.geo.azimuthalEquidistant();

export const moscowEquidistantProj = d3Equidistant
  .rotate(MOSCOW_LAT_LNG.map((c) => -c).reverse())
  .scale(EARTH_RADIUS);

L.CRS.EPSG3857.unproject = function (point) {
  return this.projection.unproject(
    point.multiplyBy(1 / EARTH_RADIUS)
  );
};

export const moscowEquidistant = {

  projection: moscowEquidistantProj,

  raw: true,

  project(coords) {
    return this.projection(coords);
  },

  unproject(coords) {
    return this.projection.invert(coords);
  }
}

export const moscowEquidistantCRS = {

  projection: moscowEquidistantProj,

  project (latlng) {
    return L.point(this.projection([latlng.lng, latlng.lat]));
  },

  unproject (point) {
    return L.latLng(this.projection.invert([point.x, point.y]).reverse())
  }
};

export let EPSG3857 = L.CRS.EPSG3857;

export function projectedDistance (latlon1, latlon2, crs) {
  let p1 = crs.project(latlon1);
  let p2 = crs.project(latlon2);

  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}
