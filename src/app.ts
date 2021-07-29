// Rreload config
const result = require("dotenv").config()
if (result.error) {
    throw result.error
}
console.log(result.parsed)

import express from 'express'
import session from 'express-session'
import axios from 'axios'
import { AccessToken, StaticAuthProvider, AuthProvider, AuthProviderTokenType, RefreshableAuthProvider } from 'twitch-auth'
import { ApiClient } from 'twitch'
import { SpotifyWrapper } from './spotify-wrapper'
import { TwitchBot } from './twitch_bot'


const app = express()
const port = process.env["PORT"]
let prefix = ""
if (process.env["PREFIX"]) {
    prefix = process.env["PREFIX"]
}

const spotify = new SpotifyWrapper()
const bot = new TwitchBot(spotify)
bot.connect()

app.use(session({ secret: "someverylongstringsecret", saveUninitialized: false, resave: false }))
app.set("view engine", "pug")

const twitchSessionMap = new Map<string, ApiClient>()

app.get("/", add_twitch, async (req, res) => {
    if (req.session.has_twitch) {
        const spotify_uri = `https://accounts.spotify.com/authorize?client_id=${process.env["SPOTIFY_ID"]}&redirect_uri=${process.env["SPOTIFY_URI"]}&response_type=code&scope=user-modify-playback-state%20user-read-currently-playing&state=averylongstringtologin`
        const name = (await twitchSessionMap.get(req.sessionID).helix.users.getMe()).name
        const has_bot = bot.isInChannel(`#${name}`)
        const has_spotify = spotify.hasConnection("#" + name)
        res.render("index", { name, has_bot, spotify_uri, has_spotify })
    } else {
        const twitch_uri = `https://id.twitch.tv/oauth2/authorize?client_id=${process.env["TWITCH_ID"]}&redirect_uri=${process.env["TWITCH_URI"]}&response_type=code&scope=user:read:email%20chat:read%20chat:edit%20channel:read:redemptions&state=averylongstringtologin`
        res.render("login-twitch", { twitch_uri })
    }
})

app.get("/add_bot", add_twitch, async (req, res) => {
    if (req.session.has_twitch) {
        const name = (await twitchSessionMap.get(req.sessionID).helix.users.getMe()).name
        await bot.joinChannel(`#${name}`)
    }
    res.redirect("/")
})

app.get("/remove_bot", add_twitch, async (req, res) => {
    if (req.session.has_twitch) {
        const name = (await twitchSessionMap.get(req.sessionID).helix.users.getMe()).name
        await bot.leaveChannel(`#${name}`)
    }
    res.redirect("/")
})

app.get("/twitch-oauth", async (req, res) => {
    if (req.query.code) {
        const response = await axios({
            method: 'post',
            url: `https://id.twitch.tv/oauth2/token?client_id=${process.env["TWITCH_ID"]}&client_secret=${process.env["TWITCH_SECRET"]}&code=${req.query.code}&grant_type=authorization_code&redirect_uri=${process.env["TWITCH_URI"]}`,
            headers: { accept: 'application/json' }
        })
        req.session.twitch_token = response.data.access_token
        req.session.twitch_refresh = response.data.refresh_token
        res.redirect('/')
    } else {
        res.end()
    }
})

app.get("/spotify-oauth", add_twitch, async (req, res) => {
    if (req.session.has_twitch && req.query.code) {
        const response = await axios({
            method: 'post',
            url: `https://accounts.spotify.com/api/token?code=${req.query.code}&grant_type=authorization_code&redirect_uri=${process.env["SPOTIFY_URI"]}`,
            headers: { accept: 'application/json' },
            auth: {
                username: process.env["SPOTIFY_ID"],
                password: process.env["SPOTIFY_SECRET"]
            }
        })
        const name = (await twitchSessionMap.get(req.sessionID).helix.users.getMe()).name
        spotify.addConnection("#" + name, response.data.access_token, response.data.expires_in, response.data.refresh_token)
    }
    res.redirect("/")
})

app.get("/remove-spotify", add_twitch, async (req, res) => {
    if (req.session.has_twitch) {
        const name = (await twitchSessionMap.get(req.sessionID).helix.users.getMe()).name
        spotify.remove("#" + name)
    }
    res.redirect("/")
})

app.listen(port)

function add_twitch(req: express.Request, res: express.Response, next) {
    if (req.session.twitch_token) {
        if (!twitchSessionMap.has(req.sessionID)) {
            const authProvider = new RefreshableAuthProvider(new StaticAuthProvider(process.env["TWITCH_ID"], req.session.twitch_token), { clientSecret: process.env["TWITCH_SECRET"], refreshToken: req.session.twitch_refresh })
            const twitchClient = new ApiClient({ authProvider })
            twitchSessionMap.set(req.sessionID, twitchClient)
        }
        req.session.has_twitch = true
    } else {
        req.session.has_twitch = false
    }
    next()
}