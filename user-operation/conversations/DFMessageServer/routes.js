'use strict';

var path = require('path');
var config = require('./config.json');
var conversationMgr = require('./conversation-mgr');
var AWS = conversationMgr.AWS;
var docClient = conversationMgr.docClient;
var sqs = new AWS.SQS();
var cognitoidentity = new AWS.CognitoIdentity();
var u2hQueueUrl = 'https://sqs.' + config.REGION + '.amazonaws.com/' + config.AWS_ACCOUNT_ID + '/' + config.SQS_MESSAGE_U2H;
var u2dQueueUrl = 'https://sqs.' + config.REGION + '.amazonaws.com/' + config.AWS_ACCOUNT_ID + '/' + config.SQS_MESSAGE_U2D;

// Return the DFConversations table entry
function getConversation(req, res, next) {
    var conversationId = req.params.conversationId;
    
    docClient.get({
        TableName: config.DDB_CONVERSATION_TABLE,
        Key: {
            conversationId: conversationId
        }
    }, function(err, data) {
        if (err) {
            res.send(404, 'Conversation not found with error: ' + err);
        } else {
            res.json(data);
        }
    });
}

// Return messages in the specified conversation
function getMessages(req, res, next) {
    var conversationId = req.params.conversationId;
    var today = new Date();
    var year = today.getUTCFullYear().toString();                   // e.g. "2016""
    var month = ("0" + (today.getUTCMonth() + 1)).slice(-2);        // e.g. "01", "02", ... "12"
    var msgPeriod = req.query.hasOwnProperty('msgPeriod')? req.query.msgPeriod : year + '-' + month;
    var msgTableName = config.DDB_MESSAGE_TABLE + '-' + conversationId.substring(0,2) + '-' + msgPeriod;
    var msgIndexBegin = req.query.hasOwnProperty('msgIndexBegin')? parseInt(req.query.msgIndexBegin) : -1;
    var msgIndexEnd = req.query.hasOwnProperty('msgIndexEnd')? parseInt(req.query.msgIndexEnd) : -1;
    
    console.log("Getting messages, conversationId=" + conversationId + " msgTableName=" + msgTableName + " msgIndexBegin=" + msgIndexBegin + " msgIndexEnd=" + msgIndexEnd);
    
    if (msgIndexBegin < 0) {
        docClient.query({
            TableName: msgTableName,
            KeyConditionExpression: 'conversationId = :id',
            ExpressionAttributeValues: {
                ':id': conversationId
            }
        }, function(err, data) {
            if (err) {
                res.send(404, 'Messages not found: ' + err);
            } else {
                res.json(data);
            }
        });
    } else if (msgIndexEnd < 0) {
        docClient.query({
            TableName: msgTableName,
            KeyConditionExpression: '(conversationId = :id) AND (msgIndex >= :index1)',
            ExpressionAttributeValues: {
                ':id': conversationId,
                ':index1': msgIndexBegin
            }
        }, function(err, data) {
            if (err) {
                res.send(404, 'Messages not found: ' + err);
            } else {
                res.json(data);
            }
        });
    } else {
        docClient.query({
            TableName: msgTableName,
            KeyConditionExpression: '(conversationId = :id) AND (msgIndex BETWEEN :index1 AND :index2)',
            ExpressionAttributeValues: {
                ':id': conversationId,
                ':index1': msgIndexBegin,
                ':index2': msgIndexEnd
            }
        }, function(err, data) {
            if (err) {
                res.send(404, 'Messages not found: ' + err);
            } else {
                res.json(data);
            }
        });
    }
}

