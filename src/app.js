const L = global.L || require('leaflet');

import xhr from 'xhr';
import * as Spinner from 'spin.js';
import * as config from '../config.json';
import { ringStyle, bufferStyle, POSITION_STYLE, nearestStyle, COLORS } from './styles';
import { euclidianDistance, nearestPoint, planarNearestPoint } from './utils';

import turf from 'turf';
import gjutils from 'geojson-utils';
import geom from 'leaflet-geometryutil';
import 'leaflet-hash';
import { EPSG3857, moscowEquidistant, MOSCOW_BBOX } from './projection';
import { project, unproject, buffer } from './geojson';
import Polygon from 'polygon';
import Vec2 from 'vec2';

global.turf = turf;

const MAP_STYLE = 'mapbox.dark';

export default class App {

  constructor(mapContainer, dataUrl) {

    let { center, zoom } = L.Hash.parseHash(location.hash);

    this._map = global.map = L.map(document.querySelector(mapContainer), {
      zoomControl: false
    });
    L.control.zoom({ position: 'bottomright' }).addTo(this._map);

    this._positioned = (center && zoom)
    if (this._positioned) {
      this._map.setView(center, zoom);
    }

    this._intersects = L.layerGroup().addTo(this._map);

    this._buffers = L.geoJson(null, { style: bufferStyle }).addTo(this._map);

    this._hash = L.hash(map);

    this._data = null;

    this._bufferData = null;

    this._state = {};

    this._equidistant = null;

    this._geojson = null;

    this._index = null;

    this._marker = null;

    this._info = document.querySelector('.info');

    this._tiles = L.tileLayer(
      'http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">' +
                   'OpenStreetMap</a> contributors, &copy; ' +
                   '<a href="http://cartodb.com/attributions">CartoDB</a>'
    }).addTo(this._map);

    // this._tiles = L.tileLayer(
    //   'https://api.mapbox.com/v4/' +
    //   MAP_STYLE +
    //   '/{z}/{x}/{y}.png?access_token=' +
    //   config.api_token, {
    //     attribution: 'Mapbox &copy; OSM contributors'
    // }).addTo(map);

