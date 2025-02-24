
const express = require('express');
const bodyParser = require('body-parser');
const Blockchain = require('./blockchain');
const { v4: uuid } = require('uuid');//for keys
const uniqid = require('uniqid');//for invitations
const rp = require('request-promise');
var path = require('path');
var validator = require('validator');
const sha256 = require('sha256');
const fs = require('fs');
const MongoClient = require('mongodb').MongoClient;
const http = require('http');
var nodemailer = require('nodemailer');
var forge = require('node-forge');
var cors = require('cors')
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var elliptic = require('elliptic');
const ec = new elliptic.ec("secp256k1");
function generatePair(name) {
    const keypair = ec.genKeyPair();
    return {
        name: name,
        publicKey: keypair.getPublic("hex"),
        privateKey: keypair.getPrivate("hex")
    };
}

var { Server, Socket } = require('socket.io');

// rest of the code remains same
const app = express();

// middlewares
app.use(express.json());
app.use(cors());
app.use(bodyParser.json());

// Server.buildServices(app);
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:3001",
        credentials: true,
    },
    allowEIO3: true
});

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";//fixing nodemailer

const backup = new Blockchain();
const privateKey = uuid().split('-').join(''); //privateKey
const public_key = sha256(privateKey); //publicKey
const master = backup.createNewTransaction(1000000, "system-reward", public_key);
backup.chain[0].transactions.push(master);


fs.appendFileSync('masterKeysForDelete.txt', '\nprivateKey: ' + privateKey);
fs.appendFileSync('masterKeysForDelete.txt', '\npublicKey: ' + public_key);



var url = "mongodb://localhost:27017/invitationsDB";
MongoClient.connect(url, function (err, db) {
    if (err) throw err;
    let dbo = db.db("invitationsDB");
    dbo.collection("users").find().toArray(function (err, result) {//check if user collection already exist
        if (err) throw err;
        if (result.length !== 0)
            console.log('Collection already exist');
        else {
            console.log("Database created!");
            dbo.createCollection("users", function (err, res) {
                if (err) throw err;
                console.log("Collection created!");

                let user = {//master user
                    key: public_key,
                    inv: 1000000,
                    availableInvitations: []
                };
                //init first user in db - the master.
                dbo.collection("users").insertOne(user, function (err, res) {
                    if (err) throw err;
                    console.log("master inserted");
                    console.log(db.db("invitationsDB").listCollections());
                    db.close();
                });
            });
        }
    });
});

///////////////////////////////////////////////////////////////////////////////////////////////
/*  -Configurations & server-  */
///////////////////////////////////////////////////////////////////////////////////////////////
const port = process.env.PORT || 5000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

server.listen(port, function () {
    console.log('listening to port: ' + port);
});
// app.get('/blockchain', (req, res) => {
//     res.send(backup);
// });
///////////////////////////////////////////////////////////////////////////////////////////////
/*  -find index of socket | For example : search((socket.id).toString(), nodes);-  */
///////////////////////////////////////////////////////////////////////////////////////////////
function search(nameKey, myArray) {
    for (var i = 0; i < myArray.length; i++) {
        if (myArray[i].socketId === nameKey) {
            return i;
        }
    }
}
////////////////////////////////////////// ~@ -Start socket.io- @~ //////////////////////////////////////////


const nodes = [];

