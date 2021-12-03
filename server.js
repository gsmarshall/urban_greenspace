/**
 * @fileoverview Default entry point for App Engine Node.js runtime. Defines a
 * web service which returns the mapid to be used by clients to display map
 * tiles showing slope computed in real time from SRTM DEM data. See
 * accompanying README file for instructions on how to set up authentication.
 */
const ee = require('@google/earthengine');
const express = require('express');
const privateKey = require('./.private-key.json');
const port = process.env.PORT || 3000;

// const geojson = require('geojson');

var application_root = __dirname;

// Define endpoint at /mapid.
const app = express().get('/mapid', (_, response) => {
  console.log('do Earth Engine API using private key...');


  var visParams = {
    bands: ['R', 'G', 'B'],
    min: 0,
    max: 255
    };

  const manch_pre = new Preprocessing();
  const composite2 = manch_pre.preprocess();

  const lc_class = new ImageClass(composite2);
  lc_class.addclass();

  const census = new CensusAnalysis(lc_class.classified_image, 4, 0.4);
  const cimg = census.census_image;
  census.calculateScores();
  census.visualizeEquityScore();
  // for some reason this returns info for the function first(), not the first object in the collection
  // console.log(census.censusdata.first());
  // console.log(census.tes_manch.first());
  // console.log(lc.getInfo());
  // response.send(composite2.getMap(manch_pre.visParamsMax).mapid);
  // response.send(lc.getMap(lc_class.classparams, ).mapid);

  // getMap() (apparently) needs a callback to work reliably outside of the EE code editor
  // we had problems with this method returning undefined before, but it seems to be working now
  census.tes_image.getMap(census.equity_vis, ({mapid}) => response.send(mapid));

  // trying to load and display census data
  // throwing old error: cannot destructure property 'mapid' of undefined
  // remember: don't use getInfo() or getMap() without a callback! it won't work!
  // cimg.getMap(census.equity_vis, ({mapid}) => response.send(mapid));
});

app.use(express.static(application_root));


