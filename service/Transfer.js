const Queue = require("queue");
const PromiseFtp = require('promise-ftp');
const fs = require("fs");

let Transfer = (appSettings, Logger, Utils) => {
  let client = new PromiseFtp();
  let bmpTmpLocal = appSettings.paths.bmp_temp;
  let bmpMain = appSettings.paths.remote_bmp;
  let bmpBkp = appSettings.paths.remote_bmp_bkp;
  let bmpTempPath = appSettings.paths.bmp_temp;
  let downloaded = 0;
  let skipped = 0;
  let errored = 0;

  /*
      Download and move all files in the main bmp Directory
      If sync is specified then batch setting will be overrided and all
      files will be downloaded.
  */
  let initTransfers = (sync) => {
    sync = sync === true ? true:false;

    return new Promise((resolve, reject) => {
      let q = createQueue();
      let count = 0;

      connect()
      .then(msg => {
        Logger.info("Ftp client connected.");
      })
      .then(getBmpList)
      .then(list => {
        let totalNodes = list.length;
        let fileNamePattern = /[0-9]{13,}-[a-z]{1}-[a-zA-Z0-9]{1,16}.png$/g;
        let clientIndex = 0;
        let batchSize = appSettings.map.zones;

        Logger.info(totalNodes +" total bitmap files. Download batch: "+ appSettings.ftp.batch);

        for (let f=0; f<totalNodes; f++) {
          let node = list[f];
          let filename = node.name;

          // Only process node of type "file" that match the pattern
          if (filename.match(fileNamePattern) === null || node.type !== "-") {
            if (filename !== "." && filename !== "..") {
              Logger.warn("File "+ filename +" skipped");
            }
            continue;
          }

          // Download a batch or all files?
          if (sync === false && appSettings.ftp.batch === true && count === appSettings.map.zones) {
            break;
          }

          let localFile = bmpTmpLocal + filename;
          // If file exists and has the same size, skip
          if (fs.existsSync(localFile)) {
            let stats = fs.statSync(localFile);
            let localFileBytes = stats.size;
            if (localFileBytes === node.size) {
              skipped++;
              continue;
            }
          }

          // Add file download to task queue
          let task = () => { return transferFile(node.name); };
          q.push(task);
          count++;
        }

        // Start Queue
        q.start((err) => {
          if (err) { return reject(err); }
          close()
            .then(Utils.cleanUpTemp)
            .then(resolve);
        });

      })
      .catch(err => {
        return reject(err);
      });

    });
  };

  let connect = () => {
    Logger.info("Ftp client connecting to: "+ appSettings.ftp.host);

    return client.connect({
      host: appSettings.ftp.host,
      user: appSettings.ftp.user,
      password: appSettings.ftp.pass,
      secure: appSettings.ftp.secure
    });
  };

  let close = () => {
    return client.end()
      .then(() => {
        Logger.info("Ftp client closing link.");
      });
  };


  /* Local / Private */


  let getBmpList = (dir) => {
    dir = dir || bmpMain;
    Logger.info("Listing FTP dir: "+ dir);
    return client.list(dir);
  };

  let checkClientStatus = () => {
    return new Promise((resolve, reject) => {
      let status = client.getConnectionStatus();
      if (status === 'connected') {
        resolve("connected");
      } else {
        connect()
        .then((message, err) => {
          if (err) { return reject(err); }
          resolve("reconnected");
        });
      }
    });
  };

  /*
  Transfer a single file and move it to bkp on success
  */
  let transferFile = (file) => {
    return new Promise((resolve, reject) => {
      let tmpFileName = file + "." + new Date().getTime();

      checkClientStatus()
        .then(status => {
          if (status === 'reconnected') {
            Logger.info("Reconnected!");
          }
          client.get(bmpMain + file)
          .then(stream => {

            stream.on('close', () => {
              downloaded++;
              rename(tmpFileName, file)
              .then(() => {
                moveToBkp(file, client)
                .then(res => {
                  resolve(file)
                })
                .catch(reject);
              });
            });

            stream.on('error', (err) => {
              errored++;
              if (err) { reject(err); }
            });

            let writeStream = fs.createWriteStream(bmpTmpLocal + tmpFileName);

            writeStream.on('error', (err) => {
              if (err) { reject(err); }
            });

            stream.pipe(writeStream);
          });
        });
    });
  };

  let remove = (file) => {
    return client.delete(file);
  };

  let rename = (src, dest) => {
    return new Promise((resolve, reject) => {
      fs.rename(bmpTmpLocal + src, bmpTmpLocal + dest, (err) => {
        if (err) { return reject(err); }
        resolve();
      })
    });
  };

  let moveToBkp = (file, client) => {
    return client.rename(bmpMain + file, bmpBkp + file);
  };

  let createQueue = () => {
    let q = Queue({
      concurrency: 2
    });

    q.on('success', (result, job) => {
      Logger.info('Downloaded:'+ result)
    });

    q.on('timeout', (next, job) => {
      Logger.warn('Timed out:'+ job.toString().replace(/\n/g, ''))
    });

    q.on('end', () => {
      Logger.info('Fetched: '+ downloaded +' Skipped: '+ skipped +" Errored: "+ errored);
    });

    return q;
  };

  return {
    connect: connect,
    close: close,
    getBmpList: getBmpList,
    remove: remove,
    initTransfers: initTransfers
  }
};

module.exports = Transfer;
