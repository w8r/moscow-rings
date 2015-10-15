const L = global.L || require('leaflet');

import d3 from 'd3';

const EARTH_RADIUS =  6378137;

const d3Equidistant = d3.geo.azimuthalEquidistant().scale(EARTH_RADIUS);

L.CRS.EPSG3857.unproject = function (point) {
  return this.projection.unproject(
    point.multiplyBy(1 / EARTH_RADIUS)
  );
};

export let abstractEquidistant = {

  project(coords) {
    return d3Equidistant(coords);
  },

  unproject(coords) {
    return d3Equidistant.invert(coords);
  }
}

export let equidistant = {

  project (latlng) {
    return L.point(d3Equidistant([latlng.lng, latlng.lat]));
  },

  unproject (point) {
    return L.latLng(d3Equidistant.invert([point.x, point.y]).reverse())
  }
};

export let EPSG3857 = L.CRS.EPSG3857;
