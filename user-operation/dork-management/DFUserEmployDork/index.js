console.log('Loading function');

// dependencies
var AWS = require('aws-sdk');
var crypto = require('crypto');
var config = require('./config.json');

// Get reference to AWS clients
var dynamodb = new AWS.DynamoDB();

// Array contains function
Array.prototype.contains = function(needle) {
   for (i in this) {
       if (this[i] === needle) return true;
   }
   return false;
}

// Get DFUserProfiles table item by matching 'userId'
function getUserProfile(id, fn) {
    dynamodb.getItem({
        TableName: config.DDB_PROFILE_TABLE,
        Key: {
            userId: {
                S: id
            }
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
    dynamodb.getItem({
        TableName: config.DDB_DORK_TABLE,
        Key: {
            dorkId: {
                S: id
            }
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
    var conversationId = 'user:' + userId + ':dork:' + dorkId;
    dynamodb.putItem({
        TableName: config.DDB_CONVERSATION_TABLE,
        Item: {
            conversationId: {
                S: conversationId
            },
            msgCount: {
                N: '0'
            },
            users: {
                SS: [userId]
            },
            dorks: {
                SS: [dorkId]
            },
            type: {
                S: 'Executive'      // direct line of communication between an employer and employee
            }
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
    dynamodb.updateItem({
            TableName: config.DDB_PROFILE_TABLE,
            Key: {
                userId: {
                    S: userId
                }
            },
            UpdateExpression: "ADD employedDorks :newDork, conversations :newConv",
            ExpressionAttributeValues: { 
                ":newDork": {SS: [dorkId]},
                ":newConv": {SS: [conversationId]}
            }
        }, fn);
}

// Create a DFEmployed table item for the employer and employee
function createEmployed(userId, dorkId, fn) {
    // The 'id' key value is created by concatenating userId and dorkId
    var employeeId = 'user:' + userId + ':dork:' + dorkId;  // same as the "P0" conversationId
    var date = new Date();
    dynamodb.putItem({
        TableName: config.DDB_EMPLOYED_TABLE,
        Item: {
            employeeId: {
                S: employeeId
            },
            userId: {
                S: userId
            },
            dorkId: {
                S: dorkId
            },
            hiredDate: {
                S: date.toString()
            }
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
        } else if (userProfile.employedDorks.SS.indexOf(dorkId) >= 0) {
            // Make sure this dork is not already employed
            context.fail('405: Method Not Allowed - Dork is already employed by this user: ' + err);
        } else {
            // Try to find the corresponding dork
            getDork(dorkId, function(err, dork) {
                if (err) {
                    context.fail('404: Not Found - Error in getDork: ' + err);
                } else if (!dork) {
                    context.fail('404: Not Found - Cannot find the dork with id of ' + dorkId);
                } else {
                    console.log('Dork found, ready to employ: ' + dork.name.S);
                    employDork(userId, dorkId, function(err) {
                        if (err) {
                            context.fail('405: Method Not Allowed - Error in employDork: ' + err);
                        } else {
                            context.succeed({
                                employed: true,
                                employeeId: 'user:' + userId + ':dork:' + dorkId
                            });
                        }
                    });
                }
            });
        }
    });
}
