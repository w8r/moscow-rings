const L = global.L || require('leaflet');

import d3 from 'd3';

const EARTH_RADIUS =  6378137;
const MOSCOW_LAT_LNG = [55.751849391735284, 37.61993408203125];

const d3Equidistant = d3.geo.azimuthalEquidistant();

export const moscowEquidistant = d3Equidistant
  .rotate(MOSCOW_LAT_LNG.map((c) => -c).reverse())
  .scale(EARTH_RADIUS);

L.CRS.EPSG3857.unproject = function (point) {
  return this.projection.unproject(
    point.multiplyBy(1 / EARTH_RADIUS)
  );
};

export let abstractEquidistant = {

  project(coords) {
    return moscowEquidistant(coords);
  },

  unproject(coords) {
    return moscowEquidistant.invert(coords);
  }
}

export let equidistant = {

  project (latlng) {
    return L.point(moscowEquidistant([latlng.lng, latlng.lat]));
  },

  unproject (point) {
    return L.latLng(moscowEquidistant.invert([point.x, point.y]).reverse())
  }
};

export let EPSG3857 = L.CRS.EPSG3857;
