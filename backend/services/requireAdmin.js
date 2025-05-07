
function requireAdmin(req, res, next) {
    if (req.user && req.user.username === 'administrator') {
        console.log('Admin Auth: Access granted for administrator.');
        next(); 
    } else {
        res.status(403).json({ error: 'Forbidden: Administrator access required.' });
    }
}
module.exports = requireAdmin;
