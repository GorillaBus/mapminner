/*
    General utilities

    Eduardo Garcia Rajo
*/
const fs = require("fs");
const Promise = require("bluebird");

let Utils = (appSettings, Logger) => {

  let csvToJson = (csv) => {
    let lines=csv.split("\n");
    let result = [];
    let headers=lines[0].split(",");
    let total = lines.length;
    for(let i=1;i<total;i++){
      if (!lines[i]) {
        continue;
      }
      let obj = {};
      let currentline=lines[i].split(",");
      for(let j=0;j<headers.length;j++){
        obj[headers[j]] = j < 3 ? parseFloat(currentline[j]):currentline[j];
      }
      obj.id = i;
      result.push(obj);
    }
    return result;
  };

  let jsonToFile = (json, filename) => {
    filename = filename || "./output.json";
    try {
      let data = JSON.stringify(json);
      fs.writeFileSync(filename, data, 'utf-8');
    } catch (err) {
      throw err;
    }
    return true;
  };

  let parseTime = (time) => {
    let date = new Date(time);
    var weekday=new Array(7);
    weekday[0]="Lunes"; //"Monday";
    weekday[1]="Martes"; //"Tuesday";
    weekday[2]="Miercoles"; //"Wednesday";
    weekday[3]="Jueves"; //"Thursday";
    weekday[4]="Viernes"; //"Friday";
    weekday[5]="Sabado"; //"Saturday";
    weekday[6]="Domingo"; //"Sunday";

    let min = date.getMinutes();

    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      date: date.getUTCDate(),
      day: weekday[date.getDay()],
      hour: date.getHours(),
      min: min > 9 ? min:("0" + min)
    }
  };

  let readDir = (path) => {
    return new Promise((resolve, reject) => {
      Logger.info("Reading path: "+ path);
      fs.readdir(path, (err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
  };

  /* Search and destroy temporal files */
  let cleanUpTemp = () => {
    return new Promise ((resolve, reject) => {
      let tempFileNamePattern = /[0-9]{13,}-[a-z]{1}[\d]{1,2}.png.[\d]+$/g;

      readDir(appSettings.paths.bmp_temp)
        .then(files => {
          if (!files) {
            resolve();
          }

          let promises = [];
          files.forEach(file => {
            if (file.match(tempFileNamePattern)) {
              let p = removeTempFile(file);
              promises.push(p);
            }
          });

          Promise.all(promises)
            .then(resolve)
            .catch(err => {
              if (err) { return reject(err); }
            });
        })
    })
  };

  let removeTempFile = (file) => {
    return new Promise((resolve, reject) => {
      fs.unlink(appSettings.paths.bmp_temp + file, err => {
        if (err) { return reject(err); }
        Logger.info(file +" removed");
        resolve();
      })
    });
  };

  return {
    csvToJson: csvToJson,
    jsonToFile: jsonToFile,
    parseTime: parseTime,
    readDir: readDir,
    cleanUpTemp: cleanUpTemp
  };
};

module.exports = Utils;
