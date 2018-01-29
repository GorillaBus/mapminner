const Promise = require("bluebird");
const Pageres = require("pageres");

let Miner = (appSettings, Logger, models, Utils) => {
  let ua;
  let time;

  /* Public access */


  /* Initialize the mining queue, zone per zone */
  let mine = () => {
    return new Promise((resolve, reject) => {
      getZones()
      .then(mineZones)
      .then(resolve)
      .then(Utils.cleanUpTemp())
      .catch(err => {
        reject(err);
      });
    });
  };


  /* Local / Private */


  /* Recursively process zones */
  let mineZones = (zones) => {
    return new Promise((resolve, reject) => {
      let index = 0;
      let total = zones.length;

      setTime();

      // When the promise resolves, process next zone
      let next = () => {
        if (index < total) {
          let zone = zones[index++];

          gather(zone)
          .then(next)
          .catch(reject);

        } else {

          resolve();
        }
      };

      // Start mining zones
      next();
    });
  };

  let getBaseUrl = () => {
    let url;
    if (appSettings.mining.use_native_server === true) {
      url = "http://" + appSettings.http.host +":" + appSettings.http.port;
    } else {
      url = appSettings.mining.service_url;
    }
    return url;
  };

  let gather = (zone) => {
    let ua = getUA();
    let baseUrl = getBaseUrl();
    let url = baseUrl + "?lat="+ zone.lat +"&lon="+ zone.long +"&key="+ appSettings.mining.api_key;
    let fileName = time +"-"+ zone.code;
    let delay = appSettings.mining.delay;
    let options = {
      crop: true,
      delay: appSettings.mining.delay,
      format: "png",
      filename: fileName,
      timeout: appSettings.mining.timeout,
      userAgent: ua
    };

    Logger.info("Processing zone: "+ zone.code);

    // Returns a Promise for an array of Streams
    let resource = new Pageres({ delay: 2 }); //
    resource.on("warning", err => { Logger.warn(err) });
    resource.src(url, [appSettings.mining.size], options);
    resource.dest(appSettings.paths.bmp_temp)

    return resource.run();
  };

  let getZones = () => {
    return models.Zone.count()
      .then(total => {
        return models.Zone.aggregate([
          {
            $sample: { size: total }
          },{
            $project: {
              long: "$long",
              lat: "$lat",
              code: "$code"
            }
          }
        ]);
    });
  };

  let setTime = () => {
    time = Date.now();
  };

  let setUA = () => {
    let userAgent = appSettings.mining.user_agent;
    let re = /(.+)\.json/g;
    if (re.test(userAgent)) {
      userAgent = require('../config/ua.json');
    }
    ua = userAgent;
  };

  let getUA = () => {
    if (ua instanceof Array) {
      let n = Math.floor(Math.random() * (ua.length));
      return ua[n];
    }
    return ua;
  };



  /* Initialization */
  setUA();



  /* Exposure */
  return {
    mine: mine
  }
};

module.exports = Miner;
