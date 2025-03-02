import React from 'react';
import PropTypes from 'prop-types';

import { Checkbox, FormControlLabel } from '@mui/material';

import { I18n } from '@iobroker/adapter-react-v5';

import BaseField from './BaseField';

class AdapterExist extends BaseField {
    renderItem() {
        return <>
            <FormControlLabel
                control={<Checkbox
                    checked={((this.props.schema.adapter === 'hm-rpc' || this.props.schema.adapter === 'javascript' || this.props.schema.adapter === 'backitup') && this.props.data.hostType === 'Slave') ? false : this.props.data[this.props.attr] ? this.props.data[this.props.attr] : false}
                    disabled={
                        ((this.props.schema.adapter === 'influxdb' || this.props.schema.adapter === 'sql') && this.props.data._nonSupportDockerDB) ||
                        ((this.props.schema.adapter === 'hm-rpc' || this.props.schema.adapter === 'javascript' || this.props.schema.adapter === 'backitup') && this.props.data.hostType === 'Slave')
                    }
                    onChange={async e => {
                        if (e.target.checked) {
                            if (this.props.schema.adapter) {
                                this.checkAdapterInstall(this.props.schema.adapter, this.props.schema.allHosts)
                                    .catch(err => console.error(err));
                            } else if (this.props.schema.alert) {
                                this.setState({ message: { text: I18n.t(this.props.schema.alert), title: I18n.t(this.props.schema.title) } });
                            }
                        }
                        this.props.onChange({ ...this.props.data, [this.props.attr]: e.target.checked });
                    }}
                />}
                sx={{
                    '& .MuiFormControlLabel-label': {
                        whiteSpace: 'nowrap',
                    }
                }}
                label={I18n.t(this.props.schema.label || this.props.schema.adapter)}
            />
            {this.renderMessage()}
        </>;
    }
}

AdapterExist.propTypes = {
    socket: PropTypes.object.isRequired,
    themeType: PropTypes.string,
    themeName: PropTypes.string,
    style: PropTypes.object,
    className: PropTypes.string,
    data: PropTypes.object.isRequired,
    attr: PropTypes.string,
    schema: PropTypes.object,
    onError: PropTypes.func,
    onChange: PropTypes.func,
};

export default AdapterExist;
