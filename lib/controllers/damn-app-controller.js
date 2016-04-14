'use strict';

const koaCompose = require('koa-compose');
const _ = require('lodash');

module.exports = class DamnAppController {
    constructor() {
        this._action_filters = {};
        this._respond = true;

        if (_.isFunction(this.init)) {
            this.init();
        }
    }

    get controllerMiddleware() {
        const controllerInstance = this;
        return function *(next) {
            this.controller = controllerInstance;
            yield next;
        }
    }

    get action_filters() {
        return this._action_filters;
    }

    add_filter(actions, methods) {
        actions = _.isArray(actions) ? actions : [actions];
        methods = _.isArray(methods) ? methods : [methods];

        actions.forEach( action => {
            if (_.isArray(this.action_filters[action]) === false) {
                this.action_filters[action] = [];
            }

            methods.forEach(method => {
                if(_.isString(method) === false) {
                    this.action_filters[action].push(method);
                } else {
                    this.action_filters[action].push(this[method]);
                }
            });
        });
    }

    get automaticResponseOfState() {
        return function *(next) {
            yield next;
            // TODO: For Long Polls look here!?
            if (this.controller._respond) {
                if(!this.state) {
                    this.throw(404);
                }
                this.body = this.state;
            }
        };
    }

    runAction(action) { //console.log('Filters for %s.%s: %j', this.constructor.name, action, this.filters[action]);
        return koaCompose([
            this.controllerMiddleware,
            this.automaticResponseOfState,
            koaCompose(this.action_filters[action] || []),
            this[action]
        ]);
    }
};
