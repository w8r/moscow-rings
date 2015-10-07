const L = global.L || require('leaflet');

import xhr from 'xhr';
import * as Spinner from 'spin.js';
import * as config from '../config.json';
import * as COLORS from './colors';
import leafletKnn from 'leaflet-knn';
import turf from 'turf';
import 'leaflet-hash';

console.log(leafletKnn);

const MAP_STYLE = 'mapbox.dark';
const LINE_WIDTH = 4;

let map = global.map = L.map(document.querySelector('.map'));
let hash = L.hash(map);
let index, gj, geojson;

let tiles = L.tileLayer(
  'https://api.mapbox.com/v4/' +
  MAP_STYLE +
  '/{z}/{x}/{y}.png?access_token=' +
  config.api_token, {
    attribution: 'Mapbox &copy; OSM contributors'
  }).addTo(map);

xhr({
  url: 'data/data.json'
}, (err, req, data) => {
  if (!err) {
    geojson = data = JSON.parse(data);
    gj = L.geoJson(data, {
      style: (feature) => {
        return {
          color: COLORS[feature.properties.id],
          weight: LINE_WIDTH / (feature.properties.id + 1),
          fillOpacity: 0.1,
          clickable: false
        }
      }
    });
    let bounds = gj.getBounds();
    map.fitBounds(bounds, {padding: [20, 20]});
    gj.addTo(map);
    index = leafletKnn(gj);
  }
});

let marker;

map.on('click', (evt) => {
  if (!marker) {
    marker = L.marker(evt.latlng).addTo(map);
  } else {
    marker.setLatLng(evt.latlng);
  }
  let nearest = index.nearest(evt.latlng);
  console.log(nearest);
});


