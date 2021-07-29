import 'express-session'

declare module "express-session" {
  interface Session {
    twitch_token: string,
    twitch_refresh: string
    has_twitch: boolean
  }
}