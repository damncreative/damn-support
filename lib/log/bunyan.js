'use strict';

const _ = require('lodash');
const bunyan = require('bunyan');
const PrettyStream = require('bunyan-prettystream');

const defaultBunyanOpts = {
    name: 'middleware',
    level: 'debug'
};

module.exports = function (opts) {
    if (_.isUndefined(opts)) {
        opts = {};
    }
    //Pretty print bunyan console output
    const stream = new PrettyStream();
    stream.pipe(process.stdout);
    defaultBunyanOpts.stream = stream;

    return bunyan.createLogger(_.merge(defaultBunyanOpts, opts));
};
