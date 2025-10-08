// API entry point for Vercel serverless deployment
const serverless = require('serverless-http');
const app = require('../dist/server.js');

module.exports = serverless(app);