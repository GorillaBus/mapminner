const Promise = require('bluebird');
const PNG = require('node-png').PNG;
const fs = require("fs");

let Reader = (Logger) => {

  /* Read all areas within a bitmap */
  let readBmp = (filename) => {
    return new Promise((resolve, reject) => {

      let pngFile = new PNG({
        filterType: 0
      });
      let fileReadStream = fs.createReadStream(filename)
        .pipe(pngFile);

      fileReadStream.on('parsed', (data) => {
        let sqSize = pngFile.width / 8;
        let parsedData = [];
        for (let c=0; c<8; c++) {
          for (let r=0; r<8; r++) {
            let col = c;
            let row = r;
            let dst = new PNG({width: sqSize, height: sqSize});
            pngFile.bitblt(dst, row*sqSize, col*sqSize, sqSize, sqSize, 0, 0);

            let data = parseData(dst.data);
            parsedData.push(data);
          }
        }
        resolve(parsedData);
      });

      // Error handler
      fileReadStream.on('error', (err) => {
        reject(err);
      });
    });
  };

  /* Register data parsed from a BMP slice */
  let parseData = (data) => {
    let total = data.length;
    let reg = {
      g: 0,
      o: 0,
      r: 0,
      n: 0
    };
    for (let p=0; p<total; p+=4) {
      let type = identify(data.slice(p, p+3));
      reg[type]++;
    }
    return reg;
  };

  /* Classifies a pixel as R, O or G */
  let identify = (pixelData) => {
    let simil = 25;
    if (pixelData[2] > 159 || (Math.abs(pixelData[0]-pixelData[1]) < simil && Math.abs(pixelData[1]-pixelData[2]) < simil)) {
      return 'n';
    }

    // Orange - Medium
    if (pixelData[0] > pixelData[1] && pixelData[0] + pixelData[1] >= 350 && pixelData[1] > pixelData[2]) {
      return 'o';

      // Red - High
    } else if (pixelData[0] > pixelData[1] &&  pixelData[0] > pixelData[2]) {
      return 'r'

      // Green - Low
    } else if (pixelData[1] > pixelData[0] && pixelData[1] > pixelData[2]) {
      return 'g';

      // None
    } else {

      return 'n';
    }
  };

  return {
    readBmp: readBmp
  }
};

module.exports = Reader;
