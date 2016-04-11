'use strict';

const _ = require('lodash');
const DamnAppController = require('./damn-app-controller');

module.exports = class DamnCrudController extends DamnAppController {
    constructor() {
        super();
        this.add_filter(['show', 'update', 'destroy'], 'setDocument');
    }

    * index() {
        this.state = yield this.controller.model.find();
    }

    * create() {
        const document = new this.controller.model(this.request.body.fields);
        this.state = yield document.save()
            .catch(error => {
                error.status = 400;
                return error;
            });
    }

    * show() {
        this.state = this.request.document;
    }

    * update() {
        _.merge(this.request.document, this.request.body.fields);
        this.state = yield this.request.document.save()
            .catch(error => {
                error.status = 400;
                return error;
            });
    }

    * destroy() {
        this.state = yield this.request.document.remove();
    }

    * setDocument(next) {
        this.request.document = yield this.controller.model.findById(this.params.id);
        if (this.request.document) yield next;
    }
};
