let Models = (mongoose) => {
  const Bmp = require('./Bmp')(mongoose);
  const Zone = require('./Zone')(mongoose);
  const Area = require('./Area')(mongoose);
  const Log = require('./Log')(mongoose);

  return {
    Bmp: Bmp,
    Zone: Zone,
    Area: Area,
    Log: Log
  };
};

module.exports = Models;
