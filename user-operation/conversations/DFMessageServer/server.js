'use strict';

// Module dependencies.
var express = require('express');
var http    = require('http');
var path    = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');

module.exports.start = function() {
    var appRestServer = express();

    /*
    appRestServer.engine('html', require('ejs').renderFile);
    appRestServer.set('view engine', 'html');
    appRestServer.use(express.logger('dev'));
    */

    // cookieParser should be above session
    appRestServer.use(cookieParser());
    // bodyParser should be above methodOverride
    appRestServer.use(bodyParser.urlencoded({ extended: false }));
    appRestServer.use(bodyParser.json());
    appRestServer.use(methodOverride());

    /*
    * To allow CORS to happRestServeren and have our client side code separate from our server
    * and just make it load data, like with frameworks like Angular, Ember, Backbone
    * or the like, we can use the following middleware function in express before we
    * define our routes:
    */
    appRestServer.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        res.header("Access-Control-Allow-Methods", "OPTIONS, GET, POST, DELETE, PUT");
        res.header("Access-Control-Allow-Credentials", "true");
        next();
    });
    appRestServer.use(function(err, req, res, next) {
        console.error(err.stack);
        res.status(500).send('Something broke!');
    });

    //Bootstrap routes
    require('./routes')(appRestServer);

    // Start server
    var port = process.env.PORT || 1526;
    appRestServer.listen(port, '0.0.0.0').on('error', function(err) {
        console.log('Cannot listen on port ' + port + ', error: ' + err);
    });
    console.log('Express server listening on port %d', port);
}
