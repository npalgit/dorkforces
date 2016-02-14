console.log('Loading function');

// dependencies
var AWS = require('aws-sdk');
var crypto = require('crypto');
var config = require('./config.json');

// Get reference to AWS clients
var docClient = new AWS.DynamoDB.DocumentClient();

// Get DFUserProfiles table item by matching 'userId'
function getUserProfile(id, fn) {
    docClient.get({
        TableName: config.DDB_PROFILE_TABLE,
        Key: {
            userId: id
        }
    }, function(err, data) {
        if (err) {
            return fn(err, null);
        } else {
            if ('Item' in data) {
                fn(null, data.Item);
            } else {
                fn(null, null); // User profile not found
            }
        }
    });
}

exports.handler = function(event, context) {
    var userId = event.userId;

    getUserProfile(userId, function(err, userProfile) {
        if (err) {
            context.fail('400: Bad Request - Error in getUserProfile: ' + err);
        } else if (!userProfile) {
            context.fail('404: Not Found - Cannot find the userProfile with id of ' + userId);
        } else {
            var keys = [];
            for (var i = 0; i < userProfile.employedDorks.length; i++) {
                keys[i] = {
                    dorkId: userProfile.employedDorks[i]
                }
            }
            var dorkTableName = config.DDB_DORK_TABLE;      // dynamodb.batchGet() uses table name as field name
            var params = {RequestItems: {}};
            params.RequestItems[dorkTableName] = {Keys: keys};      // unfortunately ES6 nto supported, so we have to go extra mile
            docClient.batchGet(params, function(err, data) {
                if (err) {
                    context.fail('404: Not Found - Error in batchGet DFDorks table: ' + err);
                } else {
                    context.succeed({
                        count: data.Responses.DFDorks.length,
                        employedDorkList: data.Responses[dorkTableName]
                    });
                }
            });
        }
    });
}
