'use strict';

const axios = require('axios');
const fs = require('fs');
const got = require('@esm2cjs/got').default;
const path = require('path');

const OAUTH_URL = 'https://onedriveauth.simateccloud.de/v2.0';
const redirect_uri = 'https://onedriveauth.simateccloud.de/v2.0/nativeclient';
const url = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

// Old Auth-URL's
//const url = 'https://login.live.com/oauth20_token.srf';
//const redirect_uri = 'https://login.microsoftonline.com/common/oauth2/nativeclient';
//const auth_url = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
//const auth_url = 'https://login.live.com/oauth20_authorize.srf';

class onedrive {
    getAuthorizeUrl(log) {
        return new Promise(async (resolve, reject) => {
            try {
                const urlRequest = await axios({
                    method: 'get',
                    url: OAUTH_URL,
                    headers: {
                        'User-Agent': 'axios/1.6.2'
                    },
                    responseType: 'json'
                });

                if (urlRequest && urlRequest.data) {
                    const url = `${urlRequest.data.authURL}&client_id=${urlRequest.data.client_id}`;
                    resolve(url);
                } else {
                    reject();
                }
            } catch (e) {
                log.warn(`getAuthorizeUrl Onedrive: ${e}`);
                reject();
            }
        });
    }

    getClientID(log) {
        return new Promise(async (resolve, reject) => {
            try {
                const urlRequest = await axios({
                    method: 'get',
                    url: OAUTH_URL,
                    headers: {
                        'User-Agent': 'axios/1.6.2'
                    },
                    responseType: 'json'
                });

                if (urlRequest && urlRequest.data && urlRequest.data.client_id) {
                    resolve(urlRequest.data.client_id)
                } else {
                    reject();
                }
            } catch (e) {
                log.warn(`getClientID Onedrive: ${e}`);
                reject();
            }
        });
    }

    getRefreshToken(code, log) {
        return new Promise(async (resolve, reject) => {
            try {
                const data = `redirect_uri=${redirect_uri}&code=${code}&grant_type=authorization_code&client_id=${await this.getClientID(log)}`;

                const refreshToken = await axios(url, {
                    method: 'post',
                    data: data
                });

                if (refreshToken && refreshToken.data && refreshToken.data.refresh_token) {
                    resolve(refreshToken.data.refresh_token);
                } else {
                    reject();
                }
            } catch (e) {
                log.warn(`getRefreshToken Onedrive: ${e}`);
                reject();
            }
        });
    }

    getToken(refreshToken, log) {
        return new Promise(async (resolve, reject) => {
            try {
                const data = `refresh_token=${refreshToken}&grant_type=refresh_token&client_id=${await this.getClientID(log)}`;

                const accessToken = await axios(url, {
                    method: 'post',
                    data: data
                });

                if (accessToken && accessToken.data && accessToken.data.access_token) {
                    resolve(accessToken.data.access_token);
                } else {
                    reject();
                }
            } catch (e) {
                log.warn(`getToken Onedrive: ${e}`);
                reject();
            }
        });
    }

    renewToken(refreshToken, log) {
        return new Promise(async (resolve, reject) => {
            try {
                const data = `refresh_token=${refreshToken}&grant_type=refresh_token&client_id=${await this.getClientID(log)}`;

                const accessToken = await axios(url, {
                    method: 'post',
                    data: data
                });

                if (accessToken && accessToken.data && accessToken.data.refresh_token) {
                    resolve(accessToken.data.refresh_token);
                } else {
                    reject();
                }
            } catch (e) {
                log.warn(`refresh_token Onedrive: ${e}`);
                reject();
            }
        });
    }

