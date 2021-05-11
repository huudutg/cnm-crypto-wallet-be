"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.state = exports.action = exports.rerender = void 0;
const ramda_1 = require("ramda");
const Blockchain_1 = __importDefault(require("./model/Blockchain"));
const crypto_1 = require("./crypto");
const defaultBlockchain = new Blockchain_1.default("Bitcoin");
function createIdentity(name) {
    const pair = crypto_1.generatePair();
    return Object.assign({ name: name }, pair);
}
console.log("%c 121314331", "color: blue;", 121314331);
const identity = createIdentity("1");
const identities = {};
identities[identity.publicKey] = identity;
const state = {
    walkthrough: {
        show: true,
        step: 0,
        enabled: window.localStorage.getItem("walkthroughEnabled") === null,
    },
    blockchains: [defaultBlockchain],
    selectedBlockchain: defaultBlockchain,
    identities: identities,
    node: identity,
};
exports.state = state;
// If prospective employers see this, I know very much that mutation of state in place is discouraged, but was done here for pedagogical reasons
const action = function (actionPayload) {
    console.log(actionPayload);
    let data;
    switch (actionPayload.type) {
        case "PICK_BLOCKCHAIN":
            if (actionPayload.name === "")
                break;
            let blockchain = ramda_1.find((bc) => bc.name === actionPayload.name)(state.blockchains);
            if (blockchain === undefined) {
                blockchain = new Blockchain_1.default(actionPayload.name);
                state.blockchains.push(blockchain);
            }
            state.selectedBlockchain = blockchain;
            break;
        case "BLOCKCHAIN_BROADCAST":
            actionPayload.names.forEach((name) => {
                if (!ramda_1.any((b) => b.name === name)(state.blockchains)) {
                    const blockchain = new Blockchain_1.default(name);
                    state.blockchains.push(blockchain);
                }
            });
            break;
        case "ADD_IDENTITY": {
            const identity = createIdentity(actionPayload.name);
            state.identities[identity.publicKey] = identity;
            data = identity;
            console.log("%c dataADD_IDENTITY", "color: blue;", data);
            return data;
        }
        case "CHANGE_IDENTITY_NAME": {
            const identity = state.identities[actionPayload.publicKey];
            if (identity === undefined)
                break;
            identity.name = actionPayload.name;
            break;
        }
        case "HIDE_WALKTHROUGH": {
            state.walkthrough = Object.assign(Object.assign({}, state.walkthrough), { show: false });
            break;
        }
        case "ADVANCE_WALKTHROUGH": {
            if (actionPayload.step !== undefined) {
                if (state.walkthrough.step > actionPayload.step)
                    break;
                state.walkthrough.step = actionPayload.step;
            }
            else
                state.walkthrough.step += 1;
            state.walkthrough.show = true;
            break;
        }
        case "DISABLE_WALKTHROUGH": {
            state.walkthrough = Object.assign(Object.assign({}, state.walkthrough), { enabled: false });
            break;
        }
        case "RERENDER":
            // do nothing really
            break;
        default:
            break;
    }
    return data;
};
exports.action = action;
function rerender() {
    action({ type: "RERENDER" });
}
exports.rerender = rerender;
//# sourceMappingURL=store.js.map