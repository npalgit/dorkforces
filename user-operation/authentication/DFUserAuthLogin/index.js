console.log('Loading function');

// dependencies
var AWS = require('aws-sdk');
var crypto = require('crypto');
var config = require('./config.json');

// Get reference to AWS clients
//var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();
var cognitoidentity = new AWS.CognitoIdentity();

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
            if ('Item' in data) {
                var hash = data.Item.passwordHash;
                var salt = data.Item.passwordSalt;
                var verified = data.Item.verified;
                fn(null, hash, salt, verified);
            } else {
                fn(null, null); // User not found
            }
        }
    });
}

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

// Get temporary credential for the authenticated identity from AWS cognito
function getCredentials(id, token, fn) {
    var param = {
        IdentityId: id,
        Logins: {} // here we must pass in the token
    };
    param.Logins[config.COGNITO_PROVIDER_NAME] = token;
    console.log('Get ready to call getCredentialsForIdentity: \n ' + JSON.stringify(param));
    cognitoidentity.getCredentialsForIdentity(param,
        function(err, data) {
            if (err) {
                return fn(err); // an error occurred
            } else {
                fn(null, data.Credentials); // successful response
            }
        });
}

function getToken(email, fn) {
    var param = {
        IdentityPoolId: config.IDENTITY_POOL_ID,
        Logins: {} // To have provider name in a variable
    };
    param.Logins[config.DEVELOPER_PROVIDER_NAME] = email;
    console.log('Get ready to call getOpenIdTokenForDeveloperIdentity: \n ' + JSON.stringify(param));
    cognitoidentity.getOpenIdTokenForDeveloperIdentity(param,
        function(err, data) {
            if (err) {
                return fn(err); // an error occurred
            } else {
                console.log('getOpenIdTokenForDeveloperIdentity returned: \n ' + JSON.stringify(data));
                getCredentials(data.IdentityId, data.Token, function(err, credentials) {
                    if (err) {
                        return fn(err);
                    } else {
                        fn(null, data.IdentityId, data.Token, credentials); // successful response
                    }
                });
            }
        });
}

exports.handler = function(event, context) {
    var email = event.email;
    var clearPassword = event.password;

    getUser(email, function(err, correctHash, salt, verified) {
        if (err) {
            context.fail('400: Bad Request - Error in getUser: ' + err);
        } else {
            if (correctHash == null) {
                // User not found
                context.fail('404: Not Found - User not found: ' + email);
            } else if (!verified) {
                // User not verified
                context.fail('405: Method Not Allowed - Email address not yet verified: ' + email);
            } else {
                computeHash(clearPassword, salt, function(err, salt, hash) {
                    if (err) {
                        context.fail('400: Bad Request - Error in hash: ' + err);
                    } else {
                        if (hash == correctHash) {
                            // Login ok
                            console.log('User logged in: ' + email);
                            getToken(email, function(err, identityId, token, credentials) {
                                if (err) {
                                    context.fail('422: Unprocessable Entity - Error in getToken: ' + err);
                                } else {
                                    /*
                                     * We're all set, but let's try to return a little more data so that we
                                     * reduce number of REST calls, and save money. Following data shall be
                                     * returned:
                                     * 
                                     *      - User Profile
                                     */
                                    var userId = email;
                                    getUserProfile(userId, function(err, userProfile) {
                                        if (err) {
                                            context.fail('500: Internal Server Error - Cannot find User Profile: ' + err);
                                        } else {
                                            context.succeed({
                                                login: true,
                                                identityId: identityId,
                                                token: token,
                                                credentials: credentials,
                                                userProfile: userProfile
                                            });
                                        }
                                    });
                                }
                            });
                        } else {
                            // Login failed
                            context.fail('400: Bad Request - Password not valid, try again!');
                        }
                    }
                });
            }
        }
    });
}
