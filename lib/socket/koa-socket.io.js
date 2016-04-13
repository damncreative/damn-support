"use strict";

const _ = require('lodash');
const socketIO = require('socket.io');
const compose = require('koa-compose');

const log = require("debug")("damn:support:socket:koa-socket.io");

const defaultOpts = {
    namespace: null,
    hidden: false,
    ioOptions: {}
};

exports = module.exports = function (options) {
    if(_.isUndefined(options)) {
        options = {};
    }
    log("Setup new IO");
    return new exports.IO(options);
};

exports.IO = class IO {
    constructor(opts) {
        if (opts && !(typeof opts !== 'string' || opts && typeof opts !== 'object' )) {
            throw new Error('Incorrect argument passed to koaSocket constructor');
        }

        this.middleware = [];
        this.composed = null;
        this.listeners = new Map();
        this.connections = new Map();

        if (typeof opts === 'string') {
            opts = {
                namespace: opts
            };
        }

        this.opts = Object.assign(defaultOpts, opts);

        this.socket = null;

        this.onConnection = this.onConnection.bind(this);
        this.onDisconnect = this.onDisconnect.bind(this);
    }

    attach(app) {
        if (app._io) {
            // Without a namespace we’ll use the default, but .io already exists meaning
            // the default is taken already
            if (!this.opts.namespace) {
                throw new Error('Socket failed to initialise::Instance may already exist');
            }

            this.attachNamespace(app, this.opts.namespace);
            return;
        }

        // Add warning to conventional .listen
        // @TODO should this just be removed?
        app.__listen = app.listen;
        app.listen = function listen() {
            console.warn('IO is attached, did you mean app.server.listen()');
            return app.__listen.apply(app, arguments);
        };

        if (this.opts.hidden && !this.opts.namespace) {
            throw new Error('Default namespace can not be hidden');
        }

        app._io = new socketIO(app.server, this.opts.ioOptions);

        if (this.opts.namespace) {
            this.attachNamespace(app, this.opts.namespace);
            return;
        }

        // Attach default namespace
        app.io = this;

        // If there is no namespace then connect using the default
        this.socket = app._io;
        this.socket.on('connection', this.onConnection);
    }

    attachNamespace(app, id) {
        if (!app._io) {
            throw new Error('Namespaces can only be attached once a socketIO instance has been attached');
        }

        this.socket = app._io.of(id);
        this.socket.on('connection', this.onConnection);

        if (this.opts.hidden) {
            return;
        }

        if (app[id]) {
            throw new Error('Namespace ' + id + ' already attached to koa instance');
        }

        app[id] = this;
    }

    use(fn) {
        this.middleware.push(fn);
        this.composed = compose(this.middleware);

        this.updateConnections();

        return this;
    }

    on(event, handler) {
        let listeners = this.listeners.get(event);

        // If this is a new event then just set it
        if (!listeners) {
            this.listeners.set(event, [handler]);
            this.updateConnections();
            return this;
        }

        listeners.push(handler);
        this.listeners.set(event, listeners);
        this.updateConnections();
        return this;
    }

    off(event, handler) {
        if (!event) {
            this.listeners = new Map();
            this.updateConnections();
            return this;
        }

        if (!handler) {
            this.listeners.delete(event);
            this.updateConnections();
            return this;
        }

        let listeners = this.listeners.get(event);
        let i = listeners.length - 1;
        while (i) {
            if (listeners[i] === handler) {
                break
            }
            i--
        }
        listeners.splice(i, 1);

        this.updateConnections();
        return this;
    }

    broadcast(event, data) {
        this.connections.forEach((socket, id) => {
            socket.emit(event, data)
        });
    }

    onConnection(sock) {
        // let instance = new Socket( sock, this.listeners, this.middleware )
        let instance = new exports.Socket(sock, this.listeners, this.composed);
        this.connections.set(sock.id, instance);
        sock.on('disconnect', () => {
            this.onDisconnect(sock)
        });

        // Trigger the connection event if attached to the socket listener map
        let handlers = this.listeners.get('connection');
        if (handlers) {
            handlers.forEach(handler => {
                handler({
                    event: 'connection',
                    data: instance,
                    socket: instance.socket
                }, instance.id)
            });
        }
    }

    onDisconnect(sock) {
        this.connections.delete(sock.id)
    }

    updateConnections() {
        this.connections.forEach(connection => {
            connection.update(this.listeners, this.composed)
        })
    }
};

exports.Socket = class Socket {
    constructor(socket, listeners, middleware) {
        this.socket = socket;

        // The composed middleware function
        this.middleware = null;

        // Append listeners and composed middleware function
        this.update(listeners, middleware);
    }

    on( event, handler ) {
        this.socket.on( event, ( data, cb ) => {
            let packet = {
                event: event,
                data: data,
                socket: this,
                acknowledge: cb
            };

            if ( !this.middleware ) {
                handler( packet, data );
                return
            }

            this.middleware( packet )
                .then( () => {
                    handler( packet, data );
                });
        });
    }

    update( listeners, middleware ) {
        this.socket.removeAllListeners();
        this.middleware = middleware;

        listeners.forEach( ( handlers, event ) => {
            if ( event === 'connection' ) {
                return;
            }

            handlers.forEach( handler => {
                this.on( event, handler );
            });
        });
    }

    get id() {
        return this.socket.id;
    }

    emit( event, packet ) {
        this.socket.emit( event, packet );
    }

    disconnect() {
        this.socket.disconnect();
    }
};
