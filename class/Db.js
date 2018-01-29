const mongoose = require('mongoose');
const Promise = require('bluebird');

let Db = (appSettings, Logger) => {
  let connString;
  let connected = false;
  let conn;

  if (appSettings.mongodb.user && appSettings.mongodb.password) {
    connString = "mongodb://"+ appSettings.mongodb.user +":"+ appSettings.mongodb.password +"@" + appSettings.mongodb.host +":"+ appSettings.mongodb.port + "/" + appSettings.mongodb.db + "?authSource=admin";
  } else {
    connString = "mongodb://"+ appSettings.mongodb.host +":"+ appSettings.mongodb.port + "/" + appSettings.mongodb.db;
  }

  let connect = () => {
    return new Promise((resolve, reject) => {
      mongoose.connect(connString, {
        useMongoClient: true
      }, (err) => {
        if (err) { return reject(err.message); }
      });

      conn = mongoose.connection;

      conn.on('error', (err) => {
        Logger.error(err);
        connected = false;
        reject(err);
      });

      conn.on('connected', () => {
        Logger.info('MongoDB connected to: '+ appSettings.mongodb.host +":"+ appSettings.mongodb.port);
        connected = true;
        resolve();
      });

      conn.on('disconnected', () => {
        Logger.info('MongoDB disconnected');
        conn.removeAllListeners();
        connected = false;
      });
    });
  };

  let close = () => {
    if (connected) {
      conn.close();
    }
    return;
  };

  return {
    connect: connect,
    close: close
  }
};

module.exports = Db;