/*  -Socket.io-  */
io.on('connection', (socket) => {
    /*  -On connection of socket-  */
    nodes.push(new Blockchain(socket.id));
    socket.emit('PT', backup.pendingTransactions);//emit to that specific socket
    console.log('New user connected');
    console.log(socket.id);
    const room = io.sockets.adapter.rooms.get(socket.id);
    /*
    * Title: Broadcast Transanction section
    * Description: Init transaction for every endpoint.
    */
    app.post('/transaction/broadcast', (req, res) => {

        console.log('%c req.body', 'color: blue;', req.body)
        const amount = parseFloat(req.body.amount);
        const newTransaction = nodes[nodes.length - 1].createNewTransaction(amount, req.body.sender, req.body.recipient);
        let flag = true;
        let sender = req.body.sender;
        /*  -Authentication: check for valid private key-  */
        if ((sender !== "system-reward") && (sender !== "system-reward: new user") && (sender !== "system-reward: invitation confirmed")) {
            const privateKey_Is_Valid = sha256(req.body.privKey) === req.body.sender;
            if (!privateKey_Is_Valid) {
                flag = false;
                res.json({
                    note: false
                });
            }
            /*  -Authentication: check if user have the require amount of coins for current transaction && if user exist in the blockchain-  */
            const addressData = backup.getAddressData(req.body.sender);
            const addressData1 = backup.getAddressData(req.body.recipient);
            if (addressData.addressBalance < amount || addressData === false || addressData1 === false) {
                flag = false;
                res.json({
                    note: false
                });
            }
            /*  -Authentication: fields cannot be empty-  */
            if (req.body.amount.length === 0 || amount === 0 || amount < 0 || req.body.sender.length === 0 || req.body.recipient.length === 0) {
                flag = false;
                res.json({
                    note: false
                });
            }
        }

        if (amount > 0 && flag === true) {
            var pt = null;
            backup.addTransactionToPendingTransactions(newTransaction);//put new transaction in global object
            nodes.forEach(socketNode => {
                socketNode.addTransactionToPendingTransactions(newTransaction);
                if (!room.sockets) {
                    room.sockets = {}
                }
                if (!room.sockets[(socketNode.socketId).toString()]) {
                    room.sockets[(socketNode.socketId).toString()] = {}
                }
                room.sockets[(socketNode.socketId).toString()].pendingTransactions = socketNode.pendingTransactions;//add property to socket
                pt = socketNode.pendingTransactions;
            });
            io.emit('blockchain', backup);
            // io.emit('PT', backup);//emit to all sockets
            res.json({
                note: `Transaction complete!`
            });
        }
    });


    /*
    * Title: Miner section
    * Description: user mine the last block of transaction by POW, getting reward and init a new block
    */
    app.post('/mine', (req, res) => {
        const lastBlock = backup.getLastBlock();
        const previousBlockHash = lastBlock['hash'];
        const recipient = req.body.recipient
        const currentBlockData = {
            transactions: backup.pendingTransactions,
            index: lastBlock['index'] + 1
        }
        console.log('%c new Date()', 'color: blue;', new Date().toLocaleString('en-GB', { timeZone: 'UTC' }))
        const nonce = backup.proofOfWork(previousBlockHash, currentBlockData);//doing a proof of work
        const blockHash = backup.hashBlock(previousBlockHash, currentBlockData, nonce);//hash the block
        const newBlock = backup.createNewBlock(nonce, previousBlockHash, blockHash);//create a new block with params

        const requestOptions = {//a promise to make a new block
            uri: backup.currentNodeUrl + '/receive-new-block',
            method: 'POST',
            body: { newBlock: newBlock },
            json: true
        };
        rp(requestOptions)
            .then(data => {//reward the miner after mining succed and new block already created
                const requestOptions = {
                    uri: backup.currentNodeUrl + '/transaction/broadcast',
                    method: 'POST',
                    body: {
                        amount: 12.5,
                        sender: "system-reward",
                        recipient
                    },
                    json: true
                };
                console.log('%c recipient', 'color: blue;', requestOptions)
                return rp(requestOptions);
            })
            .then(data => {
                backup.transactionsHistory = [...backup.transactionsHistory, ...currentBlockData.transactions]
                io.emit('blockchain', backup);
                res.json({
                    note: "New block mined and broadcast successfully",
                    block: newBlock
                });
            });
    });


    /*
    * Title: receive new block section
    * Description: checking validity of new block.
    */
    app.post('/receive-new-block', (req, res) => {
        const newBlock = req.body.newBlock;
        const lastBlock = backup.getLastBlock();
        const correctHash = lastBlock.hash === newBlock.previousBlockHash;
        const correctIndex = lastBlock['index'] + 1 === newBlock['index'];

        if (correctHash && correctIndex) {
            backup.chain.push(newBlock);
            backup.pendingTransactions = [];
            res.json({
                note: 'New block received and accepted.',
                newBlock: newBlock
            });
        }
        else {
            res.json({
                note: 'New block rejected',
                newBlock: newBlock
            });
        }
    });


    /*
    * Title: emitMiningSuccess
    * Description: emit all sockets - a message to all sockets for mining operation succed
    */
    app.get('/emitMiningSuccess', (req, res) => {
        io.clients().emit('mineSuccess', true);//emit to all sockets
    });


    /*
    * Title: pendingTransactions
    * Description: get all pending Transactions
    */
    app.get('/pendingTransactions', (req, res) => {
        const transactionsData = backup.getPendingTransactions();
        res.json({
            pendingTransactions: transactionsData
        });
    });


    /*
    * Title: Main Blockchain
    * Description: display the whole block chain (Developers Only!)
    */
    app.get('/blockchain', (req, res) => {
        res.send(backup);
    });

    /*
* Title: generateKeyPair
* Description: generateKeyPair
*/
    app.post('/generateKeyPair', (req, res) => {
        const privateKey = uuid().split('-').join(''); //privateKey
        const publicKey = sha256(privateKey); //publicKey
        // var keyPair = generatePair(req.body.name);
        backup.addIdentity({ publicKey, privateKey, name: req.body.name })
        const master = backup.createNewTransaction(100, "system-reward", publicKey);
        backup.getLastBlock().transactions.push(master);
        res.send({ publicKey, privateKey, name: req.body.name });
    });

    /*
    * Title: Authentication Keys
    * Description: Authentication for private and public keys
    */
    app.post('/hashKeys', (req, res) => {
        const k2 = req.body.publicKey;

        //const k1 = keyPair.privateKey.decrypt(req.body.k1);
        //console.log(k1);

        const k1 = req.body.privateKey;
        console.log('%c req.body', 'color: blue;', req.body)
        const privateKey_Is_Valid = sha256(k1) === k2;

        const addressData = backup.getAddressData(k2);
        if (addressData === false) {
            res.json({
                note: false
            });
        }

        else if (!privateKey_Is_Valid) {
            res.json({
                note: false
            });
        }
        else {
            res.json(addressData);
        }

    });


    /*
    * Title: Send Invitation (INVITE A FRIEND: step 1/3)
    * Description: generate an invitation and send it to recipient email
    */
    app.post('/sendInvitation', (req, res) => {
        let email = req.body.email;//email of recipient
        const senderKey = req.body.sender;//sender ID/Key
        let invitationID = uniqid();//generate invitation ID

        var toChange;//the value that need to be change
        if (validator.isEmail(email.toString())) {
            /*  -Connect to database "invitationsDB"-  */
            MongoClient.connect(url, function (err, db) {
                if (err) throw err;
                console.log("Database connected!");
                let dbo = db.db("invitationsDB");

                let query = { key: senderKey };//query to find

                let promise = new Promise(function (resolve, reject) {
                    dbo.collection("users").find(query).toArray(function (err, result) {//find the sender in db
                        if (err) throw err;
                        toChange = result[0].inv;//set the veriable to the num of avilable invitations 
                        resolve("done!");
                    });
                });
                promise.then(
                    function (result) {
                        if (toChange === 0) {
                            toChange = 0;
                            res.json({
                                note: false,
                                message: 'dismiss - num of invitation is 0'
                            });
                        }
                        else {
                            toChange--;//substruct the num of available invitations
                            let newvalues = { $set: { inv: toChange } };
                            let newInvite = { $push: { availableInvitations: invitationID } };
                            dbo.collection("users").updateOne(query, newvalues, function (err, res1) {//update in db
                                if (err) throw err;
                                console.log(res1.result.nModified + " document(s) updated");
                                dbo.collection("users").updateOne(query, newInvite, function (err, res2) {//update in db
                                    if (err) throw err;
                                    console.log(res2.result.nModified + " document(s) updated");
                                    ///////////////////////////////////////////////////////////////

                                    /*  -going to invitation end point and generate new invitation-  */
                                    const uri = backup.currentNodeUrl + '/invitation/' + invitationID + '/sender=' + senderKey;
                                    const requestOptions = {
                                        uri: uri,
                                        method: 'GET',
                                        json: true
                                    };
                                    rp(requestOptions)
                                        .then(data => {
                                            //
                                        });

                                    /*  -email configurations-  */
                                    var transporter = nodemailer.createTransport({
                                        service: 'gmail',
                                        auth: {
                                            user: 'YourEmailAdress@gmail.com',
                                            pass: 'YourPassword'
                                        }
                                    });

                                    var mailOptions = {
                                        from: 'JewCOIN',
                                        to: email,
                                        subject: 'הוזמנת לרשת הבלוקציין של JewCOIN',
                                        text: 'קיבלת הזמנה לרשת הבלוקציין של JewCOIN \n להפעלת החשבון לחץ על הקישור המצורף:\n\n' + uri
                                    };

                                    /*  -send the email-  */
                                    transporter.sendMail(mailOptions, function (error, info) {
                                        if (error) {
                                            console.log(error);
                                            res.json({
                                                note: false
                                            });
                                        }
                                        else {
                                            console.log('Email sent: ' + info.response);
                                            res.json({
                                                note: true,
                                                numOfInv: toChange
                                            });
                                        }
                                    });

                                    ///////////////////////////////////////////////////////////////
                                    db.close();
                                });
                            });

                        }
                    },
                    function (error) {
                        console.log("there was an error");
                    }
                )
            });
        }

        else {
            res.json({
                note: 'not valid email'
            });
        }

    });

    /*  -Chat: send message to all users-  */
    /*
    * Title: Chat - get new message
    * Description: get a message and emit it to all users
    */
    socket.on('getNewMessage', (message) => {
        //message = message.toString();
        //message = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        io.clients().emit('newMessage', message);
    });

    /*
    * Title: disconnect
    * Description: enabled when user logs off
    */
    socket.on('disconnect', () => {
        console.log(`User: ${socket.id} was disconnected`)
        nodes.splice(search((socket.id).toString(), nodes), 1);
    });

});


