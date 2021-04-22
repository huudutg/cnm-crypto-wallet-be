var express = require('express');
var router = express.Router();
var cors = require('cors')
require('dotenv/config');
const jwt = require("jsonwebtoken");
var bcrypt = require("bcryptjs");
router.use(cors())
/* GET users listing. */
router.get('/', function (req, res, next) {
  res.send('respond with a resource');
});


router.use(function (req, res, next) {
  req.header("Access-Control-Allow-Credentials", true);
  req.header("Access-Control-Allow-Origin", "*");

  next();
});

var passport = require('passport')
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;

const userModel = require('../models/user.model');



router.use(passport.initialize());



router.post("/login", async (req, res) => {
  const body = req.body;
  console.log('body', body)
  if (body) {
    try {
      const userInfo = await userModel.findOne({ email: body.email })
      if (userInfo) {
        const rs = bcrypt.compareSync(body.password, userInfo.password);
        if (rs) {
          const token = jwt.sign(userInfo._id, process.env.SECRET_KEY, { expiresIn: '1h' })
          res.send(token);
        }
      } else {
        res.sendStatus(404)
      }
    } catch (error) {
      console.log('error', error)
      res.sendStatus(500)
    }
  } else
    res.sendStatus(403)
});


router.post("/register", async (req, res) => {
  const body = req.body;
  console.log('body', body)
  const check = await userModel.findOne({ email: body.email })
  console.log('check', check)
  if (!check) {
    try {
      body.password = bcrypt.hashSync(req.body.password, 10);

      body.joindate = new Date();
      const user = new userModel({
        ...body
      })
      user.save()
        .then(data => {
          const token = jwt.sign(data.id, process.env.SECRET_KEY, { expiresIn: "1h" })
          // res.cookie("token2", token);
          res.send(token)
          // console.log('data', data)

        })
        .catch(err => {
          console.log('errrrr2', err)
        })
    } catch (error) {
      console.log('error3', error)
      res.send(error)
    }

  }
  else {
    res.sendStatus(500);

  }
});

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (id, done) {
  done(err, id);
});




passport.use(new FacebookStrategy({
  clientID: "583617728993174",
  clientSecret: "6ef394878235c40427163890af485e04",
  callbackURL: "/users/auth/facebook/callback"
},
  async function (accessToken, refreshToken, profile, done) {
    try {

      let user = profile //check whether user exist in database
      let redirect_url = "";
      if (user) {
        let userInfo = await userModel.findOne({ idSocial: user.id })
        if (!userInfo) {
          const userNew = new userModel({
            idSocial: user.id,
            name: user.displayName,
            joindate: new Date()

          })
          userInfo = await userNew.save()
        }
        console.log('userInfo', userInfo)
        const token = jwt.sign(userInfo.toJSON(), process.env.SECRET_KEY, { expiresIn: '1h' }); //generating token
        redirect_url = `http://localhost:3000?token=${token}` //registered on FE for auto-login
        return done(null, redirect_url);  //redirect_url will get appended to req.user object : passport.js in action
      } else {
        redirect_url = `http://localhost:3000/user-not-found/`;  // fallback page
        return done(null, redirect_url);
      }
    } catch (error) {
      done(error)
    }
  }
));


passport.use(new GoogleStrategy({
  clientID: "330320688539-ii1mtj75i0ba6us5424q4q4h5bn08h72.apps.googleusercontent.com",
  clientSecret: "r2Eczfm39CcZR2Elb2Kh08Ke",
  callbackURL: "/users/auth/google/callback"
},
  async function (accessToken, refreshToken, profile, done) {
    try {

      let user = profile //check whether user exist in database
      let redirect_url = "";
      if (user) {
        let userInfo = await userModel.findOne({ idSocial: user.id })
        if (!userInfo) {
          const userNew = new userModel({
            idSocial: user.id,
            name: user.displayName,
            joindate: new Date()

          })
          userInfo = await userNew.save()
        }
        console.log('userInfo', userInfo)
        const token = jwt.sign(userInfo.toJSON(), process.env.SECRET_KEY, { expiresIn: '1h' }); //generating token
        redirect_url = `http://localhost:3000?token=${token}` //registered on FE for auto-login
        return done(null, redirect_url);  //redirect_url will get appended to req.user object : passport.js in action
      } else {
        redirect_url = `http://localhost:3000/user-not-found/`;  // fallback page
        return done(null, redirect_url);
      }
    } catch (error) {
      done(error)
    }
  }
));


// router.get('/auth/facebook', passport.authenticate('facebook'));
router.get('/auth/facebook',
  passport.authenticate('facebook')
);

router.get('/auth/google',
  passport.authenticate('google', { scope: ['https://www.googleapis.com/auth/plus.login'] })
);




// Facebook will redirect the user to this URL after approval.  Finish the
// authentication process by attempting to obtain an access token.  If
// access was granted, the user will be logged in.  Otherwise,
// authentication has failed.
router.get('/auth/facebook/callback',
  passport.authenticate('facebook', { session: false, failureRedirect: `https://localhost:3000/login` }), (req, res) => {
    console.log('req.user', req.user)
    res.redirect(req.user); //req.user has the redirection_url
  });

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: `https://localhost:3000/login` }), (req, res) => {
    console.log('req.user', req.user)
    res.redirect(req.user); //req.user has the redirection_url
  });



module.exports = router;
