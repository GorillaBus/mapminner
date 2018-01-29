let StaticServer = require("static-server");

let Server = (appSettings, Logger) => {
  let server;
  let running = false;

  let start = () => {
    server = new StaticServer({
      rootPath: 'public_html/',
      name: 'map-miner-http-server',
      port: 8000,
      host: '',
      cors: '*',
      followSymlink: true,
      templates: {
        index: 'display-zone.html',      // optional, defaults to 'index.html'
        notFound: ''
      }
    });

    server.start(() => {
      Logger.info('Http server listening on port: '+ server.port);
    });

    server.on('request', (req, res) => {
      Logger.info("Http request "+ req.path);
    });

    server.on('response', (req, res, err, file, stat) => {
      if (err) { Logger.error(err); }
    });
  };

  let stop = () => {
    if (running){
      server.stop();
    }
  };

  return {
    start: start,
    stop: stop
  }
};

module.exports = Server;
