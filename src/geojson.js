const L = global.L || require('leaflet');
import jsts from 'jsts';
import { polygon, featureCollection, combine } from '@turf/helpers';

const QUADRANT_SEGMENTS = 18;

export function buffer(feature, radius){
  if(feature.type === 'FeatureCollection'){
    let multi = combine(feature);
    multi.properties = {};
    return _buffer(multi, radius);
  }
  else{
    return _buffer(feature, radius);
  }
}

function _buffer(feature, radius) {
  // console.time('jsts');
  const reader = new jsts.io.GeoJSONReader();
  const geom = reader.read(JSON.stringify(feature.geometry));
  let buffered = geom.buffer(radius, QUADRANT_SEGMENTS);
  let parser = new jsts.io.GeoJSONParser();

  buffered = parser.write(buffered);

  if(buffered.type === 'MultiPolygon'){
    buffered = {
      type: 'Feature',
      geometry: buffered,
      properties: {}
    };
    buffered = featureCollection([buffered]);
  }
  else{
    buffered = featureCollection([polygon(buffered.coordinates)]);
  }
  // console.timeEnd('jsts');
  return buffered;
}


/**
 * @param  {Object}     data GeoJSON
 * @param  {L.Proj.CRS} crs
 * @return {Object}
 */
export function unproject (data, crs) {
  data = JSON.parse(JSON.stringify(data));
  if (crs.raw) {
    return _project(data, (coords) => {
      return crs.unproject.call(crs, coords);
    });
  } else {
    return _project(data, (coords) => {
      let latlng = crs.unproject.call(crs, L.point(coords[0], coords[1]));
      return [latlng.lng, latlng.lat];
    });
  }
}

/**
 * @param  {Object}     data GeoJSON
 * @param  {L.Proj.CRS} crs
 * @return {Object}
 */
export function project (data, crs) {
  data = JSON.parse(JSON.stringify(data));
  if (crs.raw) {
    return _project(data, (coords) => {
      return crs.project.call(crs, coords);
    });
  } else {
    return _project(data, (coords) => {
      let pt = crs.project.call(crs, L.latLng(coords.slice().reverse()));
      return [pt.x, pt.y];
    });
  }
}

/**
 * @param  {Object}     data GeoJSON
 * @param  {Function}   project
 * @return {Object}
 */
function _project (data, project) {
  if (data.type === 'FeatureCollection') {
    // That's a huge hack to get things working with both ArcGIS server
    // and GeoServer. Geoserver provides crs reference in GeoJSON, ArcGIS —
    // doesn't.
    for (let i = data.features.length - 1; i >= 0; i--) {
      data.features[i] = projectFeature(data.features[i], project);
    }
  } else {
    data = this.projectFeature(data, project);
  }
  return data;
}

/**
 * @param  {Object}     data GeoJSON
 * @param  {Function}   project
 * @return {Object}
 */
export function projectFeature (feature, project) {
  if (feature.type === 'GeometryCollection') {
    for (let i = 0, len = feature.geometries.length; i < len; i++) {
      feature.geometries[i] = projectGeometry(feature.geometries[i], project);
    }
  } else {
    feature.geometry = projectGeometry(feature.geometry, project);
  }
  return feature;
}

/**
 * @param  {Object}     data GeoJSON
 * @param  {Function}   project
 * @return {Object}
 */
export function projectGeometry (geometry, project) {
  var coords = geometry.coordinates;
  switch (geometry.type) {
    case 'Point':
      geometry.coordinates = project(coords);
      break;

    case 'MultiPoint':
    case 'LineString':
      for (var i = 0, len = coords.length; i < len; i++) {
        coords[i] = project(coords[i]);
      }
      geometry.coordinates = coords;
      break;

    case 'Polygon':
      geometry.coordinates = projectCoords(coords, 1, project);
      break;

    case 'MultiLineString':
      geometry.coordinates = projectCoords(coords, 1, project);
      break;

    case 'MultiPolygon':
      geometry.coordinates = projectCoords(coords, 2, project);
      break;

    default:
      break;
  }
  return geometry;
}

/**
 * @param  {*}         coords Coords arrays
 * @param  {Number}    levelsDeep
 * @param  {Function}  project
 * @return {*}
 */
export function projectCoords (coords, levelsDeep, project) {
  let coord, i, len;
  let result = [];

  for (i = 0, len = coords.length; i < len; i++) {
    coord = levelsDeep ?
      projectCoords(coords[i], levelsDeep - 1, project) :
      project(coords[i]);

    result.push(coord);
  }

  return result;
}

