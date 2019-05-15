const config = require("../config.js")

config.TOKEN = config.TOKEN?config.TOKEN:"mpush"
config.WS_PORT = config.WS_PORT?Number(config.WS_PORT):2245
config.HTTP_PORT = config.HTTP_PORT?Number(config.HTTP_PORT):2246
config.REGISTERS = Array.isArray(config.REGISTERS)?config.REGISTERS:[]

module.exports = config