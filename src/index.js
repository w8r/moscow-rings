const L = global.L || require('leaflet');

import xhr from 'xhr';
import * as Spinner from 'spin.js';
import * as config from '../config.json';

const MAP_STYLE = 'mapbox.dark';

let map = L.map(document.querySelector('.map'))
  .setView([55.73522939875256, 37.582855224609375], 10);

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
      weight: 2
    });
    var bounds = gj.getBounds();
    map.fitBounds(bounds, {padding: [20, 20]});
    gj.addTo(map);
  }
});


