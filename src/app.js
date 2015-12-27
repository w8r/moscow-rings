const L = global.L || require('leaflet');

import xhr from 'xhr';
import jsonp from 'jsonp';
import * as Spinner from 'spin.js';
import * as config from '../config.json';
import {
  ringStyle, torusStyle,
  bufferStyle, POSITION_STYLE, nearestStyle, COLORS
} from './styles';
import { euclidianDistance, nearestPoint, planarNearestPoint } from './utils';

import turf from 'turf';
import gjutils from 'geojson-utils';
import geom from 'leaflet-geometryutil';
import 'leaflet-hash';
import { EPSG3857, moscowEquidistant, MOSCOW_BBOX } from './projection';
import { project, unproject, buffer } from './geojson';
import Polygon from 'polygon';
import Vec2 from 'vec2';
import nominatim from 'nominatim-geocode';
import formatcoords from 'formatcoords';

import Search from './search';

global.turf = turf;

const MAP_STYLE = 'mapbox.dark';
const MOSCOW_BOUNDS = L.latLngBounds(
  MOSCOW_BBOX.slice(0,2).reverse(),
  MOSCOW_BBOX.slice(2).reverse()
);

const lang = /*navigator.language || navigator.userLanguage ||*/ 'ru-RU';
const locale = config.l10n[lang] || config.l10n.all;

console.log(locale, lang);

export default class App {

  constructor(mapContainer, dataUrl) {

    let { center, zoom } = L.Hash.parseHash(location.hash);

    /**
     * @type {L.Map}
     */
    this._map = global.map = L.map(document.querySelector(mapContainer), {
      zoomControl: false
    });
    L.control.zoom({ position: 'bottomright' }).addTo(this._map);

    /**
     * Wether the position is read
     * @type {Boolean}
     */
    this._positioned = (center && zoom);
    if (this._positioned) {
      this._map.setView(center, zoom);
    }

    /**
     * Intersection points
     * @type {L.LayerGroup}
     */
    this._intersects = L.layerGroup().addTo(this._map);

    /**
     * Buffer fills
     * @type {L.GeoJSON}
     */
    this._buffers = L.geoJson(null, { style: bufferStyle }).addTo(this._map);

    /**
     * @type {L.Control.Hash}
     */
    //this._hash = L.hash(map);

    /**
     * Rings data
     * @type {GeoJSON}
     */
    this._data = null;

    /**
     * Buffered rings
     * @type {GeoJSON}
     */
    this._bufferData = null;

    /**
     * On/off states for rings
     * @type {Object}
     */
    this._state = {};

    /**
     * Rings data in Moscow equidistant projection
     * @type {GeoJSON}
     */
    this._equidistant = null;

    /**
     * Rings layer
     * @type {L.GeoJSON}
     */
    this._geojson = null;

    /**
     * Torus fills
     * @type {L.GeoJSON}
     */
    this._toruses = null;

    /**
     * Position
     * @type {L.CircleMarker}
     */
    this._marker = null;

    /**
     * @type {Element}
     */
    this._container = document.querySelector('.info');

    /**
     * Info control
     * @type {Element}
     */
    this._info = this._container.querySelector('.container');

    /**
     * Raster
     * @type {L.TileLayer}
     */
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

    /**
     * Search control
     * @type {Search}
     */
    this._search = new Search(document.querySelector('.searchbox'))
      .on('submit', this._onSearch, this);
    this._load(dataUrl);
  }

  /**
   * @param  {Event} e
   */
  _onSearch(e) {
    this._setLoading();
    nominatim.geocode({
      q: e.query,
      'accept-language': lang,
      viewboxlbrt: MOSCOW_BBOX.join(',')
    }, (err, location) => {
      this._setReady();
      if (!err && location.length !== 0) {
        location = location[0];
        let latlng = L.latLng(parseFloat(location.lat), parseFloat(location.lon));
        this._setPoint(latlng);

        this._search.setValue(this._formatAddress(location));
        this._map.openPopup(this._formatAddress(location), latlng, {
          className: 'address-tooltip'
        });

        if (!this._map.getBounds().contains(latlng)) {
          this._map.panTo(latlng);
        }
      }
    });
  }

  /**
   * @param  {String} url
   */
  _load(url) {
    this._setLoading();
    xhr({ url }, this._onLoad.bind(this));
  }

  /**
   * @param  {Object} data
   */
  _processData(data) {
    // add centroid
    function storeCentroid(f) {
      f.properties.centroid = turf.centroid(f).geometry.coordinates;
    };
    this._data = data = JSON.parse(data);
    data.features.forEach(storeCentroid, this);

    // show all rings, sort for kremlin to be on top
    data.features.sort((f1, f2) => f2.properties.id - f1.properties.id)
      .forEach((feature) => {
        this._state[feature.properties.id] = true;
      }, this);

    this._geojson = L.geoJson(data, { style: ringStyle });

    //console.time('proj');
    this._equidistant = project(data, moscowEquidistant);
    this._equidistant.features.forEach(storeCentroid, this);
    //console.timeEnd('proj');
  }

