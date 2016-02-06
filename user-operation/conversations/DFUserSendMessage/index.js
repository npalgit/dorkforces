console.log('Loading function');

// dependencies
var AWS = require('aws-sdk');
var config = require('./config.json');
var sqs = new AWS.SQS();
var sns = new AWS.SNS();

// Get reference to AWS clients
var docClient = new AWS.DynamoDB.DocumentClient();
var u2hQueueUrl = 'https://sqs.' + config.REGION + '.amazonaws.com/' + config.AWS_ACCOUNT_ID + '/' + config.SQS_MESSAGE_U2H;
var u2dQueueUrl = 'https://sqs.' + config.REGION + '.amazonaws.com/' + config.AWS_ACCOUNT_ID + '/' + config.SQS_MESSAGE_U2D;
var u2hTopicArn = 'arn:aws:sns:' + config.REGION + ':' + config.AWS_ACCOUNT_ID + ':' + config.SNS_TOPIC_U2H_MESSAGE;
var u2dTopicArn = 'arn:aws:sns:' + config.REGION + ':' + config.AWS_ACCOUNT_ID + ':' + config.SNS_TOPIC_U2D_MESSAGE;

// We need to increase the "msgCount" field in the corresponding DFConversations table entry
function updateConversation(conversationId, fn) {
    docClient.update({
        TableName: config.DDB_CONVERSATION_TABLE,
        Key: {
            conversationId: conversationId
        },
        AttributeUpdates: {
            msgCount: {
                Action: 'ADD',
                Value: 1
            }
        },
        ReturnValues: 'ALL_NEW'
    }, function(err, data) {
        if (err) {
            fn(err, null);
        } else {
            console.log("Message is being posted to conversation: " + JSON.stringify(data));
            
            var msgCount = data.Attributes.msgCount;
            var msgIndex = msgCount - 1;
            fn(err, msgCount, msgIndex, data.Attributes.type, data.Attributes.dorks);
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
            message: message
        }
    }, function(err, data) {
        if (err) {
            fn(err, null);
        } else {
            fn(err, data);
        }
    });
}

exports.handler = function(event, context) {
    var userId = event.userId;
    var conversationId = event.conversationId;
    var message = event.message;
    var precedence = event.precedence;
    var queueUrl = event.demandingHuman? u2hQueueUrl : u2dQueueUrl;
    var topicArn = event.demandingHuman? u2hTopicArn : u2dTopicArn;
    
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
    updateConversation(conversationId, function(err, msgCount, msgIndex, conversationType, dorks) {
        if (err) {
            context.fail('403: Forbidden - Error in updateConversation: ' + err);
        } else {
            var today = new Date();
            var year = today.getUTCFullYear().toString();               // e.g. "2016""
            var month = ("00" + today.getUTCMonth() + 1).slice(-3);     // e.g. "01", "02", ... "12" 
            var msgTableName = config.DDB_MESSAGE_TABLE + '-' + conversationType + '-' + year + '-' + month;    // e.g. "DFMessages-System-2016-02"
            var timestamp = today.toString();
            
            console.log("Target message table name is: " + msgTableName);
            
            logUserMessage(userId, msgTableName, conversationId, msgIndex, precedence, timestamp, message, function(err, data) {
                if (err) {
                    context.fail('403: Forbidden - Error in logUserMessage: ' + err);
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
                    for (var i = 0; i < dorks.values.length; i++) {
                        var params = {
                            MessageBody: message.text,
                            QueueUrl: queueUrl,
                            MessageAttributes: {
                                userId: {DataType: 'String', StringValue: userId},
                                conversationId: {DataType: 'String', StringValue: conversationId},
                                dorkId: {DataType: 'String', StringValue: dorks.values[i]}
                            }
                        };
                        
                        sqs.sendMessage(params, function(err, data) {
                            if (err) {
                                context.fail('403: Forbidden - Error in sqs.sendMessage: ' + err);
                            } else {
                                // do nothing, we're not done yet
                            }
                        });
                    }
                    
                    // We use SNS to trigger the message-processing Lambda function
                    var snsParams = {
                        TopicArn: topicArn,
                        Message: "New message arrived"
                    };
                    sns.publish(snsParams, function(err, data) {
                        if (err) {
                            console.log("Cannot publish to SNS topic: " + err);
                            context.fail('403: Forbidden - Error in sns.publish: ' + err);
                        } else {
                            context.succeed({
                                msgSent: true,
                                msgCount: msgCount
                            });
                        }
                    })
                }
            });
        }        
    });
}
