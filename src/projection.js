const L = global.L || require('leaflet');

L.CRS.EPSG3857.unproject = function (point) {
  const earthRadius = 6378137;
  return this.projection.unproject(
    point.multiplyBy(1 / earthRadius)
  );
};

export default L.CRS.EPSG3857;
