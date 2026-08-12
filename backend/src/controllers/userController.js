const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');

// PUT /api/users/profile
const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, avatar } = req.body;

  if (fullName !== undefined) req.user.fullName = fullName;
  if (avatar !== undefined) req.user.avatar = avatar;

  await req.user.save();

  return new ApiResponse(200, 'Profile updated successfully', { user: req.user.toSafeJSON() }).send(res);
});

module.exports = { updateProfile };
