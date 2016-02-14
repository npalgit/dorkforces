console.log('Loading function');

// dependencies
var AWS = require('aws-sdk');
var crypto = require('crypto');
var config = require('./config.json');

// Get reference to AWS clients
var docClient = new AWS.DynamoDB.DocumentClient();

function computeHash(password, salt, fn) {
    // Bytesize
    var len = 128;
    var iterations = 4096;

    if (3 == arguments.length) {
        crypto.pbkdf2(password, salt, iterations, len, function(err, derivedKey) {
            if (err) return fn(err);
            else fn(null, salt, derivedKey.toString('base64'));
        });
    } else {
        fn = salt;
        crypto.randomBytes(len, function(err, salt) {
            if (err) return fn(err);
            salt = salt.toString('base64');
            computeHash(password, salt, fn);
        });
    }
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
            if (('Item' in data) && ('lostToken' in data.Item)) {
                var lostToken = data.Item.lostToken;
                fn(null, lostToken);
            } else {
                fn(null, null); // User or token not found
            }
        }
    });
}

function updateUser(email, password, salt, fn) {
    docClient.update({
        TableName: config.DDB_TABLE,
        Key: {
            email: email
        },
        AttributeUpdates: {
            passwordHash: {
                Action: 'PUT',
                Value: password
            },
            passwordSalt: {
                Action: 'PUT',
                Value: salt
            },
            lostToken: {
                Action: 'DELETE'
            }
        }
    }, fn);
}

exports.handler = function(event, context) {
    var email = event.email;
    var lostToken = event.lost;
    var newPassword = event.password;

    getUser(email, function(err, correctToken) {
        if (err) {
            context.fail('400: Bad Request - Error in getUser: ' + err);
        } else if (!correctToken) {
            context.fail('403: Forbidden - Password reset token does not match: ' + err);
        } else if (lostToken != correctToken) {
            // Wrong token, no password lost
            context.fail('403: Forbidden - Password reset token does not match: ' + err);
        } else {
            console.log('User logged in: ' + email);
            computeHash(newPassword, function(err, newSalt, newHash) {
                if (err) {
                    context.fail('422: Unprocessable Entity - Error in computeHash: ' + err);
                } else {
                    updateUser(email, newHash, newSalt, function(err, data) {
                        if (err) {
                            context.fail('403: Forbidden - Error in updateUser: ' + err);
                        } else {
                            console.log('User password changed: ' + email);
                            context.succeed({
                                changed: true
                            });
                        }
                    });
                }
            });
        }
    });
}
