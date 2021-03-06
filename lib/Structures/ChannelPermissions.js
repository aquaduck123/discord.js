"use strict";

exports.__esModule = true;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _Constants = require("../Constants");

var ChannelPermissions = (function () {
	function ChannelPermissions(permissions) {
		_classCallCheck(this, ChannelPermissions);

		this.permissions = permissions;
	}

	ChannelPermissions.prototype.serialise = function serialise(explicit) {
		var _this = this;

		var hp = function hp(perm) {
			return _this.hasPermission(perm, explicit);
		};

		var json = {};

		for (var permission in _Constants.Permissions) {
			json[permission] = hp(_Constants.Permissions[permission]);
		}

		return json;
	};

	ChannelPermissions.prototype.serialize = function serialize() {
		// ;n;
		return this.serialise();
	};

	ChannelPermissions.prototype.hasPermission = function hasPermission(perm) {
		var explicit = arguments.length <= 1 || arguments[1] === undefined ? false : arguments[1];

		if (perm instanceof String || typeof perm === "string") {
			perm = _Constants.Permissions[perm];
		}
		if (!perm) {
			return false;
		}
		if (!explicit) {
			// implicit permissions allowed
			if (!!(this.permissions & _Constants.Permissions.manageRoles)) {
				// manageRoles allowed, they have all permissions
				return true;
			}
		}
		return !!(this.permissions & perm);
	};

	return ChannelPermissions;
})();

exports["default"] = ChannelPermissions;
module.exports = exports["default"];
