'use strict';
const fs = require('node:fs');
const getDate = require('../tools').getDate;
const path = require('node:path');

function command(options, log, callback) {
    let yahkaInst = [];

    const compress = require('../targz').compress;

    for (let i = 0; i <= 100; i++) {
        let pth = path.join(options.path, `yahka.${i}.hapdata`);

        if (fs.existsSync(pth)) {
            let nameSuffix;
            if (options.hostType === 'Slave') {
                nameSuffix = options.slaveSuffix ? options.slaveSuffix : '';
            } else {
                nameSuffix = options.nameSuffix ? options.nameSuffix : '';
            }

            const fileName = path.join(options.backupDir, `yahka.${i}_${getDate()}${nameSuffix ? `_${nameSuffix}` : ''}_backupiobroker.tar.gz`);

            options.context.fileNames.push(fileName);

            compress({
                src: pth,
                dest: fileName,
            }, (err, stderr) => {
                if (err) {
                    options.context.errors.yahka = err.toString();
                    stderr && log.error(stderr);
                    if (callback) {
                        callback(err, stderr);
                        callback = null;
                    }
                } else {
                    options.context.types.push(`yahka.${i}`);
                    options.context.done.push(`yahka.${i}`);
                }
            });
            yahkaInst.push(`yahka.${i}`);
            if (i === 20) {
                yahkaInst.length ? log.debug(`found yahka database: ${yahkaInst}`) : log.warn('no yahka database found!!');
            }
        } else if (!fs.existsSync(pth) && i === 20) {
            yahkaInst.length ? log.debug(`found yahka database: ${yahkaInst}`) : log.warn('no yahka database found!!');
            callback && callback(null, 'done');
            break;
        }
    }
}

module.exports = {
    command,
    ignoreErrors: true
};
