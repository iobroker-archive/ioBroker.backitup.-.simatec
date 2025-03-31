'use strict';

const path = require('node:path');
const fs = require('node:fs');
const dropboxV2Api = require('dropbox-v2-api');
const Dropbox = require('../dropboxLib');

async function copyFiles(dbx, dropbox, dir, fileNames, log, errors, callback) {
    if (!fileNames || !fileNames.length) {
        callback && callback();
    } else {
        let fileName = fileNames.shift();
        fileName = fileName.replace(/\\/g, '/');
        const onlyFileName = fileName.split('/').pop();

        if (fs.existsSync(fileName)) {
            try {
                log.debug(`Dropbox: Copy ${onlyFileName}...`);
                const fileSize = fs.statSync(fileName).size;

                if (fileSize && (Math.round(fileSize / (1024 * 1024) * 10) / 10) <= 100) {
                    const readStream = fs.createReadStream(fileName);
                    readStream.on('error', err => {
                        err && log.error(`readStream Dropbox: ${err}`);
                    });
                    dbx({
                        resource: 'files/upload',
                        parameters: {
                            path: path.join(dir, onlyFileName).replace(/\\/g, '/')
                        },
                        readStream: readStream
                    }, (err, result, response) => {
                        if (err) {
                            errors.dropbox = JSON.stringify(err);
                        }
                        err && log.error(`upload Dropbox: ${JSON.stringify(err)}`);
                        setImmediate(copyFiles, dbx, dropbox, dir, fileNames, log, errors, callback);
                    });
                } else if (fileSize && (Math.round(fileSize / (1024 * 1024) * 10) / 10) > 100) {
                    await dropbox.sessionUpload(dbx, fileName, dir, log);

                    setImmediate(copyFiles, dbx, dropbox, dir, fileNames, log, errors, callback);
                }
            } catch (e) {
                errors.dropbox = e;
                log.error(`Dropbox: ${JSON.stringify(e)}`);
                setImmediate(copyFiles, dbx, dropbox, dir, fileNames, log, errors, callback)
            }
        } else {
            log.error(`Dropbox: File "${fileName}" not found`);
            setImmediate(copyFiles, dbx, dropbox, dir, fileNames, log, errors, callback)
        }
    }
}

function deleteFiles(dbx, files, log, errors, callback) {
    if (!files || !files.length) {
        callback && callback();
    } else {
        log.debug(`Dropbox: delete ${files[0]}`);
        try {
            dbx({
                resource: 'files/delete',
                parameters: {
                    path: files.shift()
                },
            }, (err, result) => {
                err && log.error(`Dropbox: ${JSON.stringify(err)}`);
                setImmediate(deleteFiles, dbx, files, log, errors, callback);
            });
        } catch (e) {
            log.error(`Dropbox: ${JSON.stringify(e)}`);
            callback && callback();
            setImmediate(deleteFiles, dbx, files, log, errors, callback);
        }
    }
}

function cleanFiles(dbx, options, dir, names, num, log, errors, callback) {
    if (!num) {
        return callback && callback();
    }
    try {
        dbx({
            resource: 'files/list_folder',
            parameters: {
                path: dir.replace(/^\/$/, '')
            },
        }, (err, result) => {

            err && log.error(`Dropbox: ${JSON.stringify(err)}`);

            if (result && result.entries) {
                const files = [];
                names.forEach(name => {
                    const subResult = result.entries.filter(a => a.name.startsWith(name));
                    let numDel = num;

                    if (name === 'influxDB' && options.influxDBMulti) numDel = num * options.influxDBEvents.length;
                    if (name === 'mysql' && options.mySqlMulti) numDel = num * options.mySqlEvents.length;
                    if (name === 'pgsql' && options.pgSqlMulti) numDel = num * options.pgSqlEvents.length;
                    if (name === 'homematic' && options.ccuMulti) numDel = num * options.ccuEvents.length;

                    if (subResult.length > numDel) {
                        // delete oldest files
                        subResult.sort((a, b) => {
                            const at = new Date(a.client_modified).getTime();
                            const bt = new Date(b.client_modified).getTime();
                            if (at > bt) return -1;
                            if (at < bt) return 1;
                            return 0;
                        });

                        for (let i = numDel; i < subResult.length; i++) {
                            files.push(subResult[i].path_display);
                        }
                    }

                });
                deleteFiles(dbx, files, log, errors, callback);
            } else {
                callback && callback();
            }
        });
    } catch (e) {
        callback && callback(e);
    }
}

async function command(options, log, callback) {
    const dropbox = new Dropbox();

    // Token refresh
    const db_accessToken = options.accessToken || '';

    if (db_accessToken && options.context.fileNames.length) {
        const fileNames = JSON.parse(JSON.stringify(options.context.fileNames));
        const dbx = dropboxV2Api.authenticate({ token: db_accessToken });

        let dir = (options.dir || '').replace(/\\/g, '/');

        if (!dir || dir[0] !== '/') {
            dir = `/${dir || ''}`;
        }

        copyFiles(dbx, dropbox, dir, fileNames, log, options.context.errors, err => {
            if (err) {
                options.context.errors.dropbox = err;
                log.error(`Dropbox: ${JSON.stringify(err)}`);
            }
            if (options.deleteOldBackup === true) {
                const dropboxDeleteAfter = options.advancedDelete === false ? options.deleteBackupAfter : options.dropboxDeleteAfter;

                cleanFiles(dbx, options, dir, options.context.types, dropboxDeleteAfter, log, options.context.errors, err => {
                    if (err) {
                        options.context.errors.dropbox = options.context.errors.dropbox || err;
                    } else {
                        !options.context.errors.dropbox && options.context.done.push('dropbox');
                    }
                    callback && callback(err);
                });
            } else {
                !options.context.errors.dropbox && options.context.done.push('dropbox');
                callback && callback(err);
            }
        });
    } else {
        callback && callback();
    }
}

module.exports = {
    command,
    ignoreErrors: true
};
