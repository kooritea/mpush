/**
 * WebHookClient
 * create 2019/8/1
 */

import Client from "./Client";

export default class WebHookClient extends Client {
    constructor(name: string, group?: string) {
        super(name, group)
    }
}