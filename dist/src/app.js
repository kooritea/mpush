"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const HttpServer_1 = __importDefault(require("./module/HttpServer"));
const _config_1 = __importDefault(require("./_config"));
const ClientManager_1 = __importDefault(require("./module/ClientManager"));
const WebScocketServer_1 = __importDefault(require("./module/WebScocketServer"));
const clientManager = new ClientManager_1.default(_config_1.default.WEBHOOK_CLIENTS, (message) => __awaiter(this, void 0, void 0, function* () {
    // 客户端发出的推送请求,目前只有websocket客户端可以发出推送请求
    return new Promise((resolve) => {
        message.once('PushComplete', (status) => {
            resolve(status);
        });
        clientManager.sendMessage(message);
        setTimeout(() => {
            resolve(message.getStatus());
        }, 5000);
    });
}), (mid) => __awaiter(this, void 0, void 0, function* () {
    // 确认推送成功的mid
    // console.log(`已确认推送成功: ` + mid)
}));
new HttpServer_1.default(_config_1.default.HTTP_PORT, (message) => __awaiter(this, void 0, void 0, function* () {
    return new Promise((resolve) => {
        message.once('PushComplete', (status) => {
            resolve(status);
        });
        clientManager.sendMessage(message);
        setTimeout(() => {
            resolve(message.getStatus());
        }, 5000);
    });
}));
new WebScocketServer_1.default(_config_1.default.WEBSOCKET_PORT, _config_1.default.TOKEN, clientManager);
console.log(`HttpServer listen on ${_config_1.default.HTTP_PORT}`);
console.log(`WebSocketServer listen on ${_config_1.default.WEBSOCKET_PORT}`);
//# sourceMappingURL=app.js.map