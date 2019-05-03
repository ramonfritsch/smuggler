# Smuggler
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Framonfritsch%2Fsmuggler.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Framonfritsch%2Fsmuggler?ref=badge_shield)


> An expressjs middleware to handle with responses in an elegant way

This library is heavily inspired by [KeystoneJS's View class](https://github.com/keystonejs/keystone/blob/master/lib/view.js).

If you often find yourself struggling with callbacks and middlewares on your routes, this is for you. Smuggler is all about providing a simple api for asyncronous responses.


## Getting started

```
npm install smuggler --save
```

```js
var express = require('express');
var smuggler = require('smuggler');

var app = express();

app.use(smuggler());

...
```


## Example

```js
app.get('/', function (req, res, next) {
	res.on('init', function (cb) {
		cb(null, new Date().getTime());
	}, 'time');

	res.on('get', 'full', function (cb) {
		cb(null, {
			name: 'John',
			email: 'jonny@example.com'
		})
	}, 'fullInfo');

	res.render('index', next);
});
```

---

To be improved...

## License
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Framonfritsch%2Fsmuggler.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Framonfritsch%2Fsmuggler?ref=badge_large)