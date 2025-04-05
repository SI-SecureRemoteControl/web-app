const crypto = require('crypto');

function generateKey(type = 'registration') {
  let digitPool = '';
  while (digitPool.length < 20) {
    const randomByte = crypto.randomBytes(1)[0];
    const digit = randomByte % 10;
    digitPool += digit.toString();
  }
  return type === 'registration' ? digitPool.slice(0, 10) : digitPool.slice(-10);
}

module.exports = {
  generateKey
};