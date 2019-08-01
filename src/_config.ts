import config from '../config.json'

interface Config {
    HTTP_PORT: number,
    WEBSOCKET_PORT: number,
    TOKEN: string
}

export default <Config>config