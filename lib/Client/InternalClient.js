"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var EventEmitter = require("events");
var request = require("superagent");
var WebSocket = require("ws");
var ConnectionState = require("./ConnectionState.js");

var Constants = require("../Constants.js"),
    Endpoints = Constants.Endpoints,
    PacketType = Constants.PacketType;

var Cache = require("../Util/Cache.js");

var User = require("../Structures/User.js"),
    Channel = require("../Structures/Channel.js"),
    TextChannel = require("../Structures/TextChannel.js"),
    VoiceChannel = require("../Structures/VoiceChannel.js"),
    PMChannel = require("../Structures/PMChannel.js"),
    Server = require("../Structures/Server.js"),
    Message = require("../Structures/Message.js");

var zlib;

var InternalClient = (function () {
	function InternalClient(discordClient) {
		_classCallCheck(this, InternalClient);

		this.client = discordClient;
		this.state = ConnectionState.IDLE;
		this.websocket = null;

		if (this.client.options.compress) {
			zlib = require("zlib");
		}

		// creates 4 caches with discriminators based on ID
		this.users = new Cache();
		this.channels = new Cache();
		this.servers = new Cache();
		this.private_channels = new Cache();
	}

	// def login

	InternalClient.prototype.login = function login(email, password) {
		var self = this;
		var client = self.client;
		return new Promise(function (resolve, reject) {
			if (self.state === ConnectionState.DISCONNECTED || self.state === ConnectionState.IDLE) {

				self.state = ConnectionState.LOGGING_IN;

				request.post(Endpoints.LOGIN).send({ email: email, password: password }).end(function (err, res) {

					if (err) {
						self.state = ConnectionState.DISCONNECTED;
						self.websocket = null;
						client.emit("disconnected");
						reject(new Error(err.response.text));
					} else {
						var token = res.body.token;
						self.state = ConnectionState.LOGGED_IN;
						self.token = token;
						self.email = email;
						self.password = password;

						self.getGateway().then(function (url) {

							self.createWS(url);
							resolve(token);
						})["catch"](function (e) {
							self.state = ConnectionState.DISCONNECTED;
							client.emit("disconnected");
							reject(new Error(err.response.text));
						});
					}
				});
			} else {
				reject(new Error("already logging in/logged in/ready!"));
			}
		});
	};

	// def logout

	InternalClient.prototype.logout = function logout() {
		var _this = this;

		var self = this;
		return new Promise(function (resolve, reject) {

			if (self.state === ConnectionState.DISCONNECTED || self.state === ConnectionState.IDLE) {
				reject(new Error("Client is not logged in!"));
				return;
			}

			request.post(Endpoints.LOGOUT).set("authorization", self.token).end(function (err, res) {
				if (err) {
					reject(new Error(err.response.text));
				} else {
					if (_this.websocket) {
						_this.websocket.close();
						_this.websocket = null;
					}
					self.token = null;
					self.email = null;
					self.password = null;
					self.state = ConnectionState.DISCONNECTED;
					resolve();
				}
			});
		});
	};

	// def getGateway

	InternalClient.prototype.getGateway = function getGateway() {
		var self = this;
		return new Promise(function (resolve, reject) {

			request.get(Endpoints.GATEWAY).set("authorization", self.token).end(function (err, res) {
				if (err) reject(err);else resolve(res.body.url);
			});
		});
	};

	InternalClient.prototype.sendWS = function sendWS(object) {
		this.websocket.send(JSON.stringify(object));
	};

	InternalClient.prototype.createWS = function createWS(url) {
		var self = this;
		var client = self.client;

		if (this.websocket) return false;

		this.websocket = new WebSocket(url);

		this.websocket.onopen = function () {

			self.sendWS({
				op: 2,
				d: {
					token: self.token,
					v: 3,
					compress: self.client.options.compress,
					properties: {
						"$os": "discord.js",
						"$browser": "discord.js",
						"$device": "discord.js",
						"$referrer": "discord.js",
						"$referring_domain": "discord.js"
					}
				}
			});
		};

		this.websocket.onclose = function () {
			self.websocket = null;
			self.state = ConnectionState.DISCONNECTED;
			client.emit("disconnected");
		};

		this.websocket.onmessage = function (e) {

			if (e.type === "Binary") {
				if (!zlib) zlib = require("zlib");
				e.data = zlib.inflateSync(e.data).toString();
			}

			var packet, data;
			try {
				packet = JSON.parse(e.data);
				data = packet.d;
			} catch (e) {
				client.emit("error", e);
				return;
			}

			client.emit("raw", packet);

			switch (packet.t) {

				case PacketType.READY:
					var startTime = Date.now();
					self.users.add(new User(data.user, client));
					data.guilds.forEach(function (server) {
						self.servers.add(new Server(server, client));
					});
					data.private_channels.forEach(function (pm) {
						self.private_channels.add(new PMChannel(pm, client));
					});
					self.state = ConnectionState.READY;

					setInterval(function () {
						return self.sendWS({ op: 1, d: Date.now() });
					}, data.heartbeat_interval);

					client.emit("ready");
					client.emit("debug", "ready packet took " + (Date.now() - startTime) + "ms to process");
					client.emit("debug", "ready with " + self.servers.length + " servers, " + self.channels.length + " channels and " + self.users.length + " users cached.");
					break;

				case PacketType.MESSAGE_CREATE:
					// format: https://discordapi.readthedocs.org/en/latest/reference/channels/messages.html#message-format
					var channel = self.channels.get("id", data.channel_id);
					if (channel) {
						channel.messages.add(new Message(data, channel, client));
					} else {
						client.emit("warn", "message created but channel is not cached");
					}
					break;

			}
		};
	};

	return InternalClient;
})();

module.exports = InternalClient;