SRS          = EPSG:4326
MERGED_SHAPE = data/rings.shp
SHAPEFILE    = "Esri Shapefile"
GEOJSON_FILE = data/rings.geojson

data/garden.json:
	ogr2ogr -t_srs "EPSG:4326" -f "GeoJSON" output.json data/Garden.shp

geojson: clean-data
	ogr2ogr -f ${SHAPEFILE} -t_srs ${SRS} ${MERGED_SHAPE} data/Kremlin.shp
	ogr2ogr -f ${SHAPEFILE} -update -append ${MERGED_SHAPE} data/Red_Square.shp -nln file_merged
	ogr2ogr -f ${SHAPEFILE} -update -append ${MERGED_SHAPE} data/Boulevard.shp -nln file_merged
	ogr2ogr -f ${SHAPEFILE} -update -append ${MERGED_SHAPE} data/Garden.shp -nln file_merged
	ogr2ogr -f ${SHAPEFILE} -update -append ${MERGED_SHAPE} data/Third.shp -nln file_merged
	ogr2ogr -f ${SHAPEFILE} -update -append ${MERGED_SHAPE} data/MKAD.shp -nln file_merged
	ogr2ogr -f "GeoJSON" -t_srs ${SRS} ${GEOJSON_FILE} ${MERGED_SHAPE}

clean-data:
	rm -f ${MERGED_SHAPE}
	rm -f ${GEOJSON_FILE}