  /**
   * @param  {Object|Null} err
   * @param  {Request}     req
   * @param  {Object}      data
   */
  _onLoad(err, req, data) {
    if (err) throw new Error('failed to fetch data');

    this._processData(data);

    let torsData = JSON.parse(data);
    torsData.features = torsData.features.map((f, i, arr) => {
      if (i) {
        f.geometry.coordinates.push(arr[i - 1].geometry.coordinates[0].slice());
      }
      return f;
    });

    if (!this._positioned) {
      this._map.fitBounds(this._geojson.getBounds(), {
        padding: [20, 20]
      });
    } else {
      this._map.setZoom(this._map.getBoundsZoom(this._geojson.getBounds(),
        true, [20, 20]));
    }

    this._toruses = L.geoJson(torsData, { style: torusStyle });
    this._toruses.addTo(this._map);

    this._geojson.addTo(this._map);
    //this._geojson.removeFrom(map);
    this._setReady();
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

    this._setLoading();

    if (this._positioned) {
      this._setLocation(this._map.getCenter());
    } else {
      navigator.geolocation.getCurrentPosition(L.Util.bind((position) => {
        var latlng = L.latLng(position.coords.latitude,
            position.coords.longitude);

        this._setReady();
        if (MOSCOW_BOUNDS.contains(latlng)) {
          this._setPoint(latlng);
        } else this._showEmpty();
      }, this));
    }
  }

  _showEmpty() {
    this._showInfo(this._data.features.map((feature) => {
      return {
        feature,
        distance: ''
      }
    }));
  }

  _setLoading() {
    L.DomUtil.addClass(this._container, 'loading');
  }

  _setReady() {
    L.DomUtil.removeClass(this._container, 'loading');
  }

  _formatAddress(location) {
    var addr = location.address;
    if (!addr.road) {
      addr.road = formatcoords(
        parseFloat(location.lat), parseFloat(location.lon))
      .format('FFf');
    }
    return addr.road + (addr.house_number ?
      (',&nbsp;' + addr.house_number.replace(/\s/g, '&nbsp;')) : '');
  }


  _formatHash(latlng) {
    let map = this._map;
    let zoom = map.getZoom();
    let precision = Math.max(6, Math.ceil(Math.log(zoom) / Math.LN2));

    latlng = latlng || map.getCenter();

    return "#" + [zoom,
      latlng.lat.toFixed(precision),
      latlng.lng.toFixed(precision)
    ].join("/");
  }

  /**
   * @param  {Object} evt
   */
  _onMapClick(evt) {
    let latlng = evt.latlng;
    this._setLocation(evt.latlng);
  }

  /**
   * Sets point and geocodes
   * @param {L.LatLng} latlng
   */
  _setLocation(latlng) {
    this._setPoint(latlng);
    this._setLoading();

    nominatim.reverse({
      lat: latlng.lat,
      lon: latlng.lng,
      'accept-language': 'ru-RU',
      addressdetails: 1
    }, (err, location) => {
      this._setReady();
      if (!err) {
        this._search.setValue(this._formatAddress(location));
        this._map.openPopup(this._formatAddress(location), latlng, {
          className: 'address-tooltip'
        });
      }
    });
  }


  /**
   * Sets point and calculates buffers
   * @param {L.LatLng} latlng
   */
  _setPoint(latlng) {
    if (!this._marker) {
      this._marker = L.circleMarker(latlng, POSITION_STYLE)
        .addTo(this._map);
    } else {
      this._marker.setLatLng(latlng);
    }
    location.hash = this._formatHash(latlng);
    this._intersects.clearLayers();

    L.Util.requestAnimFrame(() => this._calculateDistances(latlng), this);
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
    html = '<ul>' + measures.slice().reverse().map((measure) => {
      var feature = measure.feature;
      var distance = (measure.distance === '') ?
        measure.distance :
        (Math.abs(measure.distance).toFixed(2) + ' km');
      return L.Util.template('<li data-feature-id="{id}">' +
        '<label class="topcoat-checkbox">' +
        '<input type="checkbox" data-feature-id="{id}" {checked}> ' +
        '<span class="distance">{distance}</span>' +
        '<span class="name" style="color: {color}">{name}</span>' +
        '</label></li>', {
          color: COLORS[feature.properties.id],
          checked: this._state[feature.properties.id] ? 'checked': '',
          id: feature.properties.id,
          name: locale.names[feature.properties.id],
          distance: distance
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

  /**
   * Render buffers to the map
   */
  _renderBuffers() {
    let buffers = this._bufferData;
    this._buffers.clearLayers();
    if (!buffers) return;

    buffers.features.sort((feature1, feature2) => {
      return feature2.properties.id - feature1.properties.id;
    }).forEach((feature) => {
      if (this._state[feature.properties.id]) {
        this._buffers.addData(feature);
      }
    }, this);
  }

}