console.log('Authenticating Earth Engine API using private key...');
ee.data.authenticateViaPrivateKey(
    privateKey,
    () => {
      console.log('Authentication successful.');
      ee.initialize(
          null, null,
          () => {
            console.log('Earth Engine client library initialized.');
            app.listen(port);
            console.log(`Listening on port ${port}`);
          },
          (err) => {
            console.log(err);
            console.log(
                `Please make sure you have created a service account and have been approved.
Visit https://developers.google.com/earth-engine/service_account#how-do-i-create-a-service-account to learn more.`);
          });
    },
    (err) => {
      console.log(err);
    });



  class Preprocessing {

    constructor(){
      // true color visualization parameters for NAIP image
      this.visParamsMax = {
        bands: ['N_max', 'R_max', 'G_max'],
        min: 0,
        max: 255
      };

      // study region of Manchester, NH explicitly established here - hope to make dynamic later
      this.manchester = ee.FeatureCollection(ee.Geometry.Polygon([[
                    [-71.54293288787831,42.926820038499166],
                    [-71.35822524627675,42.926820038499166],
                    [-71.35822524627675,43.0594105256263],
                    [-71.54293288787831,43.0594105256263],
                    [-71.54293288787831,42.926820038499166]
                  ]]));

      // var preprocessed = ee.Image();
    }


    // filter by images with 4 bands and calculates NDVI
    // returns null if image has less than 4 bands, returns image plus ndvi band for valid 4 band images
    band_filter(image){
      return ee.Algorithms.If(image.bandNames().length().eq(4), image.addBands(image.normalizedDifference(['N', 'R']).rename('NDVI')), null);
    }
    // future: try to buffer study area by a percentage of its width to reduce edge effects
    // also will give more flexibility to dynamically display the data in our app
    // var bounds = manchester.bounds().coordinates().get(0);

    // can use ee.Geometry.Point(-71.45, 42.99) instead of study area - not quite perfect, but will work for now
    // returns composite image of all 4-band naip tiles within the study area
    preprocess(){
      //buffer_dist = manchester.bounds().coordinates();

      // mapping over featurecollection is slower than filtering, but I haven't been able to get filtering by bands to work
      var naip_4band = ee.ImageCollection('USDA/NAIP/DOQQ').filterBounds(this.manchester).map(this.band_filter, true);

      // forms a composite image based on several measures from all images in the collection - not sure how these composites will figure in the
      // classification but we'll keep them for now
      var composite = naip_4band.reduce(ee.Reducer.max())
                    .addBands(naip_4band.reduce(ee.Reducer.mean()))   // include a mean reducer
                    .addBands(naip_4band.reduce(ee.Reducer.percentile([20])))// include a 20th percentile reducer
                    .addBands(naip_4band.reduce(ee.Reducer.max()))// include a standard deviation reducer
                    .float();

      var composite2 = composite.clip(this.manchester);

      return composite2;
    }
  }

  class ImageClass {
    constructor(_input_image){
      this.trainingpts = ee.FeatureCollection('users/gsmarshall/greenspace_training_2');
      this.classparams = {
        min: 1,
        max: 6,
        palette: ['33a02c', 'b2df8a', 'd20606', '6b6687', 'ffeca5', '2b32ff']
      };

      this.input_image = _input_image;
      this.classified_image;
    }

    // classification function with EE random forest classifier
    addclass(){

      // select all bands from input image for classifier - this can be adjusted by specifying an array of bands
      var bands = this.input_image.bandNames(); //['R_max', 'G_max', 'B_max', 'N_max', 'NDVI_max'];

      // Collecting values of the pixels that correspond to our manualy collected
      // training points
      var training = this.input_image.select(bands).sampleRegions({
              collection: this.trainingpts,
              properties: ['Class'],
              scale: 1
              });

      // parameters for a classifier
      var classifier = ee.Classifier.smileRandomForest({
                numberOfTrees: 300,
                //variablesPerSplit: 0,
                minLeafPopulation: 1,
                bagFraction: 0.5,
                //outOfBagMode: true,
                seed: 0
                    });

      // Trained with 70% of our data.
      var trainedClassifier = classifier.train(training, 'Class', bands);

      // // Print the confusion matrix.
      // var confusionMatrix = trainedClassifier.confusionMatrix();
      // print('Confusion Matrix', confusionMatrix);
      // print('Validation overall accuracy: ', confusionMatrix.accuracy());

      // Return the classified image
      this.classified_image = this.input_image.select(bands).classify(trainedClassifier);
    };
  }

