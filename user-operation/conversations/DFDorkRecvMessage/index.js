console.log('Loading function');

// dependencies
var AWS = require('aws-sdk');
var config = require('./config.json');
var u2dQueueUrl = 'https://sqs.' + config.REGION + '.amazonaws.com/' + config.AWS_ACCOUNT_ID + '/' + config.SQS_MESSAGE_U2D;
var sqs = new AWS.SQS();

// Get reference to AWS clients
var docClient = new AWS.DynamoDB.DocumentClient();

exports.handler = function(event, context) {
    //console.log('Received event:', JSON.stringify(event, null, 2));
    var message = event.Records[0].Sns.Message;
    console.log('From SNS:', message);
    
    // pull messages from the corresponding SQS queue
    var params = {
        QueueUrl: u2dQueueUrl,
        MaxNumberOfMessages: 10
    };
    
    sqs.receiveMessage(params, function(err, data) {
        if (err) {
            context.fail('404: Not Found - Error in sqs.recvMessage: ' + err);
        } else {
            for (var i = 0; i < data.Messages.length; i++) {
                console.log("#" + i + " message : " + data.Messages[i].Body);
                sqs.deleteMessage({
                    QueueUrl: u2dQueueUrl,
                    ReceiptHandle: data.Messages[i].ReceiptHandle
                }, function(err, data) {
                    if (err) {
                        console.log(err, err.stack);
                        context.fail('403: Forbidden - Error in sqs.deleteMessage: ' + err);
                    }
                });
            }
            context.succeed("Message read from SQS: " + u2dQueueUrl);
        }
    });
};
