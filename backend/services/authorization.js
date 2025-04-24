const express = require('express');
const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
    const token = req.header('Authorization').slice(7);
    if (!token) return res.status(401).json({ error: 'Access denied' });
    try {
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

module.exports = verifyToken;