// Post messages in the specified conversation
function postMessage(req, res, next) {
    var conversationId = req.params.conversationId;
    var userId = req.body.userId;
    var message = req.body.message;
    var precedence = req.body.precedence;
    var queueUrl = req.body.demandingHuman? u2hQueueUrl : u2dQueueUrl;
    
    // Make sure user is who he says he is
    /*
    var params = {
        IdentityPoolId: req.body.identity.cognitoIdentityPoolId,
        IdentityId: req.body.identity.cognitoIdentityId,
        MaxResults: 10,
        NextToken: null
    };
    cognitoidentity.lookupDeveloperIdentity(params, function(err, data) {
        if (err) {
            console.log("Error in cognitoidentity.lookupDeveloperIdentity: " + err);
        } else {
            console.log("lookupDeveloperIdentity returns: " + JSON.stringify(data));
            // Verify the specified userId included in the DeveloperUserIdentifierList
            if (data.DeveloperUserIdentifierList.indexOf(userId) < 0) {
                res.send(401, 'Unauthorized - userId not a valid cognito identity');
                next();
            }
        }
    });
    */
    
    /*
     * This is the first stop of the message-routing path. Here we don't actually process the message, but
     * instead we do a few things:
     * 
     *      (1) Increase the 'msgCount' in the corresponding DFConversation table entry.
     *      (2) Determine which DFMessages table to log the message to. There're a few rules:
     *              - Messages are grouped in a single table on monthly basis
     *              - Each conversation type has its own message table
     *      (3) Push message to corresponding DFMessages table, where other functions will pick up
     *          for further processing.
     */
    var today = new Date();
    var year = today.getUTCFullYear().toString();                   // e.g. "2016""
    var month = ("0" + (today.getUTCMonth() + 1)).slice(-2);        // e.g. "01", "02", ... "12"
    var msgPeriod =  year + '-' + month;                            // e.g. "2016-02"
    var msgTableName = config.DDB_MESSAGE_TABLE + '-' + conversationId.substring(0,2) + '-' + msgPeriod;    // e.g. "DFMessages-ex-2016-02"
    var timestamp = today.toString();
    
    conversationMgr.updateConversation(conversationId, msgPeriod, function(err, msgCount, msgIndex, dorks) {
        if (err) {
            res.send(403, '403: Forbidden - Error in updateConversation: ' + err);
        } else {
            console.log("Target message table name is: " + msgTableName);
            
            conversationMgr.logUserMessage(userId, msgTableName, conversationId, msgIndex, precedence, timestamp, message, function(err, data) {
                if (err) {
                    res.send(403, '403: Forbidden - Error in logUserMessage: ' + err);
                } else {
                    /*
                     * In order to push message to the corresponding SQS queue, we need to re-format the message
                     * into the format required by SQS:
                     * 
                     * var params = {
                     *   MessageBody: 'STRING_VALUE',
                     *   QueueUrl: 'STRING_VALUE',
                     *   DelaySeconds: 0,
                     *   MessageAttributes: {
                     *     someKey: {
                     *       DataType: 'STRING_VALUE',
                     *       BinaryListValues: [
                     *         new Buffer('...') || 'STRING_VALUE',
                     *         ... ... ...
                     *       ],
                     *       BinaryValue: new Buffer('...') || 'STRING_VALUE',
                     *       StringListValues: [
                     *         'STRING_VALUE',
                     *         ... ... ...
                     *       ],
                     *       StringValue: 'STRING_VALUE'
                     *     },
                     *     ... ...
                     *   }
                     * };
                     * 
                     * Keep in mind that the message may be sent to a group of dorks (e.g. in a group-chat setting). We
                     * push a separate message for each dork in the array. Yes, it could be more efficient to do the split
                     * in the message receive function, but since AWS SQS SDK currently doesn't support StringListValues
                     * as a MessageAttribute, we do it this way for simplicity.
                     */
                    for (var i = 0; i < dorks.length; i++) {
                        var link = message.hasOwnProperty('link')? message.link : '';
                        var params = {
                            MessageBody: message.text,
                            QueueUrl: queueUrl,
                            MessageAttributes: {
                                userId: {DataType: 'String', StringValue: userId},
                                conversationId: {DataType: 'String', StringValue: conversationId},
                                dorkId: {DataType: 'String', StringValue: dorks[i]},
                                timestamp: {DataType: 'String', StringValue: timestamp},
                                precedence: {DataType: 'Number', StringValue: precedence.toString()},
                            }
                        };
                        
                        sqs.sendMessage(params, function(err, data) {
                            if (err) {
                                res.send(403, '403: Forbidden - Error in sqs.sendMessage: ' + err);
                            } else {
                                // do nothing, we're not done yet
                            }
                        });
                    }
                    
                    res.json({msgSent: true, msgIndex: msgIndex, msgCount: msgCount});
                }
            });
        }        
    });
}

module.exports = function(app) {
    app.route('/').get(function(req, res, next) {
        res.send('<html><head>'
                    + '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />'
                    + '<title>' + 'DFMessageServer' + '</title>'
                    + '</head><body>'
                    + 'This is a node.js module running on AWS Elastic Beanstalk'
                    + '<br><br>'
                    + '</body></html>');
    });
    app.route('/conversations/:conversationId').get(getConversation);
    app.route('/conversations/:conversationId/messages').get(getMessages).post(postMessage);
}
