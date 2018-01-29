/* Attemp to load app settings */
let appSettings = null;
try {
    appSettings = require("./config/settings.json");
} catch (e) {
    if(e.code === 'MODULE_NOT_FOUND'){
        console.log('ERROR: No config file found.');
    } else {
        console.error(e);
    }
    process.exit();
}

/* Init Logger */
const Logger = require('./class/Logger')(appSettings);
Logger.info("Initializing "+ appSettings.app.name +" v"+ appSettings.app.version);

/* Libraries & 3th party components */
const mongoose = require('mongoose');
const Promise = require('bluebird');
const commandLineArgs = require('command-line-args')
mongoose.Promise = Promise;

/* Local componnents */
const Db = require('./class/Db')(appSettings, Logger);
const Utils = require('./class/Utils')(appSettings, Logger);
const models = require('./model')(mongoose);
const services = require('./service')(appSettings, Logger, mongoose, models, Utils);
const Router = require('./class/Router.js')(appSettings, Logger, services);

/* Define and collect comand line arguments */
const optionDefinitions = [
  { name: 'svc', type: String },
  { name: 'req', type: String },
  { name: 'params', type: String }
];
const request = commandLineArgs(optionDefinitions, { partial: true });

/* Route */
Db.connect()
  .then(() => {
    return Router.route(request)
  })
  .catch(err => {
    Logger.error(err);
  })
  .then(Db.close);
