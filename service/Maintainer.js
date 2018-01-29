const Promise = require("bluebird");
const Queue = require("queue");
const fs = require("fs");
const mv = require("mv");

let Maintainer = (appSettings, Logger, Utils, mongoose, models, Transfer, Registry) => {

  /*
      Finds and removes inconsistent Bitmaps and associated State Logs
      All files associated with inconsistent content are moved back to the
      predefined temporal directory so that they be registered on next run
  */
  let reshapeDb = () => {
    return new Promise((resolve, reject) => {
      Logger.info("Attemping to repair DB...");

      getAggregatedLogCount()
      .then(list => {

        findConsistencyErrors(list)
          .then(errors => {

            if (errors.length === 0) {
              Logger.info("DB does not need repair")
              return resolve();
            }

            let promises = [];
            errors.forEach(error => {
              let p = repairInconsistencyError(error);
              promises.push(p);
            });

            Promise.all(promises)
              .then(() => {
                resolve();
              })
              .catch(reject);

          })
          .catch(reject);
      });

    });
  };


  /*
      Generates the data-model for the map to be used.
      A map is divided in Zones which must also be be divided into Areas.
      The default setting is 64 areas per Zone. You can change this to 128 or
      256 if you think you need more resolution.
      Remember you are responsible for finding your Zones and Areas
      coordinates (for the moment at least!)
  */
  let createMapModel = (zoneFile, force) => {
    zoneFile = zoneFile || appSettings.map.model_file;

    if (force != true) { force = false; }
    return new Promise((resolve, reject) => {
      let areaCount = appSettings.map.areas_per_zone;

      checkDbEmptyMapModel(force)
        .then(() => {
          if (!fs.existsSync(zoneFile)) {
            return reject("Missing zone definition file");
          }

          let zones = require("../" + zoneFile);
          let zonesTotal = zones.length;
          Logger.info("Creating map model...");

          createMapZones(zones)
            .then(results => {
              Logger.info("Created map model with "+ zonesTotal +" Zones and "+ areaCount +" Areas");
              resolve();
            })
            .catch(err => {
              return reject(err);
            });
        })
        .catch(err => { return reject(err); });
    });
  };

  /*
      When files are collected on a remote server and are accessed via FTP,
      each successfully donwloaded file will be moved to the server's "/bkp/"
      directory.

      This method gets a list of all backed-up files and verifies if they have
      been successfully downloaded and registered on the local server.
  */
  let verifyFromBkp = () => {
    return new Promise((resolve, reject) => {
      if (appSettings.ftp.use_ftp === false) {
        return reject("Please check your FTP settings");
      }

      Logger.info("Verifying bitmaps from FTP back-up...");

      let q = new Queue({
        concurrency: 2
      });

      q.on('success', (result, job) => {
        Logger.info("Passed: "+ result);
      });

      Transfer.connect()
        .then(msg => {

          Transfer.getBmpList('bkp')
            .then(list => {
              let total = list.length;
              let promises = [];
              list.forEach(file => {
                if (file.name === "." || file.name === "..") return;

                let task = () => {
                  return new Promise((resolve, reject) => {
                    models.Bmp.find({
                        file: file.name
                      })
                      .then(dbFile => {
                        if (!dbFile || dbFile.length === 0) {
                          let err = "File "+ file.name +" is not registered";
                          return reject(err);
                        }

                        // File exists?
                        if (!fs.existsSync("bmp/" + file.name)) {
                          let err = "File "+ file.name +" does not exist";
                          return reject(err);
                        }

                        // Delete passed file
                        Transfer.remove("bkp/" + dbFile[0].file)
                          .then(msg => {
                            Logger.info(dbFile[0].file +" removed");
                            resolve(dbFile[0].file);
                          })
                          .catch(err => {
                            return reject(err);
                          });

                      })
                      .catch(err => {
                        return reject(err);
                      });

                  });
                };
                q.push(task);
              });

              q.start((err) => {
                if (err) { return reject(err); }
                Logger.info("Bitmap check from FTP back-up finished!");
                Transfer.close();
                resolve();
              });

            }).catch(err => {
              return reject(err);
            });

        })
        .catch(err => {
          return reject(err);
        });

    }).catch(err => {
      return reject(err);
    });
  };


  /* Local / Private */


  let repairInconsistencyError = (data) => {
    return new Promise((resolve, reject) => {
      Logger.info("Repairing error "+ data.code +" @ "+ data.time);

      // Get zone ObjectId
      models.Zone.find({
        code: data.code
      },{
        _id: 1
      })

      // Remove related logs
      .then(res => {

        models.Log.remove({
          time: data.time,
          zone: mongoose.Types.ObjectId(res[0]._id)
        })
        .then(logRes => {

          // Remove related Bitmap
          models.Bmp.remove({
            file: data.file
          })
          .then(bmpRes => {

            if (logRes.result.n > 0 || bmpRes.result.n > 0) {
              Logger.info("Removed "+ logRes.result.n +" logs, "+ bmpRes.result.n +" bitmaps");

              // Move the bitmap back to the predefined temporal directory
              let src = appSettings.paths.bmp + data.file;
              if (fs.existsSync(src)) {
                let dst = appSettings.paths.bmp_temp +"/"+ data.file;
                mv(src, dst, (err, file) => {
                  if (err) { return reject(err); }
                  Logger.info("File "+ src +" moved to temporal directory");
                  resolve();
                });


              // File could be sitting somewhere else on an alternative directory, leave it
              } else {

                Logger.warn("File "+ src +" not found on main directory");
                resolve();
              }

            } else {

              reject("Nothing to repair on "+ data.code +" @ "+ data.time);
            }
          });
        });
      })

    });
  };

  /*
      Given an aggregated list of Logs ~ Zone + Time will verify if every
      item has the correct number of logs and if the source for the item
      is registered.
  */
  let findConsistencyErrors = (data) => {
    return new Promise((resolve,reject) => {
      let q = new Queue({
        concurrency: 1
      });

      // Acumulate inconsistent logs for a Zone at a given Time
      let errors = [];

      data.forEach(res => {
        let code = res._id.zone.code;
        let time = res._id.time;
        let filename = time +"-"+ code + ".png";
        let count = res.count;
        let response = {
          file: filename,
          time: time,
          code: code
        };

        let task = () => {
          return new Promise((resolve, reject) => {

            if (count != appSettings.map.areas_per_zone) {
              Logger.warn(time +" - "+ code +": invalid log count "+ count);
              errors.push(response);
              return resolve();
            }

            models.Bmp.find({
              file: filename
            })
            .then(bmp => {
              if (bmp.length < 1) {
                Logger.warn(time +" - "+ code +": "+ filename +" not found");
                errors.push(response);
                return resolve();

              } else {

                return resolve();
              }
            })
            .catch(reject);
          });
        };

        q.push(task);
      });

      // Resolve promise returning the array of errors
      q.start(err => {
        if (err) {
          return reject(err);
        }
        resolve(errors);
      });

    });

  };

  let getAggregatedLogCount = () => {
    return models.Log.aggregate([
      {
        $group: {
          _id: {
            zone: "$zone",
            time: "$time"
          },
          count: {
            $sum: 1
          }
        }
      }
    ])
    .allowDiskUse(true)
    .then(results => {
      return models.Zone.populate(results, { path: "_id.zone" });
    });
  };

  let createMapZones = (zones) => {
    let promises = [];
    for (let i=0; i<zones.length; i++) {
      let zone = zones[i];
      let p = models.Zone.create({
        long: zone.long,
        lat: zone.lat,
        code: zone.code,
        areas: []
      })
      .then(result => {
        return createZoneAreas(result, zone.areas);
      });

      promises.push(p);
    }
    return Promise.all(promises);
  };

  /*
      zone = mongoose Zone model
      areas = Zone areas json
  */
  let createZoneAreas = (zone, areas) => {
    let promises = [];
    areas.forEach(_area => {
      let p = models.Area.create({
        id: _area.id,
        order: _area.order,
        long: _area.long,
        lat: _area.lat,
        zone: mongoose.Types.ObjectId(zone._id)
      });
      // Each Promise returns the created Area object
      promises.push(p);
    });

    // Push the created Area IDs into the Zone object
    return Promise.all(promises)
      .then(areas => {
        areas.forEach(_area => {
          zone.areas.push(mongoose.Types.ObjectId(_area._id));
        });
        return zone.save();
    });
  };

  // Verify if DB has any Zone / Area defined
  let checkDbEmptyMapModel = (remove) => {
    if (remove === true) {
      if (models.Zone.db.name == "trafico") {
        throw Error("Wo! Change the database!");
        return;
      }

      return models.Zone.remove({})
        .then(() => {
          return models.Area.remove({});
        });
    }

    return new Promise((resolve, reject) => {
      models.Zone.count()
        .then(zoneCount => {
          models.Area.count()
            .then(areaCount => {
              if (zoneCount > 0 || areaCount > 0) {
                return reject("Cant create map model on non-empty database");
              }
              resolve();
            })
        })
        .catch(err => {
          return reject(err);
        })
    });
  };

  return {
    createMapModel: createMapModel,
    verifyFromBkp: verifyFromBkp,
    reshapeDb: reshapeDb
  }

};

module.exports = Maintainer;
