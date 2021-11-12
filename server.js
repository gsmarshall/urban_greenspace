/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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

var application_root = __dirname;


// Define endpoint at /mapid.
const app = express().get('/mapid', (_, response) => {
  console.log('do Earth Engine API using private key...');
  // var manchester =  ee.Feature(
  //             ee.Geometry.Polygon([[
  //               [-71.54293288787831,42.926820038499166],
  //               [-71.35822524627675,42.926820038499166],
  //               [-71.35822524627675,43.0594105256263],
  //               [-71.54293288787831,43.0594105256263],
  //               [-71.54293288787831,42.926820038499166]
  //             ]]),
  //             {'system:index': '0'}
  //         );

  var visParams = {
    bands: ['R', 'G', 'B'],
    min: 0,
    max: 255
    };
  // const srtm = ee.Image('CGIAR/SRTM90_V4');
  // const slope = ee.Terrain.slope(srtm);
  const naip = ee.ImageCollection('USDA/NAIP/DOQQ').filterBounds(ee.Geometry.Point(-71.45, 42.99)).sort('system:time_start', false).first();
  naip.getMap(visParams, ({mapid}) => response.send(mapid));
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



  // ************************* filter by band availability **********************
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
