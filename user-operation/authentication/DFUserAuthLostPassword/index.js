console.log('Loading function');

// dependencies
var AWS = require('aws-sdk');
var crypto = require('crypto');
var config = require('./config.json');

// Get reference to AWS clients
var docClient = new AWS.DynamoDB.DocumentClient();
var ses = new AWS.SES();

function getUser(email, fn) {
    docClient.get({
        TableName: config.DDB_TABLE,
        Key: {
            email: email
        }
    }, function(err, data) {
        if (err) return fn(err);
        else {
            if ('Item' in data) {
                fn(null, email);
            } else {
                fn(null, null); // User not found
            }
        }
    });
}

function storeLostToken(email, fn) {
    // Bytesize
    var len = 128;
    crypto.randomBytes(len, function(err, token) {
        if (err) {
            return fn(err);
        } else {
            token = token.toString('hex');
            docClient.update({
                TableName: config.DDB_TABLE,
                Key: {
                    email: email
                },
                AttributeUpdates: {
                    lostToken: {
                        Action: 'PUT',
                        Value: token
                    }
                }
            }, function(err, data) {
                if (err) {
                    return fn(err);
                } else {
                    fn(null, token);
                }
            });
        }
    });
}

function sendLostPasswordEmail(email, token, fn) {
    var subject = 'Password Lost for ' + config.EXTERNAL_NAME;
    var lostLink = config.RESET_PAGE + '?email=' + email + '&lost=' + token;
    ses.sendEmail({
        Source: config.EMAIL_SOURCE,
        Destination: {
            ToAddresses: [
                email
            ]
        },
        Message: {
            Subject: {
                Data: subject
            },
            Body: {
                Html: {
                    Data: '<html><head>'
                    + '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />'
                    + '<title>' + subject + '</title>'
                    + '</head><body>'
                    + 'Please <a href="' + lostLink + '">click here to reset your password</a> or copy & paste the following link in a browser:'
                    + '<br><br>'
                    + '<a href="' + lostLink + '">' + lostLink + '</a>'
                    + '</body></html>'
                }
            }
        }
    }, fn);
}

exports.handler = function(event, context) {
    var email = event.email;

    getUser(email, function(err, emailFound) {
        if (err) {
            context.fail('400: Bad Request - Error in getUserFromEmail: ' + err);
        } else if (!emailFound) {
            context.fail('405: Method Not Allowed - Cannot send email: ' + err);
        } else {
            storeLostToken(email, function(err, token) {
                if (err) {
                    context.fail('403: Forbidden - Error in storeLostToken: ' + err);
                } else {
                    sendLostPasswordEmail(email, token, function(err, data) {
                        if (err) {
                            context.fail('405: Method Not Allowed - Error in sendLostPasswordEmail: ' + err);
                        } else {
                            console.log('User found: ' + email);
                            context.succeed({
                                sent: true
                            });
                        }
                    });
                }
            });
        }
    });
}
