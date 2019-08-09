"use strict";
/**
 * HTTP Server
 * create 2019/7/31
 * 负责建立HTTP服务器，接收并处理curl请求
 * 自带异常请求过滤
 * 生成Message对象交由回调函数处理
 */
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
const http_1 = __importDefault(require("http"));
const url_1 = require("url");
const querystring_1 = __importDefault(require("querystring"));
const Message_1 = __importDefault(require("../model/Message"));
class HttpError extends Error {
    constructor(status, HttpErrorMsg) {
        super(HttpErrorMsg);
        this.HttpErrorMsg = HttpErrorMsg || '';
        this.status = status || 404;
    }
}
class HttpServer {
    /**
     * Http服务器,负责解析curl方法发送的推送请求
     * @param port 监听端口
     * @param callback [callback]传递解析后的message对象,该方法的返回值将返回给客户端
     */
    constructor(port, PostMessage) {
        http_1.default.createServer((request, response) => __awaiter(this, void 0, void 0, function* () {
            try {
                let message = yield this.verifyRequest(request);
                PostMessage(message).then((status) => {
                    response.writeHead(200);
                    response.write(JSON.stringify(status));
                    response.end();
                });
            }
            catch (e) {
                response.writeHead(e.status);
                response.end(e.HttpErrorMsg);
            }
        })).listen(port);
    }
    bodyparser(headers, raw) {
        let result = {};
        let contentType = headers['content-type'];
        try {
            if (/www-form-urlencoded/.test(contentType)) {
                result = querystring_1.default.parse(raw);
            }
            else if (/json/.test(contentType)) {
                result = JSON.parse(raw);
            }
            else {
                throw new HttpError(415, "Unsupported Media Type");
            }
        }
        catch (e) {
            throw new HttpError(415, "Unsupported Media Type");
        }
        return result;
    }
    verifyRequest(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const { pathname, query } = url_1.parse(request.url, true);
            const message = new Message_1.default();
            if (/^\/[0-9a-zA-Z_-]+\.(send|group)$/.test(pathname)) {
                let path = pathname.slice(1);
                message.target = path.split(".")[0];
                message.sendType = path.split(".")[1] === 'send' ? 'personal' : 'group';
            }
            else {
                throw new HttpError(400, "Request Path Invalid Format");
            }
            if (request.method !== 'GET' && request.method !== 'POST') {
                throw new HttpError(405, "Method Not Allowed, Only Allow GET Or POST");
            }
            if (request.method === 'GET') {
                if (typeof query.text === 'string') {
                    message.text = decodeURI(query.text);
                }
                else {
                    if (query.text) {
                        throw new HttpError(400, "Text Is Not A String");
                    }
                }
                if (typeof query.desp === 'string') {
                    message.desp = decodeURI(query.desp);
                }
                else {
                    if (query.desp) {
                        throw new HttpError(400, "Desp Is Not A String");
                    }
                }
            }
            else if (request.method === 'POST') {
                let raw = yield new Promise((resolve) => {
                    let raw = "";
                    request.on("data", function (chunk) {
                        raw += chunk;
                    });
                    request.on("end", function () {
                        resolve(raw);
                    });
                });
                const body = this.bodyparser(request.headers, raw);
                if (typeof body.text === 'string') {
                    message.text = decodeURI(body.text);
                }
                else {
                    if (body.text) {
                        throw new HttpError(400, "Text Is Not A String");
                    }
                }
                if (typeof body.desp === 'string') {
                    message.desp = decodeURI(body.desp);
                }
                else {
                    if (body.desp) {
                        throw new HttpError(400, "Desp Is Not A String");
                    }
                }
            }
            if (!message.verify()) {
                throw new HttpError(400, "Text And Desp Not Found");
            }
            return message;
        });
    }
}
exports.default = HttpServer;
//# sourceMappingURL=HttpServer.js.map