import { Alert } from '@mui/material';

import { Info, Warning } from '@mui/icons-material';

import { I18n, DialogMessage } from '@iobroker/adapter-react-v5';
import { ConfigGeneric, ConfigGenericProps, ConfigGenericState } from '@iobroker/json-config';
import { BackitupNative } from './Components/types';

export type BaseFieldState = ConfigGenericState & {
    message: false | { title: string; text: string; level?: string };
}

class BaseField<P extends ConfigGenericProps = ConfigGenericProps, S extends BaseFieldState = BaseFieldState>
extends ConfigGeneric<P, S> {
    constructor(props: P) {
        super(props);
        (this.state.message as boolean) = false;
    }

    isConfigFilled(type: string) {
        if (type === 'ccu') {
            return !!this.props.data.ccuHost && !!this.props.data.ccuEnabled;
        }
        if (type === 'mySql') {
            return !!this.props.data.mySqlUser && !!this.props.data.mySqlEnabled;
        }
        if (type === 'sqlite') {
            return !!this.props.data.sqlitePath && !!this.props.data.sqliteEnabled;
        }
        if (type === 'pgSql') {
            return !!this.props.data.pgSqlUser && !!this.props.data.pgSqlEnabled;
        }
        if (type === 'influxDB') {
            return !!this.props.data.influxDBName && !!this.props.data.influxDBEnabled;
        }
        if (type === 'history') {
            return !!this.props.data.historyPath && !!this.props.data.historyEnabled;
        }
        this.showMessage(I18n.t('BackItUp Warning!'), I18n.t('Unknown config type %s', type));
        return false;
    }

    fetchConfig = async (type: string, data: BackitupNative): Promise<{ changed: boolean; found: string | boolean; message?: string }> => {
        if (type === 'ccu') {
            return this.fetchCcuConfig(data);
        }
        if (type === 'mySql') {
            return this.fetchMySqlConfig(data);
        }
        if (type === 'sqlite') {
            return this.fetchSqliteConfig(data);
        }
        if (type === 'pgSql') {
            return this.fetchPgSqlConfig(data);
        }
        if (type === 'influxDB') {
            return this.fetchInfluxDBConfig(data);
        }
        if (type === 'history') {
            return this.fetchHistoryConfig(data);
        }

        this.showMessage(I18n.t('BackItUp Warning!'), I18n.t('Unknown config type %s', type));
        return { changed: false, found: false };
    };

    async fetchCcuConfig(data: BackitupNative) {
        const result:ioBroker.Object[] = Object.values(await this.props.oContext.socket.getObjectViewCustom('system', 'instance', 'system.adapter.hm-rpc.', 'system.adapter.hm-rpc.\u9999'));

        let found:(boolean | string) = false;
        let changed = false;
        if (result && result.length) {
            for (let i = 0; i < result.length; i++) {
                const common = result[i].common;
                const native = result[i].native;
                if (common.enabled && native) {
                    if (data.ccuHost !== native.homematicAddress || data.ccuUsehttps !== native.useHttps) {
                        data.ccuHost = native.homematicAddress;
                        data.ccuUsehttps = native.useHttps;
                        changed = true;
                    }
                    found = result[i]._id;
                    break;
                }
            }
            if (!found) {
                for (let i = 0; i < result.length; i++) {
                    const native = result[i].native;
                    if (native && (data.ccuHost !== native.homematicAddress || data.ccuUsehttps !== native.useHttps)) {
                        data.ccuHost = native.homematicAddress;
                        data.ccuUsehttps = native.useHttps;
                        changed = true;
                    }
                    found = result[i]._id;
                }
            }
        }

        return { changed, found };
    }

    async fetchMySqlConfig(data: BackitupNative) {
        const result:ioBroker.Object[] = Object.values(await this.props.oContext.socket.getObjectViewCustom('system', 'instance', 'system.adapter.sql.', 'system.adapter.sql.\u9999'));

        let found:(boolean | string) = false;
        let changed = false;
        if (result && result.length) {
            for (let i = 0; i < result.length; i++) {
                const common = result[i].common;
                const native = result[i].native;
                if (common.enabled && native?.dbtype === 'mysql') {
                    const port = native.port === '0' ? 3306 : (native.port || 3306);
                    if (data.mySqlUser !== native.user ||
                        data.mySqlPassword !== native.password ||
                        data.mySqlHost !== native.host ||
                        data.mySqlPort !== port ||
                        data.mySqlName !== native.dbname
                    ) {
                        data.mySqlUser = native.user;
                        data.mySqlPassword = native.password;
                        data.mySqlHost = native.host;
                        data.mySqlPort = port;
                        data.mySqlName = native.dbname;
                        changed = true;
                    }
                    found = result[i]._id;
                    break;
                }
            }
            if (!found) {
                for (let i = 0; i < result.length; i++) {
                    const native = result[i].native;
                    if (native?.dbtype === 'mysql') {
                        const port = native.port === '0' ? 3306 : (native.port || 3306);
                        if (data.mySqlUser !== native.user ||
                            data.mySqlPassword !== native.password ||
                            data.mySqlHost !== native.host ||
                            data.mySqlPort !== port ||
                            data.mySqlName !== native.dbname
                        ) {
                            data.mySqlUser = native.user;
                            data.mySqlPassword = native.password;
                            data.mySqlHost = native.host;
                            data.mySqlPort = port;
                            data.mySqlName = native.dbname;
                            changed = true;
                        }
                        found = result[i]._id;
                        break;
                    }
                }
            }
        }

        return { changed, found };
    }

    async fetchSqliteConfig(data: BackitupNative) {
        const result:ioBroker.Object[] = Object.values(await this.props.oContext.socket.getObjectViewCustom('system', 'instance', 'system.adapter.sql.', 'system.adapter.sql.\u9999'));
        let found:(boolean | string) = false;
        let changed = false;
        if (result && result.length) {
            for (let i = 0; i < result.length; i++) {
                const common = result[i].common;
                const native = result[i].native;
                if (common.enabled && native && native.dbtype === 'sqlite' && native.fileName) {
                    const pathLength = native.fileName.split('/');
                    const sqlitePath = pathLength > 1 ? native.fileName : `/opt/iobroker/iobroker-data/sqlite/${native.fileName}`;
                    if (data.sqlitePath !== sqlitePath) {
                        data.sqlitePath = sqlitePath;
                        changed = true;
                    }
                    found = result[i]._id;
                    break;
                }
            }
            if (!found) {
                for (let i = 0; i < result.length; i++) {
                    const native = result[i].native;
                    if (native?.dbtype === 'sqlite' && native.fileName) {
                        const pathLength = native.fileName.split('/');
                        const sqlitePath = pathLength > 1 ? native.fileName : `/opt/iobroker/iobroker-data/sqlite/${native.fileName}`;
                        if (data.sqlitePath !== sqlitePath) {
                            data.sqlitePath = sqlitePath;
                            changed = true;
                        }
                        found = result[i]._id;
                        break;
                    }
                }
            }
        }

        return { changed, found };
    }

    async fetchPgSqlConfig(data: BackitupNative) {
        const result:ioBroker.Object[] = Object.values(await this.props.oContext.socket.getObjectViewCustom('system', 'instance', 'system.adapter.sql.', 'system.adapter.sql.\u9999'));

        let found:(boolean | string) = false;
        let changed = false;
        if (result && result.length) {
            for (let i = 0; i < result.length; i++) {
                const common = result[i].common;
                const native = result[i].native;
                if (common.enabled && native?.dbtype === 'postgresql') {
                    const port = native.port === '0' ? 5432 : native.port || 5432;
                    if (data.pgSqlUser !== native.user ||
                        data.pgSqlPassword !== native.password ||
                        data.pgSqlHost !== native.host ||
                        data.pgSqlPort !== port ||
                        data.pgSqlName !== native.dbname
                    ) {
                        data.pgSqlUser = native.user;
                        data.pgSqlPassword = native.password;
                        data.pgSqlHost = native.host;
                        data.pgSqlPort = port;
                        data.pgSqlName = native.dbname;
                        changed = true;
                    }
                    found = result[i]._id;
                    break;
                }
            }
            if (!found) {
                for (let i = 0; i < result.length; i++) {
                    const native = result[i].native;
                    if (native?.dbtype === 'postgresql') {
                        const port = native.port === '0' ? 5432 : native.port || 5432;
                        if (data.pgSqlUser !== native.user ||
                            data.pgSqlPassword !== native.password ||
                            data.pgSqlHost !== native.host ||
                            data.pgSqlPort !== port ||
                            data.pgSqlName !== native.dbname
                        ) {
                            data.pgSqlUser = native.user;
                            data.pgSqlPassword = native.password;
                            data.pgSqlHost = native.host;
                            data.pgSqlPort = port;
                            data.pgSqlName = native.dbname;
                            changed = true;
                        }
                        found = result[i]._id;
                        break;
                    }
                }
            }
        }

        return { changed, found };
    }

    async fetchInfluxDBConfig(data: BackitupNative) {
        const result:ioBroker.Object[] = Object.values(await this.props.oContext.socket.getObjectViewCustom('system', 'instance', 'system.adapter.influxdb.', 'system.adapter.influxdb.\u9999'));
        let found:(boolean | string) = false;
        let changed = false;
        if (result && result.length) {
            for (let i = 0; i < result.length; i++) {
                const common = result[i].common;
                const native = result[i].native;
                if (common.enabled) {
                    if (data.influxDBHost !== native.host ||
                        data.influxDBVersion !== native.dbversion ||
                        data.influxDBProtocol !== native.protocol ||
                        data.influxDBName !== native.dbname ||
                        (native.dbversion === '2.x' && data.influxDBPort !== native.port)
                    ) {
                        data.influxDBHost = native.host;
                        data.influxDBVersion = native.dbversion;
                        data.influxDBProtocol = native.protocol;
                        data.influxDBName = native.dbname;
                        if (native.port && native.dbversion === '2.x') {
                            data.influxDBPort = native.port;
                        }
                        changed = true;
                    }

                    found = result[i]._id;
                    break;
                }
            }
            if (!found && result.length && result[0].native) {
                const native = result[0].native;
                if (native && (data.influxDBHost !== native.host ||
                    data.influxDBVersion !== native.dbversion ||
                    data.influxDBProtocol !== native.protocol ||
                    data.influxDBName !== native.dbname ||
                    (native.dbversion === '2.x' && data.influxDBPort !== native.port))
                ) {
                    data.influxDBHost = native.host;
                    data.influxDBVersion = native.dbversion;
                    data.influxDBProtocol = native.protocol;
                    data.influxDBName = native.dbname;
                    if (native.port && native.dbversion === '2.x') {
                        data.influxDBPort = native.port;
                    }
                    changed = true;
                }

                found = result[0]._id;
            }
        }

        return { changed, found };
    }

    async fetchHistoryConfig(data: BackitupNative) {
        const result:ioBroker.Object[] = Object.values(await this.props.oContext.socket.getObjectViewCustom('system', 'instance', 'system.adapter.history.', 'system.adapter.history.\u9999'));

        let storeDir = '';
        let found:(boolean | string) = false;
        let changed = false;
        if (result && result.length) {
            for (let i = 0; i < result.length; i++) {
                const common = result[i].common;
                const native = result[i].native;
                if (common.enabled && native) {
                    const historyPath = native.storeDir && !native.storeDir.startsWith('/opt/iobroker/backups') ? native.storeDir : '/opt/iobroker/iobroker-data/history';
                    if (data.historyPath !== historyPath) {
                        data.historyPath = historyPath;
                        changed = true;
                    }
                    storeDir = native.storeDir;
                    found = result[i]._id;
                    break;
                }
            }
            if (!found && result[0]) {
                const native = result[0].native;
                if (native) {
                    const historyPath = native.storeDir && !native.storeDir.startsWith('/opt/iobroker/backups') ? native.storeDir : '/opt/iobroker/iobroker-data/history';
                    if (data.historyPath !== historyPath) {
                        data.historyPath = historyPath;
                        changed = true;
                    }
                    storeDir = native.storeDir;
                    found = result[0]._id;
                }
            }
        }

        let message;
        if (found) {
            if (!storeDir) {
                message = I18n.t('No storage path of %s is configured.\nThe default path of the history adapter has been set.', found.substring('system.adapter.'.length));
            } else if (storeDir?.startsWith('/opt/iobroker/backups')) {
                message = I18n.t('The storage path of %s must not be identical to the path for backups.\nThe default path of the history adapter has been set.\n\nPlease change the path in the history adapter!', found.substring('system.adapter.'.length));
            }
        }

        return { changed, found, message };
    }

    checkAdapterInstall = async (name: string, ignoreHosts: boolean) => {
        const backItUpHost = this.props.common.host;
        const ignore = false;
        let adapterName = name;

        if (name === 'pgsql' || name === 'mysql' || name === 'sqlite') {
            adapterName = 'sql';
        }

        const SHOW_MESSAGE_FOR = [
            'zigbee',
            'esphome',
            'zigbee2mqtt',
            'node-red',
            'yahka',
            'jarvis',
            'history',
        ];

        if (!ignore) {
            const res:ioBroker.Object[] = Object.values(await this.props.oContext.socket.getObjectViewCustom('system', 'instance', `system.adapter.${adapterName}.`, `system.adapter.${adapterName}.\u9999`));
            if (res?.length) {
                let found:(boolean | string) = false;
                for (let i = 0; i < res.length; i++) {
                    const common = res[i].common;

                    if (common.host === backItUpHost || ignoreHosts) {
                        found = true;
                        break;
                    }
                }
                if (!found && SHOW_MESSAGE_FOR.includes(adapterName)) {
                    this.showMessage(I18n.t('BackItUp Warning!'), I18n.t('No %s Instance found on this host.\nPlease check your System', adapterName), 'warning');
                }
            } else if (SHOW_MESSAGE_FOR.includes(adapterName)) {
                this.showMessage(I18n.t('BackItUp Warning!'), I18n.t('No %s Instance found on this host.\nPlease check your System', adapterName), 'warning');
            }
        }
    };

    showMessage = (title: string, text: string, level?: string) => {
        this.setState({ message: { title, text, level: level || 'info' } });
    };

    renderMessage() {
        if (!this.state.message) {
            return null;
        }

        const lines = this.state.message.text.split('\n')
            .map(line => <div key={line} style={{ minHeight: 24 }}>{line}</div>);

        return this.state.message ? <DialogMessage
            title={this.state.message.title}
            text={lines}
            icon={this.state.message.level === 'info' ? <Info /> :
                (this.state.message.level === 'warning' ? <Warning style={{ color: 'orange' }} /> :
                    (this.state.message.level === 'error' ? <Alert style={{ color: 'red' }} /> : undefined))}
            onClose={() => this.setState({ message: false })}
        /> : null;
    }
}

export default BaseField;
