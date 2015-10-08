const L = global.L || require('leaflet');

import xhr from 'xhr';
import * as Spinner from 'spin.js';
import * as config from '../config.json';
import COLORS from './colors';
import leafletKnn from 'leaflet-knn';
import turf from 'turf';
import gjutils from 'geojson-utils';
import geom from 'leaflet-geometryutil';
import 'leaflet-hash';

const MAP_STYLE = 'mapbox.dark';
const LINE_WIDTH = 4;

const POSITION_STYLE = {
  color: '#f51a1a',
  fillOpacity: 0.5,
  weight: 2,
  radius: 6
}

export default class App {

  constructor(mapContainer, dataUrl) {

    this._map = global.map = L.map(document.querySelector(mapContainer));

    this._intersects = L.layerGroup().addTo(this._map);

    this._hash = L.hash(map);

    this._data = null;

    this._geojson = null;

    this._index = null;

    this._marker = null;

    this._info = document.querySelector('.info');

    this._tiles = L.tileLayer(
      'https://api.mapbox.com/v4/' +
      MAP_STYLE +
      '/{z}/{x}/{y}.png?access_token=' +
      config.api_token, {
        attribution: 'Mapbox &copy; OSM contributors'
    }).addTo(map);

    this._load(dataUrl);

    this._init();
  }

  _load(url) {
    xhr({ url }, this._onLoad.bind(this));
  }

  _onLoad(err, req, data) {
    if (err) throw new Error('failed to fetch data');

    this._data = data = JSON.parse(data);
    data.features.forEach((f) => {
      f.properties.centroid =
        gjutils.centroid(f.geometry).coordinates;
    });

    this._geojson = L.geoJson(data, {
      style: (feature) => {
        return {
          color: COLORS[feature.properties.id],
          weight: LINE_WIDTH / (feature.properties.id + 1),
          fillOpacity: 0.1,
          clickable: false
        }
      }
    });

    map.fitBounds(this._geojson.getBounds(), {padding: [20, 20]});
    this._geojson.addTo(map);
    this._index = leafletKnn(this._geojson);
  }

  _init() {
    this._map.on('click', this._onMapClick, this);
    // let nearest = index.nearest(evt.latlng);
    // console.log(nearest);
  }

  _onMapClick(evt) {
    if (!this._marker) {
      this._marker = L.circleMarker(evt.latlng, POSITION_STYLE)
        .addTo(this._map);
    } else {
      this._marker.setLatLng(evt.latlng);
    }
    this._intersects.clearLayers();

    L.Util.requestAnimFrame(() => {
      this._calculateDistances(evt.latlng);
    }, this);
  }

  _calculateDistances(latlng) {
    let intersections = [];
    this._geojson.eachLayer((layer) => {
      let f = layer.feature;
      let centroid = L.latLng(f.properties.centroid.slice().reverse());

      let intersects = gjutils.lineStringsIntersect(
        { coordinates: f.geometry.coordinates[0] },
        { coordinates: [f.properties.centroid.slice(), [latlng.lng, latlng.lat]] }
      );

      if(intersects) {
        intersects = intersects.pop();
        L.circleMarker(intersects.coordinates.slice(), {
          radius: 2,
          color: COLORS[f.properties.id]
        }).addTo(this._intersects);
        intersects.feature = f;
        intersections.push(intersects);
      }

      // visual
      // L.polyline([latlng, centroid], {
      //   weight: 1
      // }).addTo(this._map);
    }, this)

    this._info.innerHTML = '<pre>' +
        JSON.stringify(intersections.map((i) => {
          return {
            [i.feature.properties.name] :
            turf.distance(
              turf.point([latlng.lng, latlng.lat]),
              turf.point(i.coordinates.slice().reverse())
            ).toFixed(1) + ' km'
          }
        }), 0, 2) +
      '</pre>';
  }

}




