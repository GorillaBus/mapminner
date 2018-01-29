let Router = (appSettings, Logger, services) => {

  let route = (args) => {
    let request;
    let params = [];

    if (!args.svc) {
      let err = "Invalid Service / Request";
      throw new Error(err);
    }

    if (!services.hasOwnProperty(args.svc)) {
      let err = "No such service "+ args.svc;
      throw new Error(err);
    }

    if (typeof services[args.svc][args.req]  !== 'function') {
      let err = "No such method "+ args.svc +"::"+ args.req;
      throw new Error(err);
    }

    if (args.params && args.params.length) {
      params = args.params.split(",");
      params.forEach((p, i) => {
        let paramLower = p.toLowerCase();
        if (paramLower === "true") {
          params[i] = true;
        } else if (paramLower === "false") {
          params[i] = false;
        }
      });
    }

    return services[args.svc][args.req].apply(null, params);
  };

  return {
    route: route
  }
};

module.exports = Router;
