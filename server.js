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

const analysis = require('./analysis.js');
// const analysis_alt = require('./analysis_alt.js');

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
  console.log(manch_pre.visParamsMax);
  response.send(composite2.getMap(manch_pre.visParamsMax).mapid);
  //composite2.getMap(visParams, ({mapid}) => response.send(mapid));
  // slope.getMap({min: 0, max: 60}, ({mapid}) => response.send(mapid));
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
      this.manchester =  ee.Feature(
                  ee.Geometry.Polygon([[
                    [-71.54293288787831,42.926820038499166],
                    [-71.35822524627675,42.926820038499166],
                    [-71.35822524627675,43.0594105256263],
                    [-71.54293288787831,43.0594105256263],
                    [-71.54293288787831,42.926820038499166]
                  ]]),
                  {'system:index': '0'}
              );

      var preprocessed = ee.Image();
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
      var study_area = this.manchester;

      // mapping over featurecollection is slower than filtering, but I haven't been able to get filtering by bands to work
      var naip_4band = ee.ImageCollection('USDA/NAIP/DOQQ').filterBounds(ee.Geometry.Point(-71.45, 42.99)).map(this.band_filter, true);

      // forms a composite image based on several measures from all images in the collection - not sure how these composites will figure in the
      // classification but we'll keep them for now
      var composite = naip_4band.reduce(ee.Reducer.max())
                    // .addBands(naip_4band.reduce(ee.Reducer.mean()))   // include a mean reducer
                    // .addBands(naip_4band.reduce(ee.Reducer.percentile([20])))// include a 20th percentile reducer
                    // .addBands(naip_4band.reduce(ee.Reducer.max()))// include a standard deviation reducer
                    .float();
      console.log(composite.getInfo());
      return composite.clip(study_area);
    }
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
