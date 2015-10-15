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
import { EPSG3857, equidistant, abstractEquidistant } from './projection';
import { project, unproject, buffer } from './geojson';
import Polygon from 'polygon';
import Vec2 from 'vec2';

global.turf = turf;

const MAP_STYLE = 'mapbox.dark';
const LINE_WIDTH = 4;

const POSITION_STYLE = {
  color: '#f51a1a',
  fillOpacity: 0.5,
  weight: 2,
  radius: 6
}

function euclidianDistance(coord1, coord2) {
  return Math.sqrt(
    Math.pow(coord1[0] - coord2[0], 2) +
    Math.pow(coord1[1] - coord2[1], 2)
  );
}

function sdistance (latlon1, latlon2, crs) {
  let p1 = crs.project(latlon1);
  let p2 = crs.project(latlon2);

  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}



function ringStyle(feature) {
  return {
    color: COLORS[feature.properties.id],
    weight: LINE_WIDTH / (feature.properties.id + 1),
    fillOpacity: 0.1,
    clickable: false
  };
}

function bufferStyle(feature) {
  return {
    color: COLORS[feature.properties.id] || '#00f',
    weight: 2, //LINE_WIDTH / (feature.properties.id + 1),
    fillOpacity: 0,
    dashArray: [5, 5],
    clickable: false
  };
}

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

    this._geojson = L.geoJson(data, { style: ringStyle });

    //console.time('proj');
    this._projected = project(data, this._map.options.crs);

    this._equidistant = project(data, equidistant);

    this._equidistant.features.forEach((f) => {
      f.properties.centroid =
        gjutils.centroid(f.geometry).coordinates;
    });
    //console.timeEnd('proj');

    //console.time('unproj');
    //let unprojected = unproject(projected, this._map.options.crs);
    //console.timeEnd('unproj');

    if (!this._positioned) {
      map.fitBounds(this._geojson.getBounds(), {
        padding: [20, 20]
      });
    }
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

    L.Util.requestAnimFrame(() => this._calculateDistances(evt.latlng), this);
  }

  _calculateDistances(latlng) {
    let intersections = [];
    let eintersections = [];
    let point = turf.point([latlng.lng, latlng.lat]);
    let epoint = turf.point(abstractEquidistant.project([latlng.lng, latlng.lat]));

    console.log('you clicked', JSON.stringify(epoint));

    this._geojson.eachLayer((layer) => {
      let f = layer.feature;
      let ef = this._equidistant.features.filter((e) => {
        return e.properties.id === f.properties.id;
      })[0];

      // console.log(f, ef);

      let centroid = L.latLng(f.properties.centroid.slice().reverse());

      let intersects = gjutils.lineStringsIntersect(
        { coordinates: f.geometry.coordinates[0] },
        { coordinates: [f.properties.centroid.slice(), point.geometry.coordinates] }
      );

      let eintersects = gjutils.lineStringsIntersect(
        { coordinates: ef.geometry.coordinates[0] },
        { coordinates: [ef.properties.centroid.slice(), epoint.geometry.coordinates] }
      );

      // (eintersects || []).forEach((p) => {
      //   console.log('intersect', p.coordinates, abstractEquidistant.unproject(p.coordinates.slice().reverse()));
      //   L.circleMarker(
      //     abstractEquidistant.unproject(p.coordinates.slice().reverse()).reverse(), {
      //       radius: 5,
      //       color: '#fff'
      //     }).addTo(this._map);
      // }, this);

      if (intersects) {
        intersects = intersects.pop();
        intersects.coordinates.reverse();
        L.circleMarker(intersects.coordinates.slice().reverse(), {
          radius: 2,
          color: COLORS[f.properties.id]
        }); // .addTo(this._intersects);
        intersects = turf.point(intersects.coordinates, { feature : f });
        // intersections.push(intersects);
      }

      let nearest = turf.pointOnLine(
        turf.linestring(f.geometry.coordinates[0]), point);

      let epolygon = new Polygon(ef.geometry.coordinates[0]);
      let enearest = new Polygon(ef.geometry.coordinates[0])
         .closestPointTo(Vec2.apply(null, epoint.geometry.coordinates)).toArray();

      L.circleMarker(abstractEquidistant.unproject(enearest).slice().reverse(), {
          radius: 8,
          color: COLORS[f.properties.id]
        }).addTo(this._intersects);

      enearest = turf.point(enearest);

      L.circleMarker(nearest.geometry.coordinates.slice().reverse(), {
          radius: 2,
          color: COLORS[f.properties.id]
        }).addTo(this._intersects);

      nearest.properties.feature = f;
      enearest.properties.features = ef;

      intersections.push(nearest);
      eintersections.push(enearest);

      // visual
      // L.polyline([latlng, centroid], {
      //   weight: 1
      // }).addTo(this._map);
    }, this);

    this._info.innerHTML = '<pre>' +
        JSON.stringify(intersections.map((i, index) => {
          let distance = turf.distance(
              point, turf.point(i.geometry.coordinates.slice()),
              "kilometers"
          );
          let sqdistance = sdistance(
            L.latLng(i.geometry.coordinates.slice().reverse()),
            L.latLng(point.geometry.coordinates.slice().reverse()),
            map.options.crs
          ) / 1000;


          let ldistance = L.latLng(i.geometry.coordinates.slice().reverse())
            .distanceTo(L.latLng(point.geometry.coordinates.slice().reverse())) / 1000;

          // console.log(distance, sqdistance, ldistance);
          // distance = sqdistance;
          // distance = ldistance;
          let edistance = euclidianDistance(
            eintersections[index].geometry.coordinates,
            epoint.geometry.coordinates);

          if (turf.inside(point, i.properties.feature)) {
            distance = -distance;
            edistance = -edistance;
          }
          i.properties.distance = distance;
          eintersections[index].properties.distance = edistance;


          return {
            [i.properties.feature.properties.name] :
              distance.toFixed(1) + ' km'
          }
        }), 0, 2) +
      '</pre>';

    L.Util.requestAnimFrame(() => this._calculateBuffers(intersections, eintersections), this);
  }

  _calculateBuffers(intersections, eintersections) {
    let buffers = [];
    let ebuffers = [];

    intersections.forEach((i, index) => {
      if (i.properties.distance > 0) {
        let projectedFeature = this._projected.features[index];
        let feature = i.properties.feature;

        let eprojectedFeature = this._equidistant.features[index];

        // console.log(projectedFeature.properties.name,
        //   feature.properties.name, i.properties.distance * 1000);

        // console.log(eprojectedFeature,
        //     eintersections[index].properties.distance)



        ebuffers = ebuffers.concat(
          buffer(
             eprojectedFeature,
             eintersections[index].properties.distance
           ).features
          .map((f) => {
             f.properties.id = i.properties.feature.properties.id;
             return f;
        }));

        // buffers = buffers.concat(
        //   buffer(
        //     projectedFeature,
        //     i.properties.distance * 2000
        //   ).features
        //   .map((f) => {
        //     f.properties.id = i.properties.feature.properties.id;
        //     return f;
        //   }));
      }
    }, this);

    //buffers = turf.featurecollection(buffers);
    //buffers = unproject(buffers, map.options.crs);

    ebuffers = turf.featurecollection(ebuffers);
    ebuffers = unproject(ebuffers, equidistant);


    this._buffers.clearLayers();
    this._buffers.addData(ebuffers);
  }

}
