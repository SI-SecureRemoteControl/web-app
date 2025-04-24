
function requireAdmin(req, res, next) {
    if (req.user && req.user.username === 'administrator') {
        console.log('Admin Auth Middleware: Access granted for administrator.');
        next(); 
    } else {
        console.warn('Admin Auth Middleware: Access denied. User is not administrator or user data missing. User:', req.user?.username);
        res.status(403).json({ error: 'Forbidden: Administrator access required.' });
    }
}
module.exports = requireAdmin;
