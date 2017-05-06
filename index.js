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

		res.on = function (on) {
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

			if (typeof on == 'function') {
				if (on()) {
					res.smuggler.events.action.push(fn);
				}
			} else if (_.isObject(on)) {
				if (checkConditions(on, req)) {
					res.smuggler.events.action.push(fn);
				}
			} else if (on == 'get' || on == 'post' || on == 'put' || on == 'delete') {
				if (req.method.toLowerCase() != on) {
					return this;
				}

				if (args.length >= 3) {
					callback = args[2];

					var conditions = {};
					if (typeof args[1] == 'string') {
						conditions[args[1]] = true;
					} else {
						conditions = args[1];
					}

					var context = (on == 'post' || on == 'put') ? req.body : req.query;

					if (!checkConditions(conditions, context)) {
						return this;
					}
				}

				res.smuggler.events.action.push(fn);
			} else if (on == 'init' || on == 'render' || on == 'send' || on == 'error') {
				res.smuggler.events[on].push(fn);
			}

			return this;
		};

		var originalRender = res.render.bind(res);
		res.render = function (view, callback) {
			if (typeof view == 'function') {
				callback = view;
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

				if (!req.isJson && res.data.redirect) {
					res.redirect(res.data.redirect);
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

		next();
	};
};

Smuggler.asJson = function (req, res, next) {
	res.type('json');
	req.isJson = true;

	next();
};

Smuggler.asJsonIfAccepts = function (req, res, next) {
	if (req.headers.accept && req.headers.accept.indexOf('application/json') > -1) {
		return Smuggler.asJson(req, res, next);
	}

	next();
};

module.exports = Smuggler;
