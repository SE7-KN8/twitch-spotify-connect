import { ChatUserstate, Client } from 'tmi.js'
import { readFileSync, writeFileSync } from 'fs'
import { SpotifyWrapper } from './spotify-wrapper'

class TwitchBotState {
    joinedChannels: string[] = []

    static getDefault(): TwitchBotState {
        return new TwitchBotState()
    }
}

export class TwitchBot {

    private client: Client
    private state: TwitchBotState
    private spotify: SpotifyWrapper

    constructor(spotify: SpotifyWrapper) {
        this.spotify = spotify
        this.state = this.loadState()
        this.client = new Client({
            options: {
                debug: true
            },
            identity: {
                username: "se7kn8bot",
                password: process.env["TWITCH_BOT_OAUTH"]
            },
            channels: this.state.joinedChannels
        });

        this.client.on("message", async (channel: string, userstate: ChatUserstate, message: string, self: boolean) => {
            if (self) return;

            try {
                if (userstate["custom-reward-id"] === "0c212cce-5f39-4241-86b4-6c2eb4ccb01b") {
                    this.searchAndPlay(channel, message)
                }
            } catch (error) {
                console.log(error)
            }

            if (message.startsWith("!se7kn8")) {
                this.handleSubcommand(channel, message)
            } else if (message === "!song") {
                this.handleSongInfo(channel);
            } else if (message === "!skip") {
                if (userstate.badges.moderator || userstate.badges.broadcaster) {
                    this.handleSkip(channel)
                } else {
                    this.client.say(channel, "Only allowed for mods!");
                }
            }
            /*else if (message.startsWith("!playsong")) {
                this.searchAndPlay(channel, message.split("!playsong")[1])
            }*/
            else if (userstate.username === "se7kn8" && message === "Hey @se7kn8bot") {
                this.client.say(channel, "Hey @se7kn8!")
            }
        });
    }

    async connect() {
        await this.client.connect();
    }

    async joinChannel(name: string) {
        // Test if we are already in the channel
        if (!this.isInChannel(name)) {
            console.log("Join channel " + name)
            this.state.joinedChannels.push(name)
            this.saveState()
            try {
                await this.client.part(name)
            } catch (error) {
                console.log(error)
            }
        }
    }

    async leaveChannel(name: string) {
        if (this.isInChannel(name)) {
            console.log("Leave channel " + name)
            const index = this.state.joinedChannels.indexOf(name)
            this.state.joinedChannels.splice(index, 1)
            this.saveState()
            try {
                await this.client.part(name)
            } catch (error) {
                console.log(error)
            }
        }
    }

    isInChannel(name: string) {
        return this.state.joinedChannels.indexOf(name) !== -1
    }

    private async handleSkip(channel: string) {
        await this.spotify.skipCurrent(channel)
        setTimeout(async () => {
            const name = await this.spotify.getCurrentTrack(channel)
            this.client.say(channel, "Now playing: " + name)
        }, 1000)
    }

    private async searchAndPlay(channel: string, search) {
        await this.spotify.searchAndPlay(channel, search)
        setTimeout(async () => {
            const name = await this.spotify.getCurrentTrack(channel)
            this.client.say(channel, "Coming next: " + name)
        }, 1000)
    }

    private async handleSongInfo(channel: string) {
        const name = await this.spotify.getCurrentTrack(channel)
        this.client.say(channel, "Current song: " + name)
    }

    private loadState(): TwitchBotState {
        try {
            const file = readFileSync("bot-state.json", { encoding: 'utf-8' })
            return JSON.parse(file)
        } catch (error) {
            return TwitchBotState.getDefault()
        }
    }

    private saveState() {
        try {
            const json = JSON.stringify(this.state)
            writeFileSync("bot-state.json", json, { encoding: 'utf-8' })
        } catch (error) {
            console.log(error)
        }
    }

    private handleSubcommand(channel: string, message: string) {
        if (message === "!se7kn8 info") {
            this.client.say(channel, "se7kn8bot by @se7kn8. Version 1.0.0. For all commands type !se7kn8 commands")
        } else if (message === "!se7kn8 commands") {
            this.client.say(channel, "!se7kn8 info; !se7kn8 commands")
        }
    }

}