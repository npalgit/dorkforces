console.log('Loading function');

// dependencies
var AWS = require('aws-sdk');
var crypto = require('crypto');
var config = require('./config.json');

// Get reference to AWS clients
var dynamodb = new AWS.DynamoDB();

function getUser(email, fn) {
	dynamodb.getItem({
		TableName: config.DDB_TABLE,
		Key: {
			email: {
				S: email
			}
		}
	}, function(err, data) {
		if (err) return fn(err);
		else {
			if ('Item' in data) {
				var verified = data.Item.verified.BOOL;
				var verifyToken = null;
				if (!verified) {
					verifyToken = data.Item.verifyToken.S;
				}
				fn(null, verified, verifyToken);
			} else {
				fn(null, null); // User not found
			}
		}
	});
}

function createUserProfile(id, email, fn) {
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
	var email = event.email;
	var verifyToken = event.verify;

	getUser(email, function(err, verified, correctToken) {
		if (err) {
			context.fail('Error in getUser: ' + err);
		} else if (verified) {
			console.log('User already verified: ' + email);
			context.succeed({
				verified: true
			});
		} else if (verifyToken == correctToken) {
			// User verified
			updateUser(email, function(err, data) {
				if (err) {
					context.fail('Error in updateUser: ' + err);
				} else {
					console.log('User verified: ' + email);
					context.succeed({
						verified: true
					});
				}
			});
		} else {
			// Wrong token, not verified
			console.log('User not verified: ' + email);
			context.succeed({
				verified: false
			});
		}
	});
}
