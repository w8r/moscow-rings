import { point, pointOnLine, linestring } from 'turf';
import Vec2 from 'vec2';
import Polygon from 'polygon';

export function euclidianDistance(coord1, coord2) {
  return Math.sqrt(
    Math.pow(coord1[0] - coord2[0], 2) +
    Math.pow(coord1[1] - coord2[1], 2)
  );
}

export function planarNearestPoint(pt, feature) {
  return point(new Polygon(feature.geometry.coordinates[0])
    .closestPointTo(Vec2.apply(null, pt.geometry.coordinates)).toArray(),
         { feature: feature});
}

export function nearestPoint(pt, feature) {
  return point(pointOnLine(
    linestring(feature.geometry.coordinates[0]), pt
  ).geometry.coordinates, { feature: feature });
}
