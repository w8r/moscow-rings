const L = global.L || require('leaflet');

import xhr from 'xhr';
import * as Spinner from 'spin.js';
import * as config from '../config.json';
import 'leaflet-hash';

const MAP_STYLE = 'mapbox.dark';

let map = global.map = L.map(document.querySelector('.map'))
  .setView([55.74194999893639, 37.60596499188811], 10);
let hash = L.hash(map);

let tiles = L.tileLayer(
  'https://api.mapbox.com/v4/' +
  MAP_STYLE +
  '/{z}/{x}/{y}.png?access_token=' +
  config.api_token, {
    attribution: 'Mapbox &copy; OSM contributors'
  }).addTo(map);

xhr({
  url: 'data/data.json'
}, function(err, req, data) {
  if (!err) {
    data = JSON.parse(data);
    var gj = L.geoJson(data, {
      color: '#f51a1a',
      weight: 2,
      fillOpacity: 0.1
    });
    var bounds = gj.getBounds();
    map.fitBounds(bounds, {padding: [20, 20]});
    gj.addTo(map);
  }
});


