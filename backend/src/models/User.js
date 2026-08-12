const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['admin', 'lawyer', 'researcher', 'student'];

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never returned by default on find()
    },
    role: {
      type: String,
      enum: ROLES,
      default: 'student',
    },
    avatar: {
      type: String,
      default: '',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    // Hash of the currently-valid refresh token (rotated on every /refresh
    // and cleared on /logout). Storing only the hash means a stolen DB dump
    // can't be replayed as a live session.
    refreshTokenHash: {
      type: String,
      select: false,
      default: null,
    },
    refreshTokenExpiresAt: {
      type: Date,
      select: false,
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Fallback avatar so the UI never has to special-case a missing image.
userSchema.methods.getDisplayAvatar = function getDisplayAvatar() {
  if (this.avatar) return this.avatar;
  const initials = encodeURIComponent(this.fullName || 'User');
  return `https://ui-avatars.com/api/?name=${initials}&background=1F5F4A&color=fff`;
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    fullName: this.fullName,
    email: this.email,
    role: this.role,
    avatar: this.getDisplayAvatar(),
    isVerified: this.isVerified,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.refreshTokenHash;
    delete ret.refreshTokenExpiresAt;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
module.exports.ROLES = ROLES;
