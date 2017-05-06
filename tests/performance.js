var smuggler = require('../index');
var async = require('async');

var requests = [];
for (var i = 0; i < 100000; i++) {
	requests.push(i);
}

var startTime = (new Date()).getTime();
var mw = smuggler();

async.eachLimit(requests, 1, function (num, cb) {
	var res = {
		render: function (view, locals) {
			this.send('view:' + view);
		},
		locals: {},
		json: function (data) {
			this.send(JSON.stringify(data));
		},
		send: function (content) {

		}
	};

	var req = {
		res: res,
		query: {},
		body: {},
		method: 'GET'
	};

	res.req = req;

	async.waterfall([
		function (cb2) {
			mw(req, res, cb2);
		},
		function (cb2) {
			res.on('init', function (cb3) {
				async.setImmediate(function () {
					cb3(null, num);
				});
			}, 'num');

			async.setImmediate(cb2);
		}
	], cb);
}, function (err) {
	console.log('done in ' + ((new Date()).getTime() - startTime) + 'ms');
});


