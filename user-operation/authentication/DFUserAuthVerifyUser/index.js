console.log('Loading function');

// dependencies
var AWS = require('aws-sdk');
var crypto = require('crypto');
var config = require('./config.json');

// Get reference to AWS clients
//var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

// Javascript implementation of Java's String.hashCode() method:
// http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
String.prototype.hashCode = function(){
    var hash = 0;
    if (this.length == 0) return hash;
    for (i = 0; i < this.length; i++) {
        char = this.charCodeAt(i);
        hash = ((hash<<5)-hash)+char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

function getUser(email, fn) {
    docClient.get({
        TableName: config.DDB_TABLE,
        Key: {
            email: email
        }
    }, function(err, data) {
        if (err) {
            return fn(err);
        } else {
            if ('Item' in data) {
                var verified = data.Item.verified;
                var verifyToken = null;
                if (!verified) {
                    verifyToken = data.Item.verifyToken;
                }
                fn(null, verified, verifyToken);
            } else {
                fn(null, null); // User not found
            }
        }
    });
}

// Create a DFConversations table item for the employer and system employee
function createSysConversation(userId, dorkId, fn) {
    // The 'id' key value is created by concatenating userId and dorkId
    var conversationId = 'user:' + userId + ':dork:' + dorkId;
    docClient.put({
        TableName: config.DDB_CONVERSATION_TABLE,
        Item: {
            conversationId: conversationId,
            msgCount: 0,
            users: [userId],
            dorks: [dorkId],
            type: 'System'     // line of communication between an employer and employee
        }
    }, fn);
}

// Create a DFEmployed table item for the employer and system employee
function createSysEmployed(userId, dorkId, fn) {
    // The 'id' key value is created by concatenating userId and dorkId
    var employeeId = 'user:' + userId + ':dork:' + dorkId; // same as the "SYS" conversationId
    var date = new Date();
    docClient.put({
        TableName: config.DDB_EMPLOYED_TABLE,
        Item: {
            employeeId: employeeId,
            userId: userId,
            dorkId: dorkId,
            hiredDate: date.toString()
        }
    }, fn);
}

// Create a DFUserProfile table item for the verified user
function createUserProfile(id, email, fn) {
    var sysConversationId = 'user:' + id + ':dork:' + config.SYS_DORK;
    docClient.put({
        TableName: config.DDB_PROFILE_TABLE,
        Item: {
            userId: id,
            email: email,
            alias: id,
            employedDorks: [config.SYS_DORK],
            conversations: [sysConversationId]
        }
    }, function(err, data) {
            if (err) {
                return fn(err, null);
            } else {
                 createSysConversation(id, config.SYS_DORK, function(err, data) {
                    if (err) {
                        return fn(err, null);
                    } else {
                        createSysEmployed(id, config.SYS_DORK, fn);
                    }
                });
            }
    });
}

function updateUser(email, fn) {
    docClient.update({
            TableName: config.DDB_TABLE,
            Key: {
                email: email
            },
            AttributeUpdates: {
                verified: {
                    Action: 'PUT',
                    Value: true
                },
                verifyToken: {
                    Action: 'DELETE'
                }
            }
        }, function(err, data) {
                if (err) {
                    return fn(err, null);
                } else {
                    createUserProfile(email, email, fn);
                }
    });
}

exports.handler = function(event, context) {
    var email = event.email;
    var verifyToken = event.verify;

    getUser(email, function(err, verified, correctToken) {
        if (err) {
            context.fail('400: Bad Request - Error in getUser: ' + err);
        } else if (verified) {
            console.log('User already verified: ' + email);
            context.succeed({
                verified: true
            });
        } else if (verifyToken == correctToken) {
            // User verified
            updateUser(email, function(err, data) {
                if (err) {
                    context.fail('403: Forbidden - Error in updateUser: ' + err);
                } else {
                    console.log('User verified: ' + email);
                    context.succeed({
                        verified: true
                    });
                }
            });
        } else {
            // Wrong token, not verified
            context.fail('403: Forbidden - Verification token does not match: ' + verifyToken);
        }
    });
}
