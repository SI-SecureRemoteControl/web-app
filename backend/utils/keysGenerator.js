const crypto = require('crypto');

function generateRegistrationKey() {
  return crypto.randomBytes(50).toString('hex').slice(0, 10).toUpperCase();
}

function generateDeregistrationKey() {
  return crypto.randomBytes(50).toString('hex').slice(-10).toUpperCase();
}

module.exports = {
  generateRegistrationKey,
  generateDeregistrationKey
};