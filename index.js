var _ = require('lodash');
var async = require('async');

function runEvents(queue, callback) {
	async.eachSeries(queue, function (fn, cb) {
		if (Array.isArray(fn)) {
			async.parallel(fn, cb);
		} else if (typeof fn === 'function') {
			fn(cb);
		} else {
			throw new Error('Events must be functions.');
		}
	}, callback);
}

function checkConditions(conditions, context) {
	return _.every(conditions, function (value, path) {
		var contextValue = _.get(context, path);
		return (value === true && contextValue) ? true : (contextValue === value);
	});
};

var Smuggler = function () {
	return function (req, res, next) {
		if (res.smuggler) {
			return next();
		}

		res.smuggler = {
			events: {
				init: [],
				query: [],
				action: [],
				render: [],
				send: [],
				error: []
			}
		};

		res.on = function (type) {
			var args = _.toArray(arguments);
			var callback = args[1];
			var fn;

			if (typeof args[args.length - 1] == 'string') {
				var key = args[args.length - 1];

				fn = function (cb) {
					callback(function (err, results) {
						if (!err && results) {
							_.set(res.data, key, results);
						}

						cb(err);
					});
				};

				args.pop();
			} else {
				fn = function (cb) {
					callback(cb);
				};
			}

			if (typeof type == 'function') {
				if (type()) {
					res.smuggler.events.action.push(fn);
				}
			} else if (_.isObject(type)) {
				if (checkConditions(type, req)) {
					res.smuggler.events.action.push(fn);
				}
			} else if (type == 'get' || type == 'post' || type == 'put' || type == 'delete') {
				if (req.method.toLowerCase() != type) {
					return res;
				}

				if (args.length >= 3) {
					callback = args[2];

					var conditions = {};
					if (typeof args[1] == 'string') {
						conditions[args[1]] = true;
					} else {
						conditions = args[1];
					}

					var context = (type == 'post' || type == 'put') ? req.body : req.query;

					if (!checkConditions(conditions, context)) {
						return res;
					}
				}

				res.smuggler.events.action.push(fn);
			} else if (type == 'init' || type == 'render' || type == 'send' || type == 'error') {
				res.smuggler.events[type].push(fn);
			}

			return res;
		};

		var originalRedirect = res.redirect.bind(res);
		res.redirect = function (targetURL, next) {
			res.data.redirect = targetURL;

			return res._render(null, next);
		};

		var originalRender = res.render.bind(res);
		res.render = function (view, callback) {
			if (typeof view == 'function') {
				callback = view;
				view = null;
			}

			var queue = res.smuggler.events.init.concat(res.smuggler.events.query).concat(res.smuggler.events.action);
			queue.push(res.smuggler.events.render);

			runEvents(queue, function (err) {
				if (err && err != 'ignore') {
					runEvents(res.smuggler.events.error, function (err2) {
						callback(err2 || err);
					});

					return;
				}

				res._render(view, callback);
			});
		};

		var originalSend = res.send.bind(res);
		res.send = function () {
			var args = arguments;

			runEvents(res.smuggler.events.send, function (err) {
				if (err) {
					throw err;
				}

				originalSend.apply(res, args);
			});
		};

		res._render = function (view, callback) {
			if (!req.isJson && res.data.redirect) {
				originalRedirect(res.data.redirect);
			} else if (!req.isJson && typeof view == 'string') {
				res.locals = _.extend(res.locals, res.data);

				if (res.layout) {
					res.locals.layout = res.layout;
				}

				originalRender(view, res.locals);
			} else {
				res.data = _.extend({
					success: true
				}, res.data);

				res.json(res.data);
			}
		}

		next();
	};
};

Smuggler.asJson = function (req, res, next) {
	res.type('json');
	req.isJson = true;

	next();
};

Smuggler.asJsonIfAccepts = function (req, res, next) {
	var accept = req.get('accept');
	if (accept && accept.indexOf('application/json') > -1) {
		return Smuggler.asJson(req, res, next);
	}

	next();
};

module.exports = Smuggler;
