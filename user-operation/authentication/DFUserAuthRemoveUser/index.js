console.log('Loading function');

// dependencies
var AWS = require('aws-sdk');
var crypto = require('crypto');
var config = require('./config.json');

// Get reference to AWS clients
//var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

// Get DFUserProfiles table item by matching 'userId'
function getUserProfile(id, fn) {
    docClient.get({
        TableName: config.DDB_PROFILE_TABLE,
        Key: {
            userId: id
        }
    }, function(err, data) {
        if (err) return fn(err, null);
        else {
            if ('Item' in data) {
                fn(null, data.Item);
            } else {
                fn(null, null); // User profile not found
            }
        }
    });
}

// Remove the DFConversations table item for the employer and employee
function removeConversation(id, fn) {
    docClient.delete({
        TableName: config.DDB_CONVERSATION_TABLE,
        Key: {
            conversationId: id
        },
        ConditionExpression: 'attribute_exists (conversationId)'
    }, fn);
}

// Remove a DFEmployed table item for the employer and employee
function removeEmployed(id, fn) {
    docClient.delete({
        TableName: config.DDB_EMPLOYED_TABLE,
        Key: {
            employeeId: id
        },
        ConditionExpression: 'attribute_exists (employeeId)'
    }, fn);
}

// Remove the specified DFUserProfiles table item
function removeUserProfile(id, fn) {
    docClient.delete({
        TableName: config.DDB_PROFILE_TABLE,
        Key: {
            userId: id
        },
        ConditionExpression: 'attribute_exists (userId)'
    }, fn);
}

// Remove the specified DFUsers table item
function removeUser(email, fn) {
    docClient.delete({
        TableName: config.DDB_TABLE,
        Key: {
            email: email
        },
        ConditionExpression: 'attribute_exists (email)'
    }, fn);
}

exports.handler = function(event, context) {
    var userId = event.userId;

    getUserProfile(userId, function(err, userProfile) {
        if (err) {
            context.fail('400: Bad Request - Error in getUserProfile: ' + err);
        } else if (!userProfile) {
            context.fail('404: Not Found - Cannot find the userProfile with id of ' + userId);
        } else {
            /*
             * Loop through the "employedDorks" set field and delete all related DFConversations and DFEmployed table items
             */
            for (var i = 0; i < userProfile.employedDorks.values.length; i++) {
                var conversationId = 'user:' + userId + ':dork:' + userProfile.employedDorks.values[i];
                var employeeId = conversationId;
                
                removeConversation(conversationId, function(err) {
                    if (err) {
                        context.fail('403: Forbidden - Error in removeConversation: ' + err);
                    }
                });
                removeEmployed(employeeId, function(err) {
                    if (err) {
                        context.fail('403: Forbidden - Error in removeEmployed: ' + err);
                    }
                });
            }
            
            // Delete corresponding DFUserProfiles and DFUsers table items
            removeUserProfile(userId, function(err) {
                if (err) {
                    context.fail('403: Forbidden - Error in removeUserProfile: ' + err);
                }
            });
            removeUser(userId, function(err) {
                if (err) {
                    context.fail('403: Forbidden - Error in removeUser: ' + err);
                } else {
                    context.succeed({
                        removed: true
                    });
                }
            });
        }
    });
}
