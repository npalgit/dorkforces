
var sqsConsumer = require('sqs-consumer');
var csClient = require('./csclient');
var appRestServer = require('./server');
var conversationMgr = require('./conversation-mgr');
var config = require('./config.json');

var appSqsPolling = sqsConsumer.create({
    queueUrl: 'https://sqs.us-east-1.amazonaws.com/699582799620/DFMessageQueueU2D',
    messageAttributeNames: ['userId', 'conversationId', 'dorkId', 'timestamp', 'precedence'],
    batchSize: 10,
    handleMessage: function (message, done) {
        // do some work with `message`
        console.log("Message received: " + message.Body);
        
        csClient.converse(message.MessageAttributes.userId.StringValue, '', message.Body, function(err, chatRep) {
            if (err) {
                console.log('Error in connecting to ChatScript client: ' + err);
            } else if (!chatRep) {
                console.log('No response from ChatScript client.');
            } else {
                console.log('Response: ' + chatRep);
                
                var conversationId = message.MessageAttributes.conversationId.StringValue;
                var dorkId = message.MessageAttributes.dorkId.StringValue;
                var precedence = parseInt(message.MessageAttributes.precedence.StringValue);
                var today = new Date();
                var year = today.getUTCFullYear().toString();                   // e.g. "2016""
                var month = ("0" + (today.getUTCMonth() + 1)).slice(-2);        // e.g. "01", "02", ... "12"
                var msgPeriod =  year + '-' + month;                            // e.g. "2016-02"
                var msgTableName = config.DDB_MESSAGE_TABLE + '-' + conversationId.substring(0,2) + '-' + msgPeriod;    // e.g. "DFMessages-ex-2016-02"
                var timestamp = today.toString();
                
                conversationMgr.updateConversation(conversationId, msgPeriod, function(err, msgCount, msgIndex, dorks) {
                    if (err) {
                        console.log('403: Forbidden - Error in updateConversation: ' + err);
                    } else {
                        console.log("Target message table name is: " + msgTableName);
                        var message = {
                            text: chatRep
                        };
                        conversationMgr.logDorkMessage(dorkId, msgTableName, conversationId, msgIndex, precedence, timestamp, message, function(err, data) {
                            if (err) {
                                console.log('403: Forbidden - Error in logDorkMessage: ' + err);
                            } else {
                                console.log("dork's response was logged!");
                            }
                        });
                    }
                });
            }
        });
        
        done();
    }
});
 
appSqsPolling.on('error', function (err) {
    console.log(err.message);
});
 
appSqsPolling.start();
appRestServer.start();
