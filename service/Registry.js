const mv = require("mv");
const fs = require("fs");
const Promise = require("bluebird");
const Queue = require("queue");

let Registry = (appSettings, Logger, mongoose, models, Utils, StateLogger, Reader, Maintainer) => {
  let bmpPath = appSettings.paths.bmp;
  let bmpTempPath = appSettings.paths.bmp_temp;

  let consistencyCheck = () => {
    return new Promise((resolve, reject) => {

      models.Log.count()
        .then(totalLogs => {
          models.Bmp.count()
            .then(totalBmps => {

              let logsPerBmps = totalBmps * appSettings.map.areas_per_zone;
              if (logsPerBmps === totalLogs) {
                Logger.info("Consistency check passed: "+ totalLogs +" logs, "+ totalBmps +" bitmaps");
                resolve(totalLogs);

              } else {

                Logger.debug("Failed consistency cehck: bmps="+ totalBmps +", logs="+ totalLogs +", expected logs="+ logsPerBmps);

                if (appSettings.register.auto_repair_db != true) {
                  return reject("Consistency check failed.");
                }

                // Attemp to auto-repair DB inconsistency errors
                Maintainer.reshapeDb()
                  .then(res => {
                    resolve();
                  })
                  .catch(reject);
              }
            });
        });
    });
  };

  /*
      Register all bitmaps in the predefined directory.
      By default uses option 'tmp'; using the temporal directory.
      Use 'bmp' to check that all bitmaps from the main directory where correctly registered.
  */
  let registerFiles = (src_dir) => {
    return new Promise((resolve, reject) => {

      // Check DB consistency
      consistencyCheck()
        .then(res => {
          let moveFiles = false;
          let q = createBmpQueue();

          switch (src_dir) {
            case 'bmp':
              src_dir = bmpPath;
              break;

            default:
              src_dir = bmpTempPath;
              moveFiles = true;
          }

          Utils.readDir(src_dir)
            .then(files => {

              // When using 'bmp' to verify if all bitmaps had been registered, I'd like to start from the most recent files
              if (src_dir === bmpPath) {
                files.reverse();
              }

              let total = files.length;
              let fileNamePattern = /[0-9]{13,}-[a-z]{1}[\d]{1,2}.png$/g;
              for (let f=0; f<total; f++) {
                let file = files[f];
                if (file.match(fileNamePattern) === null) {
                  Logger.warn("File "+ file +" doesn't match the pattern");
                  continue;
                }

                let task = () => {
                  return new Promise((resolve, reject) => {
                    register(src_dir + file)
                      .then(bmp => {
                        // Move file to the main predefined main directory
                        if (moveFiles) {
                          let src = src_dir + file;
                          let dst = bmpPath + file;
                          let mustMove = true;
                          let mustDelete = false;
                          let response = bmp ? file:null;

                          // File already exist in main directory and has different size
                          if (fs.existsSync(dst)) {
                            let srcStats = fs.statSync(src);
                            let dstStats = fs.statSync(dst);

                            if (srcStats.size !== dstStats.size) {
                              dst = bmpPath + file +".v"+ new Date().getTime();
                            } else {
                              mustMove = false;
                              mustDelete = true;
                            }
                          }

                          // Source bitmap: Leave, Move or Delete
                          if (mustMove) {
                            mv(src, dst, (err, file) => {
                              if (err) { return reject(err); }
                              resolve(response);
                            });
                          } else if (mustDelete) {
                            fs.unlinkSync(src)
                            resolve(response);
                          }

                        } else {

                          resolve(response);
                        }
                      })
                      .catch(err => {
                        return reject("On file: "+ file +", "+ err);
                      });
                  });

                };
                q.push(task);
              }

              Logger.info("Processing queue with "+ q.length +" bitmap files");

              // Process queue
              q.start((err) => {
                if (err) { return reject(err); }
                resolve();
              });

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

  /* Registers a new bitmap file and saves the state of the map zone */
  let register = (file) => {
    return new Promise((resolve, reject) => {

      if (!file) {
        let err = "Invalid bitmap file specified";
        return reject(err);
      }

      let arr = file.split("/");
      let filename = arr[arr.length-1];

      // Verify if BMP is already registered
      models.Bmp.find({
        file: filename
      })
      .then(bmp => {

        // If BMP already exists...
        if (bmp.length > 0) {
          Logger.warn("Bmp "+ bmp[0].file +" already exists ("+ bmp.length +")");
          resolve();

        // If not, register new BMP...
        } else {

          // Get Time and Zone from filename
          let parsedData = parseBmpFileName(filename);

          // Find bitmap's zone
          let zonePromise = models.Zone.find({ code: parsedData.code }, { _id: 1, areas: 1, });

          // Find bitmap's pixel data
          let pngDataPromise = Reader.readBmp(file);

          // Once we have the Zone and the Pixel data...
          Promise.all([zonePromise, pngDataPromise])
            .then(results => {
              let zone = results[0];
              let pixelData = results[1];

              // Save the state of all the areas in the Zone
              saveZoneState(zone[0], parsedData.time, pixelData)
                .then(results => {
                  // If zone state was saved, register the bitmap file
                  models.Bmp.create({
                    date: new Date(parsedData.time),
                    file: filename,
                    zone: mongoose.Types.ObjectId(zone._id)
                  })
                  .then(bmp => {
                    resolve(bmp);
                  });

                })
                .catch(reject);

            })
            .catch(reject);
        }

      })
      .catch(reject);;

    });
  };


  /* Local / Private */


  /*
      Saves the state of the map zone in a specified time.
      By default a Zone is divided in 64 areas, each area state
      is saved as a 'log'.
  */
  let saveZoneState = (zone, time, data) => {
    return new Promise((resolve, reject) => {
      let promises = [];
      let totalAreas = zone.areas.length;
      for (let a=0; a<totalAreas; a++) {
        let area = zone.areas[a];
        let p = StateLogger.create({
            time: time,
            data: data[a],
            area: area,
            zone: zone._id
          });
        promises.push(p);
      }

      // When all promises settle:
      Promise.all(promises.map((promise) => {
          return promise.reflect();
      })).each(function(inspection) {
        if (inspection.isFulfilled()) {
          resolve(inspection.value());
        } else {
          reject(inspection.reason());
        }
      });

    });
  };

  /* Simply divides the filename string into parts that will represent time and map zone */
  let parseBmpFileName = (filename) => {
      let pieces = filename.split("-");
      let time = parseInt(pieces[0]);
      let code = pieces[1].split(".")[0];
      return { time: time, code: code };
  };

  let createBmpQueue = () => {
    let q = Queue({
      concurrency: appSettings.register.queue_max
    });

    q.on('success', (result) => {
      if (result) {
        Logger.info("Registered bitmap: "+ result);
      }
    });

    q.on('timeout', (next, job) => {
      let err = 'job timed out:'+ job.toString().replace(/\n/g, '');
      Logger.warn(err);
    });

    return q;
  };


  return {
    register: register,
    registerFiles: registerFiles
  }
};

module.exports = Registry;
