'use strict';

module.exports = {
    DamnAppController: require('./controllers/damn-app-controller'),
    DamnCrudController: require('./controllers/damn-crud-controller'),

    Log: {
        bunyan: require('./log/bunyan')
    },

    Socket: {
        koaSocket: require('./socket/koa-socket.io')
    }
};
