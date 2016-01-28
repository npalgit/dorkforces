console.log('Loading function');

// dependencies
var AWS = require('aws-sdk');
var crypto = require('crypto');
var config = require('./config.json');

// Get reference to AWS clients
var dynamodb = new AWS.DynamoDB();

function getUserProfile(id, fn) {
	dynamodb.getItem({
		TableName: config.DDB_PROFILE_TABLE,
		Key: {
			userId: {
				S: id
			}
		}
	}, function(err, data) {
		if (err) return fn(err);
		else {
			if ('Item' in data) {
				fn(null, data.Item);
			} else {
				fn(null, null); // User profile not found
			}
		}
	});
}

function createEmployed(id, email, fn) {
    dynamodb.putItem({
        TableName: config.DDB_PROFILE_TABLE,
        Item: {
            userId: {
                S: id
            },
            email: {
                S: email
            },
            alias: {
                S: id
            },
            employedDorks: {
                L: []
            },
            conversations: {
                L: []
            }
        },
        ConditionExpression: 'attribute_not_exists (userId)'
    }, fn);
}

function updateUser(email, fn) {
	crypto.randomBytes(4, function(err, id) {
		if (err) return fn(err);
		id = "user:" + id.toString('hex') + ":" + Date.now().toString();    // user id format: "user:xxxxxxxx:XXXXXXXX"
        dynamodb.updateItem({
                TableName: config.DDB_TABLE,
                Key: {
                    email: {
                        S: email
                    }
                },
                AttributeUpdates: {
                    verified: {
                        Action: 'PUT',
                        Value: {
                            BOOL: true
                        }
                    },
                    userId: {
                        Action: 'PUT',
                        Value: {
                            S: id
                        }
                    },
                    verifyToken: {
                        Action: 'DELETE'
                    }
                }
		  }, function(err, data) {
			     if (err) return fn(err);
			     else createUserProfile(id, email, fn);
        });
	});
}

exports.handler = function(event, context) {
	var userId = event.userId;
	var dorkId = event.dorkId;

	getUserProfile(userId, function(err, userProfile) {
		if (err) {
			context.fail('Error in getUserProfile: ' + err);
		} else if (!userProfile) {
            context.fail('Cannot find the userProfile with id of ' + userId);
		} else if (userProfile.employedDorks.indexOf(dorkId) >= 0) {
            // Make sure this dork is not already employed
            context.fail('Dork is already employed by this user: ' + err);
		} else {
			// Try to find the corresponding dork
			getDork(dorkId, function(err, dork) {
				if (err) {
					context.fail('Error in getDork: ' + err);
				} else {
					console.log('Dork found, ready to employ: ' + dork.name);
                    employDork(userProfile, dork, function(err) {
                        if (err) {
                            context.fail('Error in userEmployDork: ' + err);
                        } else {
                            context.succeed(dork.name + ' is now employed by ' + userProfile.alias);
                        }
                    });
				}
			});
		}
	});
}
