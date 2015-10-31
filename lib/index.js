"use strict";

module.exports = {
	Client: require("./Client/Client.js")
};

var a = new module.exports.Client();
a.on("debug", function (m) {
	return console.log("[debug]", m);
});
a.login(process.env["discordEmail"], process.env["discordPass"])["catch"](function (e) {
	return console.log(e);
});