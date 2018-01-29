let Services = (appSettings, Logger, mongoose, models, Utils) => {

  let Reader = require("./Reader")(Logger);
  let Server = require("./Server")(appSettings, Logger);
  let Miner = require("./Miner")(appSettings, Logger, models, Utils);
  let Transfer = require("./Transfer")(appSettings, Logger, Utils);
  let StateLogger = require("./StateLogger")(appSettings, Logger, mongoose, models, Utils);
  let Maintainer = require("./Maintainer")(appSettings, Logger, Utils, mongoose, models, Transfer);
  let Registry = require("./Registry")(appSettings, Logger, mongoose, models, Utils, StateLogger, Reader, Maintainer);

  let Controller = require("./Controller")(appSettings, Logger, Server, Miner, Transfer, Registry);

  return {
    Miner: Miner,
    Registry: Registry,
    StateLogger: StateLogger,
    Transfer: Transfer,
    Maintainer: Maintainer,
    Controller: Controller
  };
};

module.exports = Services;