class CensusAnalysis {
  constructor(classified_img, _scale, _canopy_goal){
    // this.censusdata = ee.FeatureCollection('./data/priority_indicators_rawv2.geojson');
    this.censusdata = ee.FeatureCollection('users/gsmarshall/priority_indicators_rawv2');
    // this.censusdata = ee.FeatureCollection(geojson.parse(require('./data/priority_indicators_rawv2.json'), {GeoJSON: 'geo'}));
    this.health_data = ee.FeatureCollection('users/gsmarshall/hillsborough_county_health');
    // final collection with equity score - not necessary to declare here, but makes it a bit easier to keep track of
    this.tes_manch;
    // declare image to visualize results
    this.tes_image;
    // Remap supervised classification to boolean image - green vs else
    this.green = classified_img.remap([1,2,3,4,5,6], [1,0,0,0,0,0]);

    this.scale = _scale; // pixel size in meters at which to calculate tree cover - lower is more precise, but runs far slower
    this.canopy_goal = _canopy_goal; // percent canopy cover goal, expressed as a decimal in [0,1]
    this.pixel_area = this.scale*this.scale;

    this.census_image = ee.Image().byte().paint({
      featureCollection: this.censusdata,
      color: 'B01001_001'
    }).paint({
      featureCollection: this.censusdata,
      color: '030303',
      width: 1
    });

    // visualization parameters for final tes score
    this.equity_vis = {
      min: 40,
      max: 100,
      palette: ['#030303', '#edf8fb','#ccece6','#99d8c9','#66c2a4','#41ae76','#238b45','#005824'],
      opacity: 0.7
    };

    // object containing citywide max and min values for priority indicators
    this.priority_extremes = {
      gap: {
        max: undefined
      },
      dep: {
        min: undefined,
        max: undefined
      },
      unemployment: {
        min: undefined,
        max: undefined
      },
      nonwhite: {
        min: undefined,
        max: undefined
      },
      low_income: {
        min: undefined,
        max: undefined
      },
      phys: {
        min: undefined,
        max: undefined
      },
      ment: {
        min: undefined,
        max: undefined
      },
      asthma: {
        min: undefined,
        max: undefined
      },
      chd: {
        min: undefined,
        max: undefined
      }
    };
  }

// ***************************** census analysis *******************************
// essentially a wrapper function for the analysis script
// initializes member variable for final tes data
calculateScores(){
  // map all functions over collection
  // this could potentially be run faster by combining these functions so I only have to do one
  // map() operation, but compared to the computational work of calculating canopy cover it
  // doesn't really make a difference
  let priority_census = this.censusdata.map(this.addLowIncomePct).map(this.addNonWhitePct).map(this.addUnemploymentPct).map(this.addDepRatio);

  // calculate tree cover area
  // specify projection as NAD83/New Hampshire
  // input: boolean classified tree cover, where 1 = tree, 0 = other
  let tree_cover = this.green.reduceRegions({
    collection: priority_census,
    reducer: ee.Reducer.sum(),
    scale: this.scale, // scale of 4 runs reasonably
    crs: 'EPSG:32110',
    tileScale: 4 // tileScale of 4 with scale of 2 runs, but very slowly
  });

  let tree_gap = tree_cover.map(this.setGap(this.pixel_area, this.canopy_goal));

  tree_gap = tree_gap.map(this.addTractID);

  let health_select = this.health_data.select(['tractfips','phlth_crud', 'mhlth_crud', 'casthma_cr', 'chd_crudep'], ['tractfips', 'phys_hlth', 'ment_hlth', 'asthma', 'chd']);
  let filter = ee.Filter.equals({leftField: 'tract_id', rightField: 'tractfips'});
  let health_indicators = ee.Join.inner('primary', 'secondary').apply(tree_gap, health_select, filter);

  let test = health_indicators;

  tree_gap = health_indicators.map(this.cleanJoin);

  // calculate max and min citywide (the whole feature collection) for each indicator
  this.priority_extremes.gap.max = tree_gap.aggregate_max('gap');
  this.priority_extremes.gap.max = ee.Algorithms.If(ee.Number(this.priority_extremes.gap.max).lt(0), 0.0, this.priority_extremes.gap.max); // if max gap score is less than 0, set to 0
  this.priority_extremes.dep.max = tree_gap.aggregate_max('dep_ratio');
  this.priority_extremes.dep.min = tree_gap.aggregate_min('dep_ratio');
  this.priority_extremes.unemployment.max = tree_gap.aggregate_max('unemployed_pct');
  this.priority_extremes.unemployment.min = tree_gap.aggregate_min('unemployed_pct');
  this.priority_extremes.nonwhite.max = tree_gap.aggregate_max('nonwhite');
  this.priority_extremes.nonwhite.min = tree_gap.aggregate_min('nonwhite');
  this.priority_extremes.low_income.max = tree_gap.aggregate_max('low_income');
  this.priority_extremes.low_income.min = tree_gap.aggregate_min('low_income');

  this.priority_extremes.phys.max = tree_gap.aggregate_max('phys_hlth');
  this.priority_extremes.phys.min = tree_gap.aggregate_min('phys_hlth');
  this.priority_extremes.ment.max = tree_gap.aggregate_max('ment_hlth');
  this.priority_extremes.ment.min = tree_gap.aggregate_min('ment_hlth');
  this.priority_extremes.asthma.max = tree_gap.aggregate_max('asthma');
  this.priority_extremes.asthma.min = tree_gap.aggregate_min('asthma');
  this.priority_extremes.chd.max = tree_gap.aggregate_max('chd');
  this.priority_extremes.chd.min = tree_gap.aggregate_min('chd');

  this.tes_manch = tree_gap.map(this.equityScore(this.priority_extremes));
}

// initializes image to visualize equity scores
visualizeEquityScore(){
  this.tes_image = ee.Image().byte().paint({
    featureCollection: this.tes_manch,
    color: 'tes'
  }).paint({
    featureCollection: this.tes_manch,
    color: '030303',
    width: 1
  });
}

// *********************** add census priority indicators ************************
// need to do all the field calculations feature by feature and map over the collection
addLowIncomePct(feature){
  return feature.set({low_income: feature.getNumber('C17002_001').subtract(feature.getNumber('C17002_008')).divide(feature.getNumber('C17002_001'))});
};

addNonWhitePct(feature){
  return feature.set({nonwhite: feature.getNumber('B03002_001').subtract(feature.getNumber('B03002_003')).divide(feature.getNumber('B03002_001'))});
};


addUnemploymentPct(feature){
  return feature.set({unemployed_pct: feature.getNumber('B23025_006').divide(feature.getNumber('B23025_001'))});
};

addSeniorsPct(feature){
  // separate out the sums to make it a bit easier to read
  var seniorsM = feature.getNumber('B01001_020').add(feature.getNumber('B01001_021'))
    .add(feature.getNumber('B01001_022'))
    .add(feature.getNumber('B01001_023'))
    .add(feature.getNumber('B01001_024'))
    .add(feature.getNumber('B01001_025'));

  var seniorsW = feature.getNumber('B01001_044').add(feature.getNumber('B01001_045'))
    .add(feature.getNumber('B01001_046'))
    .add(feature.getNumber('B01001_047'))
    .add(feature.getNumber('B01001_048'))
    .add(feature.getNumber('B01001_049'));

  return feature.set({
    seniors_pct: seniorsM.add(seniorsW).divide(feature.getNumber('B01001_001'))
  });
};

addChildPct(feature){
  // separate out the sums to make it a bit easier to read
  var childM = feature.getNumber('B01001_003').add(feature.getNumber('B01001_004'))
    .add(feature.getNumber('B01001_005'))
    .add(feature.getNumber('B01001_006'));

  var childW = feature.getNumber('B01001_027').add(feature.getNumber('B01001_028'))
    .add(feature.getNumber('B01001_029'))
    .add(feature.getNumber('B01001_030'));

  return feature.set({
    child_pct: childM.add(childW).divide(feature.getNumber('B01001_001'))
  });
};

// add age variables - percent seniors, percent children, dependency ratio
addDepRatio(feature){
  // total population
  var pop = feature.getNumber('B01001_001');

  // separate out the sums to make it a bit easier to read
  var seniorsM = feature.getNumber('B01001_020').add(feature.getNumber('B01001_021'))
    .add(feature.getNumber('B01001_022'))
    .add(feature.getNumber('B01001_023'))
    .add(feature.getNumber('B01001_024'))
    .add(feature.getNumber('B01001_025'));

  var seniorsW = feature.getNumber('B01001_044').add(feature.getNumber('B01001_045'))
    .add(feature.getNumber('B01001_046'))
    .add(feature.getNumber('B01001_047'))
    .add(feature.getNumber('B01001_048'))
    .add(feature.getNumber('B01001_049'));
  // total number of seniors
  var seniors = seniorsM.add(seniorsW);

  // separate out the sums to make it a bit easier to read
  var childM = feature.getNumber('B01001_003').add(feature.getNumber('B01001_004'))
    .add(feature.getNumber('B01001_005'))
    .add(feature.getNumber('B01001_006'));

  var childW = feature.getNumber('B01001_027').add(feature.getNumber('B01001_028'))
    .add(feature.getNumber('B01001_029'))
    .add(feature.getNumber('B01001_030'));
  // total number of children
  var children = childM.add(childW);

  return feature.set({
    seniors_pct: seniors.divide(pop),
    child_pct: children.divide(pop),
    // dependency ratio = (children + seniors)/(pop age 18-64) = (children + seniors)/(total pop - (children + seniors))
    dep_ratio: children.add(seniors).divide(pop.subtract(children.add(seniors)))});
};

// calculate gap score
setGap(pixel_area, canopy_goal){
  // nested function allows extra parameters to be passed into setGap when it is mapped over a collection
  let wrap = function(feature){
    // compute existing canopy cover
    var canopy = feature.getNumber('sum').multiply(pixel_area);
    var est_coverage = canopy.divide(ee.Feature(feature).area());

    // compute canopy cover goal
    var pop = feature.getNumber('B01001_001');
    var density = pop.divide(ee.Feature(feature).area().divide(1000000)); // convert area from m^2 to km^2
    var goal = 1.2 * canopy_goal;
    // set canopy cover goal - values are from tree equity score methodology
    // using ee.algorithm.if because logical operators don't work reliably with EE server side parallelization
    goal = ee.Algorithms.If(density.gt(2000), 1.0 * canopy_goal, goal);
    goal = ee.Algorithms.If(density.gt(4000), 0.8 * canopy_goal, goal);
    goal = ee.Algorithms.If(density.gt(8000), 0.5 * canopy_goal, goal);

    var gap = ee.Number(goal).subtract(est_coverage);
    // set gap to 0 if it is negative
    gap = ee.Algorithms.If(gap.lt(0), 0.0, gap);

    return feature.set({pop_density: density, est_coverage: est_coverage, goal: goal, gap: gap});
  }
  return wrap;
};

// adds census tract fips code as a property of the feature
// enables health data to be joined to census data
addTractID(feature){
  var tractID = feature.getString('GEOID').slice(0, 11);
  return feature.set({tract_id: tractID});
};

// combine columns from joined feature into a single feature
cleanJoin(feature){
  return ee.Feature(feature.get('primary')).copyProperties(feature.get('secondary'));
};

// input: feature with all indicators and canopy gap calcuated
// output: final tree equity score
equityScore(priority_extremes){
  // helper function to normalize a score value between its min and max
  let normalize = function(x, min, max){
    return ee.Number(x).subtract(ee.Number(min)).divide(ee.Number(max).subtract(ee.Number(min)));
  };

  let wrap = function(feature){
    // normalize gap score
    var gap_norm = (feature.getNumber('gap').divide(priority_extremes.gap.max));//.multiply(100);

    // normalize health indicators
    var phys_norm = normalize(feature.getNumber('phys_hlth'), priority_extremes.phys.min, priority_extremes.phys.max);
    var ment_norm = normalize(feature.getNumber('ment_hlth'), priority_extremes.ment.min, priority_extremes.ment.max);
    var asthma_norm = normalize(feature.getNumber('asthma'), priority_extremes.asthma.min, priority_extremes.asthma.max);
    var chd_norm = normalize(feature.getNumber('chd'), priority_extremes.chd.min, priority_extremes.chd.max);
    // average together to make composite health score
    var health_norm = phys_norm.add(ment_norm).add(asthma_norm).add(chd_norm).divide(4);

    // normalize priority indicators
    var dep_norm = normalize(feature.getNumber('dep_ratio'), priority_extremes.dep.min, priority_extremes.dep.max);
    var unemployment_norm = normalize(feature.getNumber('unemployed_pct'), priority_extremes.unemployment.min, priority_extremes.unemployment.max);
    var nonwhite_norm = normalize(feature.getNumber('nonwhite'), priority_extremes.nonwhite.min, priority_extremes.nonwhite.max);
    var low_income_norm = normalize(feature.getNumber('low_income'), priority_extremes.low_income.min, priority_extremes.low_income.max);
    // combine priority indicators and gap score
    var priority = dep_norm.add(unemployment_norm).add(nonwhite_norm).add(low_income_norm).add(health_norm).divide(4);
    var tes = ee.Number(100).multiply(ee.Number(1).subtract(gap_norm.multiply(priority)));

    return feature.set({health_norm: health_norm, priority: priority, tes: tes});
  }
  return wrap;
};


}
  // python for getting study area
  // geometry = None
  //   if self.request.get('rectangle'):
  //     coords = [float(i) for i in self.request.get('rectangle').split(',')]
  //     geometry = ee.FeatureCollection([ee.Feature(
  //         ee.Geometry.Rectangle(coords=coords),
  //         {'system:index': '0'}
  //     )])
  //   else:
  //     geometry = ee.FeatureCollection([
  //         ee.Feature(
  //             ee.Geometry.Polygon([[
  //                 [29.970703125, 31.522361470421437],
  //                 [29.981689453125, 30.05007652169871],
  //                 [32.574462890625, 30.116621582819374],
  //                 [32.4755859375, 31.737511125687828]
  //             ]]),
  //             {'system:index': '0'}
  //         )
  //     ])
