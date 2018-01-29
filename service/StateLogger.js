const Promise = require("bluebird");
const Queue = require("queue");
const fs = require("fs");

let StateLogger = (appSettings, Logger, mongoose, models, Utils) => {
  let days = appSettings.language.week_days;
  let months = appSettings.language.months;

  let find = (query) => {
    return models.Log.find(query);
  };

  /* Saves a new log with the data of interest */
  let create = (log) => {
    return new Promise((resolve, reject) => {

      // Pixel data to be logged
      let pixelData = {
        hi: log.data.r,
        mid: log.data.o,
        low: log.data.g,
        null: log.data.n
      };

      // Time data
      let timeData = getTimeData(log.time);

      // Complete Log
      let logData = {
        time: log.time,
        date: timeData.date,
        year: timeData.year,
        month: timeData.month,
        day: timeData.day,
        hour: timeData.hour,
        minute: timeData.minute,
        month_str: timeData.month_str,
        day_str:timeData.day_str,
        reg: pixelData,
        score: calculateScore(pixelData),
        area: mongoose.Types.ObjectId(log.area),
        zone: mongoose.Types.ObjectId(log.zone)
      };

      /*
        Should we check if logs where already inserted (and overwirte)?
        Or may you need a bit more of speed and want to insert logs with
        no verification: please note you may want to set config:

          register.auto_repair = true

        to keep your DB consistent
      */
      if (appSettings.register.log_upser === true) {

        models.Log.update({
          time: log.time,
          area: mongoose.Types.ObjectId(log.area)
        }, logData, { upsert: true })
        .then(createdLog => {
          resolve(createdLog);
        })
        .catch(reject);

      } else {

        models.Log.create(logData)
        .then(createdLog => {
          resolve(createdLog);
        })
        .catch(reject);
      }

    });
  };


  /* Private / Local */


  let calculateScore = (reg) => {
    return (reg.hi * 3) + (reg.mid * 2) + reg.low;
  };

  let getTimeData = (time) => {
    let dt = new Date(time);
    let date = dt.toLocaleDateString().split("-");
    let hour = dt.toLocaleTimeString().split(":");
    let data = {
      date: null,
      year: date[0],
      month: date[1],
      day: date[2],
      hour: hour[0],
      minute: hour[1],
      month_str: months[parseInt(date[1])-1],
      day_str: days[dt.getDay()]
    };
    data.date = dt;
    return data;
  };

  return {
    create: create
  }
};

module.exports = StateLogger;
