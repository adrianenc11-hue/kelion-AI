// health-check.js — Redirects to health.js (consolidated)
// Both endpoints now return the same comprehensive health check

const main = require('./health');
exports.handler = main.handler;
