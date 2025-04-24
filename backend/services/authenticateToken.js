const jwt = require('jsonwebtoken'); 

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        console.log('Auth Middleware: No token provided.');
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    jwt.verify(token, process.env.SECRET_KEY, (err, decodedPayload) => {
        if (err) {
            console.error('Auth Middleware: Token verification failed:', err.message);
            return res.status(401).json({ error: 'Invalid or expired token.' });
        }

        req.user = decodedPayload;
        console.log('Auth Middleware: Token verified successfully for user:', req.user?.username);
        next();
    });
}

module.exports = authenticateToken;