    async fileUpload({ accessToken, parentPath, filePath, log, onProgress = () => { } }) {
        const fileSize = fs.statSync(filePath).size;
        const fileName = path.basename(filePath);

        const sessionUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${parentPath ? `${parentPath}/` : ''}${fileName}:/createUploadSession`;

        log.debug(`Starting upload session for file: ${fileName}`);

        const sessionRes = await got.post(sessionUrl, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            json: {
                item: {
                    '@microsoft.graph.conflictBehavior': 'replace',
                    name: fileName
                }
            },
            responseType: 'json'
        });

        const uploadUrl = sessionRes.body.uploadUrl;
        if (!uploadUrl) throw new Error('Upload URL could not be created');

        log.debug(`Upload URL obtained: ${uploadUrl}`);

        const chunkSize = 4 * 1024 * 1024; // 4MB
        const fileStream = fs.createReadStream(filePath, { highWaterMark: chunkSize });

        let position = 0;
        let chunkIndex = 0;

        for await (const chunk of fileStream) {
            const start = position;
            const end = position + chunk.length - 1;
            const contentRange = `bytes ${start}-${end}/${fileSize}`;

            log.debug(`Uploading chunk ${chunkIndex + 1}: bytes ${start}-${end}`);

            const res = await got.put(uploadUrl, {
                headers: {
                    'Content-Length': chunk.length,
                    'Content-Range': contentRange
                },
                body: chunk,
                responseType: 'json',
                throwHttpErrors: false
            });

            if (res.statusCode >= 200 && res.statusCode < 300 && res.body?.id) {
                onProgress(fileSize); // 100%
                log.debug(`Upload completed: ${res.body.name}`);
                return res.body;
            }

            if (res.statusCode === 202 || (res.statusCode >= 200 && res.statusCode < 300)) {
                chunkIndex++;
                onProgress(end + 1);
                const percent = Math.round(((end + 1) / fileSize) * 100);
                log.debug(`🔁 Chunk ${chunkIndex} uploaded: ${percent}%`);
            } else {
                log.error(`Error during chunk upload [${res.statusCode}]: ${JSON.stringify(res.body)}`);
                throw new Error(`Chunk upload failed with status ${res.statusCode}`);
            }

            position += chunk.length;
        }

        throw new Error('Upload did not complete properly');
    }

    async getMetadata({ accessToken, itemPath }) {
        const targetPath = itemPath === 'root' ? 'root' : `root:/${itemPath}`;
        const url = `https://graph.microsoft.com/v1.0/me/drive/${targetPath}`;

        const response = await got.get(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
            responseType: 'json'
        });

        return response.body;
    }

    async listChildren({ accessToken, itemId }) {
        const url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/children`;

        const response = await got.get(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
            responseType: 'json'
        });

        return response.body;
    }

    async downloadFile({ accessToken, dir, onlyFileName, downloadPath, log }) {
        try {
            const meta = await this.getMetadata({ accessToken, itemPath: dir });

            if (!meta || !meta.id) {
                throw new Error(`Directory not found: ${dir}`);
            }

            const children = await this.listChildren({ accessToken, itemId: meta.id });
            const matched = children.value.find(item => item.name === onlyFileName);

            if (!matched || !matched['@microsoft.graph.downloadUrl']) {
                throw new Error(`File \"${onlyFileName}\" not found in OneDrive`);
            }

            const downloadUrl = matched['@microsoft.graph.downloadUrl'];
            const localPath = path.join(downloadPath, onlyFileName);

            const fileWriteStream = fs.createWriteStream(localPath);
            const downloadStream = got.stream(downloadUrl);

            return new Promise((resolve, reject) => {
                downloadStream.pipe(fileWriteStream);

                downloadStream.on('error', err => {
                    log.error(`Download stream error: ${err.message}`);
                    reject(err);
                });
                fileWriteStream.on('error', err => {
                    log.error(`File write error: ${err.message}`);
                    reject(err);
                });
                fileWriteStream.on('finish', () => {
                    log.debug(`✅ File downloaded: ${localPath}`);
                    resolve(localPath);
                });
            });

        } catch (err) {
            log.error(`Download failed: ${err.message}`);
            throw err;
        }
    }

    async getChildItems({ accessToken, dir }) {
        try {
            const metadata = await this.getMetadata({
                accessToken,
                itemPath: dir !== 'root' ? dir : 'root'
            });

            if (!metadata?.id) {
                throw new Error('No metadata ID returned');
            }

            const children = await this.listChildren({
                accessToken,
                itemId: metadata.id
            });

            return children?.value || [];
        } catch (err) {
            throw new Error(`getChildItems error: ${err.message}`);
        }
    }

    async deleteItem({ accessToken, itemId }) {
        const url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;

        const response = await got.delete(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            },
            responseType: 'json',
            throwHttpErrors: false
        });

        return response;
    }
}

module.exports = onedrive;