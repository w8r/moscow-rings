# Moscow Rings

This visualization shows distances of a point to the main transport rings and 
references in Moscow. You can explore what is at exactly the same distance 
from those locations by clicking on the map.

## Problem

It looks quite easy to solve, but as the matter of fact it's not so 
straight-forward)). [Turf](https://github.com/turfjs/turf-buffer) suggests, that
you can build isolines, or buffers, just by putting correct distances into 
[JSTS Topology lib](https://github.com/bjornharrtell/jsts) and off you go. It 
may be correct for distances like 200m, but try and build those buffers around 
different features, putting the correct distances to the nearest points of those 
features. After a couple of attempts and reprojecting the features to meters you
will maybe end up with something like that:

![rings](https://cloud.githubusercontent.com/assets/26884/10547868/3a09e65c-7437-11e5-9bd7-7fc4cae8d1cc.png)

**Rings do not intersect at given point as they should! WHY?!**. Exactly, they 
don't, cause your projection is discrete, that means that you simply cannot
perform geometrical operations like offsetting in it, distances will alway be 
wrong.

## Solution

What you need is equidistantial(distance-preserving) projection, like [this one](http://bl.ocks.org/mbostock/4436875).
You also have to change the origin of the projection to the centroid of the 
feature you are trying to shrink/offset.

```javascript
let centroid =        [33, 55]; // center of your feature
const EARTH_RADIUS =  6378137; // you want to keep the meter precision
let projection = d3.geo.azimuthalEquidistant()
  .rotate([-33, -55])
  .scale(EARTH_RADIUS);
```

With this one you can achieve your [goal](https://w8r.github.io/moscow-rings/).

![screenshot 2015-10-15 17 33 33](https://cloud.githubusercontent.com/assets/26884/10548103/d901d124-7438-11e5-88f2-c7437b772a8f.png)
![screenshot 2015-10-16 14 36 02](https://cloud.githubusercontent.com/assets/26884/10548096/d1515d8c-7438-11e5-903f-93b255c0ee5c.png)


Have fun!
