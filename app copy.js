var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var cors = require('cors')
var app = express();
const mongoose = require("mongoose");
require('dotenv/config');
// view engine setup
app.use(cors());
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.use(cors({ credentials: true, origin: true }));


app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');

    // const token = req.headers.authorization;
    // // console.log('req.cookies', req.headers.authorization)
    // if (!token) {

    // }
    // else {
    //     jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
    //         if (err) res.sendStatus(403);
    //         req.user = user;
    //         console.log('user', user)


    //     })
    // }
    next();

});
app.use('/', indexRouter);
app.use('/users', usersRouter);
mongoose.connect(process.env.ATLAS_URI || "mongodb+srv://huudutg:huudutg@funretroDB.yxfs7.mongodb.net/funretroDB?retryWrites=true&w=majority", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true

}, () => console.log('Connected to DB'));
module.exports = app;
