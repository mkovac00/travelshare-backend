const { validationResult } = require("express-validator");
const { default: mongoose } = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const HttpError = require("../models/http-error");
const post = require("../models/post");
const User = require("../models/user");
const { create } = require("../models/post");

const getFollowersForUser = async (req, res, next) => {
  const userId = req.params.uid;

  let currentUserIsFollowing;
  try {
    currentUserIsFollowing = await User.findById(userId).select("following");
  } catch (err) {
    const error = new HttpError(
      "Fetching people who the user follows failed, please try again.",
      500
    );
    return next(error);
  }

  if (
    !currentUserIsFollowing.following ||
    currentUserIsFollowing.following.length === 0
  ) {
    return next(new HttpError("This user does not follow anyone.", 404));
  }

  let users = [];
  for (let i = 0; i < currentUserIsFollowing.following.length; i++) {
    users[i] = await User.findById(currentUserIsFollowing.following[i]);
  }

  res.json({
    following: users.map((user) => user.toObject({ getters: true })),
  });
};

const signup = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpError("Invalid input data, please try again.", 422));
  }

  const { name, email, password, description } = req.body;

  let existingUser;
  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError("Signing up failed, please try again.", 500);
    return next(error);
  }

  if (existingUser) {
    const error = new HttpError(
      "User already exists, please login instead.",
      422
    );
    return next(error);
  }

  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(password, 12);
  } catch (err) {
    const error = new HttpError(
      "Couldn't hash the password, please try again.",
      500
    );
    return next(error);
  }

  const createdUser = new User({
    name: name,
    email: email,
    password: hashedPassword,
    profilePicture: req.file.path,
    coverPicture:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Tilisunah%C3%BCtte_Panorama.jpg/640px-Tilisunah%C3%BCtte_Panorama.jpg",
    followers: [],
    following: [],
    description: description,
    posts: [],
  });

  try {
    await createdUser.save();
  } catch (err) {
    const error = new HttpError("Signing up failed, please try again.", 500);
    return next(error);
  }

  let token;
  try {
    token = jwt.sign(
      { userId: createdUser.id, email: createdUser.email },
      "travelshare_secret_key_1",
      { expiresIn: "1h" }
    );
  } catch (err) {
    const error = new HttpError("Signing up failed, please try again.", 500);
    return next(error);
  }

  res
    .status(201)
    .json({ userId: createdUser.id, email: createdUser.email, token: token });
};

const login = async (req, res, next) => {
  const { email, password } = req.body;

  let existingUser;
  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError("Logging in failed, please try again.", 500);
    return next(error);
  }

  if (!existingUser) {
    const error = new HttpError("Invalid credentials, couldn't login.", 401);
    return next(error);
  }

  let isValidPassword = false;
  try {
    isValidPassword = await bcrypt.compare(password, existingUser.password);
  } catch (err) {
    const error = new HttpError("Could not log in, please try again.", 500);
    return next(error);
  }

  if (!isValidPassword) {
    const error = new HttpError("Could not log in, please try again.", 500);
    return next(error);
  }

  let token;
  try {
    token = jwt.sign(
      { userId: existingUser.id, email: existingUser.email },
      "travelshare_secret_key_1",
      { expiresIn: "1h" }
    );
  } catch (err) {
    const error = new HttpError("Logging in failed, please try again.", 500);
    return next(error);
  }

  res.json({
    userId: existingUser.id,
    email: existingUser.email,
    token: token,
  });
};

const followUser = async (req, res, next) => {
  const followedUserId = req.params.uid;
  const currentUserId = req.body.userId;

  let currentUser;
  let followedUser;
  try {
    currentUser = await User.findById(currentUserId);
    followedUser = await User.findById(followedUserId);
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not fetch the user.",
      500
    );
    return next(error);
  }

  if (!currentUser || !followedUser) {
    const error = new HttpError(
      "Couldn't find a user for the provided id.",
      404
    );
    return next(error);
  }

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    if (!followedUser.followers.includes(currentUserId)) {
      followedUser.followers.push(currentUserId);
      currentUser.following.push(followedUserId);
    } else {
      followedUser.followers.pull(currentUserId);
      currentUser.following.pull(followedUserId);
    }
    await followedUser.save({ session: sess });
    await currentUser.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not follow the user.",
      404
    );
    return next(error);
  }

  res.status(201).json({ followers: followedUser.followers });
};

const searchUsers = async (req, res, next) => {
  const searchInput = req.query.name;

  let searchResult;
  try {
    searchResult = await User.find({ name: searchInput });
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not fetch searched users.",
      500
    );
    return next(error);
  }

  if (!searchResult) {
    const error = new HttpError(
      "Couldn't find a user for the provided name.",
      404
    );
    return next(error);
  }

  res.status(201).json({
    users: searchResult.map((user) => user.toObject({ getters: true })),
  });
};

const getUserById = async (req, res, next) => {
  const userId = req.params.uid;

  let user;
  try {
    user = await User.findById(userId);
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not find a user with this id.",
      500
    );
    return next(error);
  }

  if (!user) {
    const error = new HttpError(
      "Could not find a user for the provided id.",
      500
    );
    return next(error);
  }

  res.json({ user: user.toObject({ getters: true }) });
};

const editUserInfo = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors);
    return next(new HttpError("Invalid input passed, please try again.", 422));
  }

  const { description } = req.body;
  const userId = req.params.uid;

  let user;
  try {
    user = await User.findById(userId);
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, couldn't update user info.",
      500
    );
    return next(error);
  }

  if (userId !== req.userData.userId) {
    const error = new HttpError(
      "Not authorized to edit this users info.",
      401
    );
    return next(error);
  }

  user.description = description;

  try {
    await user.save();
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, couldn't update user info.",
      500
    );
    return next(error);
  }

  res.status(200).json({ user: user.toObject({ getters: true }) });
};

const isFollowed = async (req, res, next) => {
  const followedUserId = req.params.uid;
  const currentUserId = req.query.userId;
  let returnValue;

  let currentUser;
  let followedUser;
  try {
    currentUser = await User.findById(currentUserId);
    followedUser = await User.findById(followedUserId);
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not fetch the user.",
      500
    );
    return next(error);
  }

  if (!currentUser || !followedUser) {
    const error = new HttpError(
      "Couldn't find a user for the provided id.",
      404
    );
    return next(error);
  }

  if (!followedUser.followers.includes(currentUserId)) {
    returnValue = false;
  } else {
    returnValue = true;
  }

  res.status(201).json({ isFollowed: returnValue });
};

exports.getFollowersForUser = getFollowersForUser;
exports.signup = signup;
exports.login = login;
exports.followUser = followUser;
exports.searchUsers = searchUsers;
exports.getUserById = getUserById;
exports.editUserInfo = editUserInfo;
exports.isFollowed = isFollowed;