/////////////////////////////////////////// ~@ -End socket.io- @~ ///////////////////////////////////////////


///////////////////////////////////////////////////////////////////////////////////////////////
/*  -invitation page (INVITE A FRIEND: step 2/3)-  */
/*  -search the invitation in db => if not found will display error, if found will display the invitation-  */
///////////////////////////////////////////////////////////////////////////////////////////////
app.get('/invitation/:invitationID/sender=:senderID', (req, res) => {

    const invitationID = req.params.invitationID;
    const senderID = req.params.senderID;

    /*  -Connect to database "invitationsDB"-  */
    MongoClient.connect(url, function (err, db) {
        if (err) throw err;
        console.log("Database connected!");
        let dbo = db.db("invitationsDB");

        let query = { key: senderID, availableInvitations: invitationID };//query to find

        dbo.collection("users").find(query).toArray(function (err, result) {//find the sender in db
            if (err) throw err;
            console.log(result);
            if (result.length === 0) {
                res.render(__dirname + '/Front/error.ejs');//respond error page
            }
            else {
                const priK = uuid().split('-').join(''); //privateKey
                const pubK = sha256(priK); //publicKey
                res.render(__dirname + '/Front/invitation.ejs', {//respond invitation page
                    privateKey: priK,
                    publicKey: pubK,
                    invitationID: invitationID,
                    senderID: senderID
                });
            }
            db.close();
        });
    });
});


