const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../config/db');
const { ObjectId } = require('mongodb');
const { logAudit } = require('../services/auditService');

const JWT_SECRET = process.env.JWT_SECRET || 'al_anwar_jwt_secret_default_2026';

async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required.'
      });
    }

    const db = getDb();
    const user = await db.collection('users').findOne({
      $or: [
        { username: username.trim().toLowerCase() },
        { email: username.trim().toLowerCase() }
      ]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.'
      });
    }

    if (user.active === false) {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated. Please contact the administrator.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.'
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
        fullName: user.fullName
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Update last login
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date() } }
    );

    await logAudit({
      userId: user._id,
      username: user.username,
      action: 'LOGIN',
      entity: 'users',
      entityId: user._id,
      details: { role: user.role },
      ip: req.ip
    });

    const { password: pwd, ...safeUser } = user;
    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: safeUser
    });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    res.json({
      success: true,
      user: req.user
    });
  } catch (err) {
    next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const db = getDb();
    const users = await db.collection('users')
      .find({}, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      users
    });
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const { username, fullName, email, password, role } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Username, password and role are required.'
      });
    }

    const db = getDb();
    const cleanUsername = username.trim().toLowerCase();

    const existing = await db.collection('users').findOne({ username: cleanUsername });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A user with this username already exists.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      username: cleanUsername,
      fullName: fullName || cleanUsername,
      email: email ? email.trim().toLowerCase() : null,
      password: hashedPassword,
      role,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('users').insertOne(newUser);

    await logAudit({
      userId: req.user._id,
      username: req.user.username,
      action: 'CREATE_USER',
      entity: 'users',
      entityId: result.insertedId,
      details: { newUsername: cleanUsername, role }
    });

    const { password: pwd, ...safeUser } = newUser;
    safeUser._id = result.insertedId;

    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      user: safeUser
    });
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const { fullName, role, active, password } = req.body;
    const db = getDb();

    const updates = { updatedAt: new Date() };
    if (fullName !== undefined) updates.fullName = fullName;
    if (role !== undefined) updates.role = role;
    if (active !== undefined) updates.active = Boolean(active);

    if (password && password.trim()) {
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(password.trim(), salt);
    }

    await db.collection('users').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    await logAudit({
      userId: req.user._id,
      username: req.user.username,
      action: 'UPDATE_USER',
      entity: 'users',
      entityId: id,
      details: { updates: Object.keys(updates) }
    });

    res.json({
      success: true,
      message: 'User updated successfully.'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  getMe,
  listUsers,
  createUser,
  updateUser
};
