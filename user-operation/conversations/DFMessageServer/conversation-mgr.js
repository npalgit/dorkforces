console.log('Loading function');

// dependencies
var config = require('./config.json');
var AWS = require('aws-sdk');
AWS.config.region = config.REGION;
AWS.config.credentials = new AWS.Credentials('AKIAIDDYKVWJFD4PBGKQ', '17cC8YP14ehpsA4IGIEeSjtOMe9ieY9I7ffoKWrs');
var docClient = new AWS.DynamoDB.DocumentClient();

// We need to increase the "msgCount" field in the corresponding DFConversations table entry
function updateConversation(conversationId, msgPeriod, fn) {
    /*
     * How we update the DFConversations table entry depends on whether the "msgPeriod" attribute has
     * already been created. If the attribute is already there, we need to increase msgPeriod.msgCount by 1;
     * otherwise, we need to add a new msgPeriod attribute, with msgPeriod.msgIndex=msgIndex, and
     * msgPeriod.msgCount=1. The overall msgIndex is returned with the value of the global msgCount.
     */
    console.log("updateConversation: msgPeriod is " + msgPeriod);
    
    docClient.get({
        TableName: config.DDB_CONVERSATION_TABLE,
        Key: {
            conversationId: conversationId
        }
    }, function(err, data) {
        if (err || !data.Item.hasOwnProperty(msgPeriod)) {
            // 'msgPeriod' attribute not yet defined
            docClient.update({
                TableName: config.DDB_CONVERSATION_TABLE,
                Key: {
                    conversationId: conversationId
                },
                UpdateExpression: 'SET #msgMonth=:msgMonth, #msgCount=:globalMsgCount+:increment, #history=list_append(#history, :newMonth)',
                ExpressionAttributeNames: {
                    '#msgMonth': msgPeriod,
                    '#msgCount': 'msgCount',
                    '#history': 'history'
                },
                ExpressionAttributeValues: {
                    ':msgMonth': {'msgIndex': data.Item.msgCount, 'msgCount': 1},
                    ':globalMsgCount': data.Item.msgCount,
                    ':increment': 1,
                    ':newMonth': [msgPeriod]
                },
                ReturnValues: 'ALL_NEW'
            }, function(err, data) {
                if (err) {
                    fn(err, null);
                } else {
                    console.log("DFConversations entry is updated: " + JSON.stringify(data));
                    
                    var msgCount = data.Attributes.msgCount;
                    var msgIndex = msgCount - 1;
                    fn(err, msgCount, msgIndex, data.Attributes.dorks);
                }
            });
        } else {
            // 'msgPeriod' attribute was already defined
            docClient.update({
                TableName: config.DDB_CONVERSATION_TABLE,
                Key: {
                    conversationId: conversationId
                },
                UpdateExpression: 'SET #msgMonth.#msgCount=:msgCount+:increment, #msgCount=:globalMsgCount+:increment',
                ExpressionAttributeNames: {
                    '#msgMonth': msgPeriod,
                    '#msgCount': 'msgCount'
                },
                ExpressionAttributeValues: {
                    ':msgCount': data.Item[msgPeriod].msgCount,
                    ':globalMsgCount': data.Item.msgCount,
                    ':increment': 1
                },
                ReturnValues: 'ALL_NEW'
            }, function(err, data) {
                if (err) {
                    fn(err, null);
                } else {
                    console.log("DFConversations entry is updated: " + JSON.stringify(data));
                    
                    var msgCount = data.Attributes.msgCount;
                    var msgIndex = msgCount - 1;
                    fn(err, msgCount, msgIndex, data.Attributes.dorks);
                }
            });
        }
    });
}

// Log the message in the corresponding DFMessages-xxx-xxxx-xx table entry
function logUserMessage(userId, msgTableName, conversationId, msgIndex, precedence, timestamp, message, fn) {
    docClient.put({
        TableName: msgTableName,
        Item: {
            conversationId: conversationId,
            msgIndex: msgIndex,
            talker: 'user',
            talkerId: userId,
            precedence: precedence,
            timestamp: timestamp,
            msgText: message.text,
            msgLink: message.link
        }
    }, function(err, data) {
        if (err) {
            console.log("Error in logUserMessage: " + err);
            fn(err, null);
        } else {
            fn(err, data);
        }
    });
}

// Log the message in the corresponding DFMessages-xxx-xxxx-xx table entry
function logDorkMessage(dorkId, msgTableName, conversationId, msgIndex, precedence, timestamp, message, fn) {
    docClient.put({
        TableName: msgTableName,
        Item: {
            conversationId: conversationId,
            msgIndex: msgIndex,
            talker: 'dork',
            talkerId: dorkId,
            precedence: precedence,
            timestamp: timestamp,
            msgText: message.text,
            msgLink: message.link
        }
    }, function(err, data) {
        if (err) {
            fn(err, null);
        } else {
            fn(err, data);
        }
    });
}

module.exports.AWS = AWS;
module.exports.docClient = docClient;
module.exports.updateConversation = updateConversation;
module.exports.logUserMessage = logUserMessage;
module.exports.logDorkMessage = logDorkMessage;
