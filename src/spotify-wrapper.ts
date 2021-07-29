import SpotifyWebApi from 'spotify-web-api-node'
import { readFileSync, writeFileSync } from 'fs'

interface SpotifyObject {
    token: string
    refresh: string
    refresh_at: number
}

export class SpotifyWrapper {

    private spotify: SpotifyWebApi
    private connectionsMap: Map<string, SpotifyObject>

    constructor() {
        this.connectionsMap = this.loadMap()
        this.spotify = new SpotifyWebApi({
            clientId: process.env.SPOTIFY_ID,
            clientSecret: process.env.SPOTIFY_SECRET,
            redirectUri: process.env.SPOTIFY_URI,
        })
    }

    loadMap(): Map<string, SpotifyObject> {
        try {
            const file = readFileSync("spotify-connections.json", { encoding: "utf-8" })
            return new Map(JSON.parse(file))
        } catch (error) {
            return new Map<string, SpotifyObject>()
        }
    }

    saveMap() {
        try {
            const json = JSON.stringify(Array.from(this.connectionsMap))
            writeFileSync("spotify-connections.json", json, { encoding: "utf-8" })
        } catch (error) {
            console.log(error)
        }
    }

    addConnection(name: string, token: string, time: number, refresh: string) {
        if (!this.hasConnection(name)) {
            const endTime = ((new Date().getTime() / 1000) + time) * 1000
            this.connectionsMap.set(name, { token, refresh, refresh_at: endTime })
            this.saveMap()
        }
    }

    remove(name: string) {
        if (this.hasConnection(name)) {
            this.connectionsMap.delete(name)
            this.saveMap()
        }
    }

    hasConnection(name: string): boolean {
        return this.connectionsMap.has(name)
    }

    async getCurrentTrack(channel: string): Promise<string> {
        if (this.hasConnection(channel)) {
            try {
                this.handleAccess(channel)
                const state = await this.spotify.getMyCurrentPlayingTrack()
                const track = await this.spotify.getTrack(state.body.item.id)
                let artists = ""
                track.body.artists.forEach(element => {
                    artists += element.name + " "
                });
                return "'" + track.body.name + "' by '" + artists + "'"
            } catch (error) {
                return "No info!"
            }
        } else {
            return "No info!"
        }
    }

    async searchAndPlay(channel: string, search: string) {
        if (this.hasConnection(channel)) {
            try {
                this.handleAccess(channel)

                const track = await (await this.spotify.searchTracks(search, { limit: 1 })).body.tracks.items[0]
                await this.spotify.addToQueue(track.uri)
                await this.spotify.skipToNext()
            } catch (error) {
                console.log(error)
            }
        }
    }

    async handleAccess(channel: string) {
        const currentObject = this.connectionsMap.get(channel)
        console.log("Token has: " + (currentObject.refresh_at - new Date().getTime()) / 1000 + " sec left")
        this.spotify.setAccessToken(currentObject.token)
        this.spotify.setRefreshToken(currentObject.refresh)
        if (((currentObject.refresh_at - new Date().getTime()) / 1000) < 30) {
            const newToken = await this.spotify.refreshAccessToken()
            currentObject.token = newToken.body.access_token
            currentObject.refresh_at = ((new Date().getTime() / 1000) + newToken.body.expires_in) * 1000
        }
    }

}