///////////////////////////////////////////////////////////////////////////////////////////////
/*  -confirm register (INVITE A FRIEND: step 3/3)-  */
/*  -when user press confirm registeration button (del invitation, make transactions to sender and recipient-  */
///////////////////////////////////////////////////////////////////////////////////////////////
app.post('/confirmRegister', (req, res) => {
    const recipient_public_key = req.body.recipient_public_key;
    const invitationID = req.body.invitationID;
    const senderID = req.body.senderID;

    /*  -Connect to database "invitationsDB"-  */
    MongoClient.connect(url, function (err, db) {
        if (err) throw err;
        console.log("Database connected!");
        let dbo = db.db("invitationsDB");

        let query = { key: senderID };//query to find
        //find sender of invitation and make his invitation to unavilable (remove from db)
        dbo.collection("users").find(query).toArray(function (err, result) {//find the sender in db
            if (err) throw err;

            let pullInvite = { $pull: { availableInvitations: invitationID } };
            dbo.collection("users").updateOne(query, pullInvite, function (err, res) {//update in db
                if (err) throw err;
                console.log(res.result.nModified + " document(s) updated");
                db.close();
            });
        });
    });

    /*  -reward new user-  */
    const requestOptions = {
        uri: backup.currentNodeUrl + '/transaction/broadcast',
        method: 'POST',
        body: {
            amount: 100,
            sender: "system-reward: new user",
            recipient: recipient_public_key
        },
        json: true
    };
    rp(requestOptions)
        //reward the sender.
        .then(data => {
            const requestOptions = {
                uri: backup.currentNodeUrl + '/transaction/broadcast',
                method: 'POST',
                body: {
                    amount: 50,
                    sender: "system-reward: invitation confirmed",
                    recipient: senderID
                },
                json: true
            };
            return rp(requestOptions);
        })
        .then(data => {
            /*  -Connect to database "invitationsDB": add user invitations to db-  */
            MongoClient.connect(url, function (err, db) {
                if (err) throw err;
                console.log("Database connected!");
                let dbo = db.db("invitationsDB");

                let user = {
                    key: recipient_public_key,
                    inv: 2,
                    availableInvitations: []
                };
                //init new user in db - the master.
                dbo.collection("users").insertOne(user, function (err, res) {
                    if (err) throw err;
                    console.log("master inserted");
                    db.close();
                });
            });
        });
    res.json({
        note: true
    });
});


///////////////////////////////////////////////////////////////////////////////////////////////
/*  -Getters-  */
///////////////////////////////////////////////////////////////////////////////////////////////

/*  -get block by blockHash-  */
app.get('/block/:blockHash', (req, res) => {
    const blockHash = req.params.blockHash;
    const correctBlock = backup.getBlock(blockHash);
    res.json({
        block: correctBlock
    });
});

/*  -get transaction by transactionId-  */
app.get('/transaction/:transactionId', (req, res) => {
    const transactionId = req.params.transactionId;
    const trasactionData = backup.getTransaction(transactionId);
    res.json({
        transaction: trasactionData.transaction,
        block: trasactionData.block
    });
});

/*  -get address by address-  */
app.get('/address/:address', (req, res) => {
    const address = req.params.address;
    const addressData = backup.getAddressData(address);
    res.json({
        addressData: addressData
    });
});

app.get('/Front', (req, res) => {
    res.sendFile('./Front/index.html', { root: __dirname });
});
app.use('/', indexRouter);
app.use('/users', usersRouter);
module.exports = app;