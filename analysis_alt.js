const ee = require('@google/earthengine');

var visParamsMax = {
  bands: ['N_max', 'R_max', 'G_max'],
  min: 0,
  max: 255
};

var manchester =  ee.Feature(
            ee.Geometry.Polygon([[
              [-71.54293288787831,42.926820038499166],
              [-71.35822524627675,42.926820038499166],
              [-71.35822524627675,43.0594105256263],
              [-71.54293288787831,43.0594105256263],
              [-71.54293288787831,42.926820038499166]
            ]]),
            {'system:index': '0'}
        );


// filter by images with 4 bands and calculates NDVI
// returns null if image has less than 4 bands, returns image plus ndvi band for valid 4 band images
var band_filter = function(image){
  return ee.Algorithms.If(image.bandNames().length().eq(4), image.addBands(image.normalizedDifference(['N', 'R']).rename('NDVI')), null);
};
// future: try to buffer study area by a percentage of its width to reduce edge effects
// also will give more flexibility to dynamically display the data in our app
var bounds = manchester.bounds().coordinates().get(0);

// can use ee.Geometry.Point(-71.45, 42.99) instead of study area - not quite perfect, but will work for now
// returns composite image of all 4-band naip tiles within the study area
var preprocess = function(study_area){
  //buffer_dist = manchester.bounds().coordinates();

  // mapping over featurecollection is slower than filtering, but I haven't been able to get filtering by bands to work
  var naip_4band = ee.ImageCollection('USDA/NAIP/DOQQ').filterBounds(study_area).map(band_filter, true);

  // forms a composite image based on several measures from all images in the collection - not sure how these composites will figure in the
  // classification but we'll keep them for now
  var composite = naip_4band.reduce(ee.Reducer.max())
                // .addBands(naip_4band.reduce(ee.Reducer.mean()))   // include a mean reducer
                // .addBands(naip_4band.reduce(ee.Reducer.percentile([20])))// include a 20th percentile reducer
                // .addBands(naip_4band.reduce(ee.Reducer.max()))// include a standard deviation reducer
                .float();

  return composite.clip(study_area);
};

// var composite2 = preprocess(manchester);
// export default function analysis({
//   this.composite2 = preprocess(manchester);
// })

module.export = preprocess(manchester);
