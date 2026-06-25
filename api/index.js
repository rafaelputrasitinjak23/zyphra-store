const { assertRuntimeConfig } = require('../config/env');
assertRuntimeConfig();
module.exports = require('../app');
