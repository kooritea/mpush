import config from '../config.json'
import { WebHookClientConfig } from '../typings/index.js';

interface Config {
    HTTP_PORT: number,
    WEBSOCKET_PORT: number,
    TOKEN: string,
    WEBHOOK_CLIENTS: WebHookClientConfig[]
}

export default <Config>config