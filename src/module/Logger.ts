import config from '../_config'

export default {
    notice(text: any): void {
        console.log(text)
    },
    debug(text: any): void {
        if (config.DEBUG) {
            console.log(text)
        }
    },
    warn(text: any): void {
        console.warn(text)
    },
    error(text: any): void {
        console.error(text)
    }
}