    this._load(dataUrl);
  }

  /**
   * @param  {String} url
   */
  _load(url) {
    xhr({ url }, this._onLoad.bind(this));
  }

  /**
   * @param  {Object} data
   */
  _processData(data) {
    function storeCentroid(f) {
      f.properties.centroid = turf.centroid(f).geometry.coordinates;
    };
    this._data = data = JSON.parse(data);
    data.features.forEach(storeCentroid, this);

    data.features.forEach((feature) => {
      this._state[feature.properties.id] = true;
    }, this);

    this._geojson = L.geoJson(data, { style: ringStyle });

    console.time('proj');
    this._equidistant = project(data, moscowEquidistant);
    this._equidistant.features.forEach(storeCentroid, this);
    console.timeEnd('proj');
  }

  /**
   * @param  {Object|Null} err
   * @param  {Request}     req
   * @param  {Object}      data
   */
  _onLoad(err, req, data) {
    if (err) throw new Error('failed to fetch data');

    this._processData(data);

    if (!this._positioned) {
      map.fitBounds(this._geojson.getBounds(), {
        padding: [20, 20]
      });
    }

    this._geojson.addTo(map);
    this._init();
  }

  /**
   * Init handlers
   */
  _init() {
    this._map.on('click', this._onMapClick, this);
    L.DomEvent.on(this._info, 'click', (evt) => {
      if (evt.target.tagName.toLowerCase() === 'input') {
        L.Util.requestAnimFrame(() => {
          let id = evt.target.getAttribute('data-feature-id');
          this._state[id] = !!evt.target.checked;
          this._renderBuffers();
        }, this);
      }
    }, this);

    navigator.geolocation.getCurrentPosition(L.Util.bind((position) => {
      var latlng = L.latLng(position.coords.latitude,
          position.coords.longitude);
      if(L.latLngBounds(
        MOSCOW_BBOX.slice(0,2).reverse(),
        MOSCOW_BBOX.slice(2).reverse()
      ).contains(latlng)) {
        this._onMapClick({
          latlng: latlng
        });
      }
    }, this));
  }

  /**
   * @param  {Object} evt
   */
  _onMapClick(evt) {
    if (!this._marker) {
      this._marker = L.circleMarker(evt.latlng, POSITION_STYLE)
        .addTo(this._map);
    } else {
      this._marker.setLatLng(evt.latlng);
    }
    this._intersects.clearLayers();

    L.Util.requestAnimFrame(() => this._calculateDistances(evt.latlng), this);
  }

  /**
   * @param  {L.LatLng} latlng
   * @return {Array.<Object>}
   */
  _calculateDistances(latlng) {
    let intersections = [];
    let eintersections = [];

    let point = turf.point([latlng.lng, latlng.lat]);
    let epoint = turf.point(moscowEquidistant.project([latlng.lng, latlng.lat]));

    var measures = this._data.features.map((feature, index) => {
      let f = feature;
      let ef = this._equidistant.features.filter((e) => {
        return e.properties.id === f.properties.id;
      })[0];


      let nearest = nearestPoint(point, f);
      let enearest = planarNearestPoint(epoint, ef);

      // L.circleMarker(
      //   moscowEquidistant.unproject(enearest.geometry.coordinates).slice().reverse(),
      //   nearestStyle(f.properties.id)
      // ).addTo(this._intersects);



      enearest.properties.feature = ef;

      intersections.push(nearest);
      eintersections.push(enearest);

      let distance = turf.distance(point, nearest, "kilometers");
      let edistance = euclidianDistance(
        enearest.geometry.coordinates, epoint.geometry.coordinates);

      if (turf.inside(point, f)) {
        distance = -distance;
        edistance = -edistance;
        this._state[f.properties.id] = false;
      } else {
        this._state[f.properties.id] = true;
      }

      L.circleMarker(nearest.geometry.coordinates.slice().reverse(), {
        radius: 2,
        color: COLORS[f.properties.id]
      }).addTo(this._intersects);

      return {
        feature: ef,
        distance,
        radius: edistance
      };
    }, this);

    this._showInfo(measures);

    L.Util.requestAnimFrame(() => {
      this._showBuffers(this._calculateBuffers(measures));
    }, this);
  }

  /**
   * @param  {Array/<Object>} measures
   */
  _showInfo(measures) {
    let html = '';
    html = '<ul>' + measures.map((measure) => {
      var feature = measure.feature;
      return L.Util.template('<li data-feature-id="{id}">' +
        '<label class="topcoat-checkbox">' +
        '<input type="checkbox" data-feature-id="{id}" {checked}> ' +
        '<span class="distance">{distance} km</span>' +
        '<span class="name">{name}</span>' +
        '</label></li>', {
          checked: this._state[feature.properties.id] ? 'checked': '',
          id: feature.properties.id,
          name: feature.properties.name,
          distance: Math.abs(measure.distance).toFixed(2)
        });
    }).join('') + '</ul>';
    this._info.innerHTML = html;
  }

  /**
   * @param  {Array.<Object>} measures
   * @return {Object}
   */
  _calculateBuffers(measures) {
    let buffers = [];

    measures.forEach((measure, index) => {
      if (measure.distance !== 0) {
        let projectedFeature = measure.feature;

        buffers = buffers.concat(buffer(
             projectedFeature,
             measure.radius
           ).features
          .map((f) => {
             f.properties.id = projectedFeature.properties.id;
             return f;
        }));
      }
    }, this);

    return unproject(turf.featurecollection(buffers), moscowEquidistant);
  }

  /**
   * @param  {Object} buffers
   */
  _showBuffers(buffers) {
    this._bufferData = buffers;
    this._renderBuffers();
  }

  _renderBuffers() {
    let buffers = this._bufferData;
    this._buffers.clearLayers();
    if (!buffers) return;

    buffers.features.forEach((feature) => {
      if (this._state[feature.properties.id]) {
        this._buffers.addData(feature);
      }
    }, this);
  }

}
