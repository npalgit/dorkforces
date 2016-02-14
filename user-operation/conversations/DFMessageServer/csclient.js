/*
 * The client webpage/program connects on a socket to the IP and port of the server. If you
 * are coming from a webpage, the webpage must establish the socket. The system does not
 * use HTTP. HTTP is an agreement on what port to use (a standard http port) and what
 * message protocols look like to the HTTP server. Similarly ChatScript uses an agreement
 * on what port to use (but you get to specify the port) and what the message protocols look
 * like.
 */
var net = require('net');

/*
 * Each communication is a one-shot deal. The socket is made, the client sends a
 * message to the server, the server sends data back, AND CLOSES THE CONNECTION.
 */
module.exports.converse = function(username, botname, msg, fn) {
    var cs_client = new net.Socket();
    var cs_port   = 1024;

    cs_client.connect(cs_port, 'ec2-52-26-7-103.us-west-2.compute.amazonaws.com', function() {
        console.log('ChatScript Connected');
        var username_buf = new Buffer(username);
        var botname_buf  = new Buffer(botname);
        var msg_buf      = new Buffer(msg);
        var null_buf1    = new Buffer([0]);
        var null_buf2    = new Buffer([0]);
        var null_buf3    = new Buffer([0]);
        var final_msgbuf = Buffer.concat([username_buf, null_buf1, botname_buf, null_buf2, msg_buf, null_buf3]);
        
        cs_client.write(final_msgbuf);
    });

    cs_client.on('data', function(data) {
        console.log('ChatScript Server Message Received: ' + data.toString());
        fn(null, data.toString());
        cs_client.destroy(); // kill client after server's response
    });

    cs_client.on('close', function() {
        console.log('ChatScript Connection Closed');
    });

    cs_client.on('error', function(err) {
        console.log('ChatScript Connection Disconnected with error: ' + err);
        fn(err, null);
    });
};
