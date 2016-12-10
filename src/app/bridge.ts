/**
 * This file is part of the peer-data package.
 *
 * (c) Rafał Lorenz <vardius@gmail.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import {ConnectionEvent} from "./connection/event";
import {SignalingEvent} from "./signaling/event";
import {SignalingEventType} from "./signaling/event-type";
import {PeerFactory} from "./peer/factory";
import {DataChannelFactory} from "./data-channel/factory";
import {Logger} from "./logger/logger";
import {Signaling} from "./signaling/signaling";
import {Connection} from "./connection/connection";

export class Bridge {
    private label = 'chunks';

    private _servers: RTCConfiguration = {};
    private _dataConstraints?: RTCDataChannelInit = null;
    private _connection: Connection;
    private _logger: Logger;

    constructor(connection: Connection, logger: Logger) {
        this._connection = connection;
        this._logger = logger;
    }

    onConnect(event: ConnectionEvent, signalling: Signaling) {
        let peer = this._connection.peers[event.caller.id] = PeerFactory.get(this._servers, signalling);
        let channel = peer.createDataChannel(this.label, this._dataConstraints);
        this._connection.channels[event.caller.id] = DataChannelFactory.get(channel);
        peer.createOffer((desc: RTCSessionDescription) => {
            let message: SignalingEvent = {
                type: SignalingEventType.OFFER,
                caller: null,
                callee: event.caller,
                data: desc
            };
            peer.setLocalDescription(desc, () => signalling.send(message), this._logger.error.bind(this._logger));
        }, this._logger.error.bind(this._logger));
    }

    onCandidate(event: ConnectionEvent) {
        if (event.data) {
            let peer = this._connection.peers[event.caller.id];
            peer.addIceCandidate(new RTCIceCandidate(event.data));
        }
    }

    onOffer(event: ConnectionEvent, signalling: Signaling) {
        let peer = this._connection.peers[event.caller.id] = PeerFactory.get(this._servers, signalling);
        peer.ondatachannel = (dataChannelEvent: RTCDataChannelEvent) => {
            this._connection.addChannel(event.caller.id, DataChannelFactory.get(dataChannelEvent.channel));
        };
        peer.setRemoteDescription(new RTCSessionDescription(event.data), () => {
        }, this._logger.error.bind(this._logger));
        peer.createAnswer((desc: RTCSessionDescription) => {
            let message: SignalingEvent = {
                type: SignalingEventType.ANSWER,
                caller: null,
                callee: event.caller,
                data: desc
            };
            peer.setLocalDescription(desc, () => signalling.send(message), this._logger.error.bind(this._logger));
        }, this._logger.error.bind(this._logger));
    }

    onAnswer(event: ConnectionEvent) {
        let peer = this._connection.peers[event.caller.id];
        peer.setRemoteDescription(new RTCSessionDescription(event.data), () => {
        }, this._logger.error.bind(this._logger));
    }

    onDisconnect(event: ConnectionEvent) {
        let channel = this._connection.channels[event.caller.id];
        channel.close();
        let peer = this._connection.peers[event.caller.id];
        peer.close();
    }

    get servers(): RTCConfiguration {
        return this._servers;
    }

    set servers(value: RTCConfiguration) {
        this._servers = value;
    }

    get dataConstraints(): RTCDataChannelInit {
        return this._dataConstraints;
    }

    set dataConstraints(value: RTCDataChannelInit) {
        this._dataConstraints = value;
    }

    get connection(): Connection {
        return this._connection;
    }

    set connection(value: Connection) {
        this._connection = value;
    }

    get logger(): Logger {
        return this._logger;
    }

    set logger(value: Logger) {
        this._logger = value;
    }
}
