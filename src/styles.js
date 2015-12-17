import COLORS from './colors';

const LINE_WIDTH = 5;

export { COLORS };

export const POSITION_STYLE = {
  color: '#f51a1a',
  fillOpacity: 0.5,
  weight: 2,
  radius: 6
};

export function nearestStyle (id) {
  return {
    radius: 8,
    color: COLORS[id]
  };
};

export function ringStyle(feature) {
  return {
    color: COLORS[feature.properties.id],
    weight: LINE_WIDTH / (feature.properties.id + 1),
    opacity: 1,
    fillOpacity: 0.0,
    clickable: false
  };
}

export function bufferStyle(feature) {
  return {
    color: COLORS[feature.properties.id] || '#00f',
    weight: 2, //LINE_WIDTH / (feature.properties.id + 1),
    fillOpacity: 0,
    opacity: 1,
    dashArray: [5, 5],
    clickable: false
  };
}

export function torusStyle(feature) {
  return {
    color: COLORS[feature.properties.id],
    weight: 0,
    opacity: 1,
    fillOpacity: 0.15,
    clickable: false
  };
}


