console.log('Loading function');

// dependencies
var AWS = require('aws-sdk');
var crypto = require('crypto');
var config = require('./config.json');

// Get reference to AWS clients
var docClient = new AWS.DynamoDB.DocumentClient();

exports.handler = function(event, context) {
    docClient.scan({
        TableName: config.DDB_DORK_TABLE
    }, function(err, data) {
        if (err) {
            context.fail('404: Not Found - Error in scan DFDorks table: ' + err);
        } else {
            context.succeed({
                count: data.Count,
                dorkList: data.Items
            });
        }
    });
}
