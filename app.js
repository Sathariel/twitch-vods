var express = require('express');
var session = require('express-session');
var passport = require('passport');
var OAuth2Strategy = require('passport-oauth').OAuth2Strategy;
var request = require('request');
var handlebars = require('handlebars');

const TWITCH_CLIENT_ID = 'TWITCH_CLIENT_ID';
const TWITCH_SECRET = 'TWITCH_SECRET';
const SESSION_SECRET = 'SESSION_SECRET';
const CALLBACK_URL = 'CALLBACK';

var app = express();
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));
app.use(express.static('public'));
app.use(passport.initialize());
app.use(passport.session());

var token = null;

OAuth2Strategy.prototype.userProfile = function(accessToken, done) {
    var options = {
        url: 'https://api.twitch.tv/kraken/user',
        method: 'GET',
        headers: {
            'Client-ID': TWITCH_CLIENT_ID,
            'Accept': 'application/vnd.twitchtv.v5+json',
            'Authorization': 'OAuth ' + accessToken
        }
    };

    token = accessToken;

    request(options, function(error, response, body) {
        if (response && response.statusCode == 200) {
            done(null, JSON.parse(body));
        } else {
            done(JSON.parse(body));
        }
    });
}

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});

passport.use('twitch', new OAuth2Strategy({
        authorizationURL: 'https://api.twitch.tv/kraken/oauth2/authorize',
        tokenURL: 'https://api.twitch.tv/kraken/oauth2/token',
        clientID: TWITCH_CLIENT_ID,
        clientSecret: TWITCH_SECRET,
        callbackURL: CALLBACK_URL,
        state: true
    },
    function(accessToken, refreshToken, profile, done) {
        profile.accessToken = accessToken;
        profile.refreshToken = refreshToken;
        done(null, profile);
    }
));

app.get('/auth/twitch', passport.authenticate('twitch', {
    scope: 'user_read'
}));

app.get('/auth/twitch/callback', passport.authenticate('twitch', {
    successRedirect: '/',
    failureRedirect: '/'
}));

var template = handlebars.compile('<html><head><title>Twitch Auth Sample</title></head>{{#each following}}<div class="row">{{this}}</div>{{/each}}</html>');

app.get('/', function(req, res) {
    if (req.session && req.session.passport && req.session.passport.user) {
        var user = req.session.passport.user;
        var options = {
            url: 'https://api.twitch.tv/kraken/users/' + user['_id'] + '/follows/channels',
            method: 'GET',
            headers: {
                'Client-ID': TWITCH_CLIENT_ID,
                'Accept': 'application/vnd.twitchtv.v5+json',
                'Authorization': 'OAuth ' + token
            }
        };

        request(options, function(error, response, body) {
            if (response && response.statusCode == 200) {
                var b = JSON.parse(body);
                var following = [];

                b['follows'].forEach((f) => {
                    following.push(f['channel']['display_name']);
                });

                var page = {
                    following: following
                };
                res.send(template(page));
            }
        });
    } else {
        res.send('<html><head><title>Twitch Auth Sample</title></head><a href="/auth/twitch"><img src="http://ttv-api.s3.amazonaws.com/assets/connect_dark.png"></a></html>');
    }
});

app.listen(3000, function() {
    console.log('Twitch auth sample listening on port 3000!')
});