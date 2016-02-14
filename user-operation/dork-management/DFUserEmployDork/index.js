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
        if (err) return fn(err, null);
        else {
            if ('Item' in data) {
                console.log("UserProfile found with employedDorks of " + JSON.stringify(data.Item));
                fn(null, data.Item);
            } else {
                fn(null, null); // User profile not found
            }
        }
    });
}

// Get DFDorks table item by matching 'dorkId'
function getDork(id, fn) {
    docClient.get({
        TableName: config.DDB_DORK_TABLE,
        Key: {
            dorkId: id
        }
    }, function(err, data) {
        if (err) return fn(err, null);
        else {
            if ('Item' in data) {
                fn(null, data.Item);
            } else {
                fn(null, null); // dork not found
            }
        }
    });
}

// Create a DFConversations table item for the employer and employee
function createExecConversation(userId, dorkId, fn) {
    // The 'id' key value is created by concatenating userId and dorkId
    var conversationId = 'ex:' + 'u:' + userId + ':d:' + dorkId;
    docClient.put({
        TableName: config.DDB_CONVERSATION_TABLE,
        Item: {
            conversationId: conversationId,
            msgCount: 0,
            users: [userId],
            dorks: [dorkId],
            history: [],
            type: 'Executive'      // direct line of communication between an employer and employee
        },
        ConditionExpression: 'attribute_not_exists (conversationId)'
    }, function(err, data) {
        if (err) {
            return fn(err, null);
        } else {
            return fn(null, conversationId);
        }
    });
}

// Update the DFUserProfile table item by appending to the 'conversations' and 'dorks' fields
function updateUserProfile(userId, dorkId, conversationId, fn) {
    docClient.update({
            TableName: config.DDB_PROFILE_TABLE,
            Key: {
                userId:userId
            },
            UpdateExpression: "SET employedDorks=list_append(employedDorks, :newDork), conversations=list_append(conversations, :newConv)",
            ExpressionAttributeValues: { 
                ":newDork": [dorkId],
                ":newConv": [conversationId]
            }
        }, fn);
}

// Create a DFEmployed table item for the employer and employee
function createEmployed(userId, dorkId, fn) {
    // The 'id' key value is created by concatenating userId and dorkId
    var employeeId = 'ex:' + 'u:' + userId + ':d:' + dorkId;  // same as the "Executive" conversationId
    var date = new Date();
    docClient.put({
        TableName: config.DDB_EMPLOYED_TABLE,
        Item: {
            employeeId: employeeId,
            userId: userId,
            dorkId: dorkId,
            hiredDate: date.toString()
        },
        ConditionExpression: 'attribute_not_exists (employeeId)'
    }, fn);
}

// Establish employment binding relationship between user and dork
function employDork(userId, dorkId, fn) {
    /*
     * We need to do a few things to establish employment relationship between a user and a dork:
     *
     *      1. Create a new DFConversations table item, and add the conversation id to the "conversations" field
     *         of the corresponding DFUserProfile table item
     *      2. Add dork's id to the "employedDorks" field in the corresponding DFUserProfile table item
     *      3. Add P0 conversation's id to the "conversations" field in the corresponding DFUserProfile table item
     *      4. Create a new DFEmployed table item - this event may trigger additional tasks 
     */
    createExecConversation(userId, dorkId, function(err, conversationId) {
        if (err) {
            return fn(err);
        } else {
            updateUserProfile(userId, dorkId, conversationId, function(err, data) {
                if (err) {
                    return fn(err);
                } else {
                    createEmployed(userId, dorkId, function(err, data) {
                        if (err) {
                            return fn(err);
                        } else {
                            fn(null);
                        }
                    });
                }
            });
        }
    });
}

exports.handler = function(event, context) {
    var userId = event.userId;
    var dorkId = event.dorkId;

    getUserProfile(userId, function(err, userProfile) {
        if (err) {
            context.fail('400: Bad Request - Error in getUserProfile: ' + err);
        } else if (!userProfile) {
            context.fail('404: Not Found - Cannot find the userProfile with id of ' + userId);
        //} else if (userProfile.employedDorks.contains(dorkId)) {
        } else if (userProfile.employedDorks.indexOf(dorkId) >= 0) {
            // Make sure this dork is not already employed
            context.fail('405: Method Not Allowed - Dork is already employed by this user.');
        } else {
            // Try to find the corresponding dork
            getDork(dorkId, function(err, dork) {
                if (err) {
                    context.fail('404: Not Found - Error in getDork: ' + err);
                } else if (!dork) {
                    context.fail('404: Not Found - Cannot find the dork with id of ' + dorkId);
                } else {
                    console.log('Dork found, ready to employ: ' + dork.name);
                    employDork(userId, dorkId, function(err) {
                        if (err) {
                            context.fail('405: Method Not Allowed - Error in employDork: ' + err);
                        } else {
                            context.succeed({
                                employed: true,
                                employeeId: 'ex:' + 'u:' + userId + ':d:' + dorkId
                            });
                        }
                    });
                }
            });
        }
    });
}
