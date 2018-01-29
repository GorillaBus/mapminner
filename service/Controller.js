
let Controller = (appSettings, Logger, Server, Miner, Transfer, Registry) => {

  /*
      Generates the zone bitmaps and saves the files into the predefined
      temporal directory, ready for registration.
  */
  let generate = () => {
    if (appSettings.mining.use_native_server === true) {
      Server.start();
    }
    return Miner.mine()
      .then();
  };


  /*
      Reads all files in the predefined temporal directory and registers
      all the contained data. Will move the files to the main directory on
      finish.
  */
  let register = () => {
    return Registry.registerFiles();
  };


  /*
      When bitmaps are generated on a remote server you can download them
      via FTP and register the bitmaps locally.
      This will download all files into the predefined temporal directory.
      You can choose to download all available files or just as a batch of
      n files (where n is equal to the number of zones in the system).
  */
  let fetch = () => {
    if (appSettings.ftp.use_ftp === false) {
      return Promise.reject("Please check your FTP settings");
    }
    return Transfer.initTransfers();
  };


  /*
      Will first generate the bitmaps and then will register each generated file.
  */
  let generateAndRegister = () => {
    if (appSettings.mining.use_native_server === true) {
      Server.start();
    }
    return Miner.mine()
      .then(Registry.registerFiles)
      .then(Server.stop);
  };


  /*
      Will first fetch the bitmaps via FTP and then will register downloaded files.
      If you generate the bitmaps on a remote server this may be your best
      option.
  */
  let fetchAndRegister = () => {
    if (appSettings.ftp.use_ftp === false) {
      return Promise.reject("Please check your FTP settings");
    }
    return Transfer.initTransfers()
      .then(Registry.registerFiles);
  };

  return {
    generate: generate,
    register: register,
    fetch: fetch,
    generateAndRegister: generateAndRegister,
    fetchAndRegister: fetchAndRegister
  }
};

module.exports = Controller;
