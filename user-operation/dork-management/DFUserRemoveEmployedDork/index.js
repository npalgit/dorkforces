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

// Update the DFUserProfile table item by removing the 'conversations' and 'dorks' elements
function updateUserProfile(userId, conversations, employedDorks, fn) {
    docClient.update({
            TableName: config.DDB_PROFILE_TABLE,
            Key: {
                userId: userId
            },
            UpdateExpression: "SET employedDorks=:dorks, conversations=:convs",
            ExpressionAttributeValues: { 
                ":dorks": employedDorks,
                ":convs": conversations
            }
        }, fn);
}

// Remove the DFConversations table item for the employer and employee
function removeExecConversation(id, fn) {
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

// Remove employment binding relationship between user and dork
function terminateDork(userProfile, dorkId, fn) {
    /*
     * We need to do a few things to terminate employment relationship between a user and a dork:
     *
     *      1. Remove dork's id from the "employedDorks" field in the corresponding DFUserProfile table item
     *      2. Remove Executive conversation's id from the "conversations" field in the corresponding DFUserProfile table item
     *      3. Remove the DFEmployed table item
     *      4. Remove the DFConversation table item
     * 
     * Note that messages will not be explicitly deleted. They will remain in the database and eventually expire.
     */
    var userId = userProfile.userId;
    var conversations = userProfile.conversations;
    var employedDorks = userProfile.employedDorks;
    var conversationId = 'ex:' + 'u:' + userId + ':d:' + dorkId;
    var employeeId = conversationId;    // same as the "Executive" conversationId
    var index = -1;
    
    // Dynamodb doesn't support removing a value from list, we have to construct the new value beforehand
    index = conversations.indexOf(conversationId);
    if (index >= 0) {
        conversations.splice(index, 1); 
    }
    index = employedDorks.indexOf(dorkId);
    if (index >= 0) {
        employedDorks.splice(index, 1); 
    }
    
    updateUserProfile(userId, conversations, employedDorks, function(err, data) {
        if (err) {
            return fn(err);
        } else {
            removeExecConversation(conversationId, function(err, data) {
                if (err) {
                    return fn(err);
                } else {
                    removeEmployed(employeeId, function(err, data) {
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
        } else if (userProfile.employedDorks.indexOf(dorkId) < 0) {
            // Make sure this dork is indeed employed
            context.fail('405: Method Not Allowed - Dork is not employed by this user.');
        } else {
            // Try to find the corresponding dork
            getDork(dorkId, function(err, dork) {
                if (err) {
                    context.fail('400: Bad Request - Error in getDork: ' + err);
                } else if (!dork) {
                    context.fail('404: Not Found - Cannot find the dork with id of ' + dorkId);
                } else if (dork.isSystem) {
                    context.fail('403: Forbidden - Cannot terminate a system dork!');
                } else {
                    console.log('Dork found, ready to fire: ' + dork.name);
                    terminateDork(userProfile, dorkId, function(err) {
                        if (err) {
                            context.fail('405: Method Not Allowed - Error in terminateDork: ' + err);
                        } else {
                            context.succeed({
                                terminated: true
                            });
                        }
                    });
                }
            });
        }
    });
}
