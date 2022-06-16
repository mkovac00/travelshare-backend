const fs = require("fs");

const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

const HttpError = require("../models/http-error");
const Post = require("../models/post");
const User = require("../models/user");

const getPostById = async (req, res, next) => {
  const postId = req.params.pid;

  let post;
  try {
    post = await Post.findById(postId);
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not find a post with this id.",
      500
    );
    return next(error);
  }

  if (!post) {
    const error = new HttpError(
      "Could not find a post for the provided id.",
      404
    );
    return next(error);
  }

  res.json({ post: post.toObject({ getters: true }) });
};

const getPostsForUserId = async (req, res, next) => {
  const userId = req.params.uid;

  let posts;
  let user;
  let users = [];
  try {
    posts = await Post.find({ creator: userId });
    user = await User.findById(userId);
    for (let i = 0; i < posts.length; i++) {
      users.push(user);
    }
  } catch (err) {
    const error = new HttpError(
      "Fetching posts failed, please try again.",
      500
    );
    return next(error);
  }

  if (!posts || posts.length === 0) {
    return next(
      new HttpError("Could not find any posts for the provided user id.", 404)
    );
  }

  res.json({
    posts: posts.map((post) => post.toObject({ getters: true })),
    user: users.map((user) => user.toObject({ getters: true })),
  });
};

const getPostsFromFollowing = async (req, res, next) => {
  const userId = req.params.uid;

  let currentUser;
  try {
    currentUser = await User.findById(userId);
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not find a user for the provided id.",
      500
    );
    return next(error);
  }

  const peopleThatUserIsFollowing = currentUser.following;

  if (!peopleThatUserIsFollowing || peopleThatUserIsFollowing.length === 0) {
    return next(new HttpError("This user does not follow anyone.", 404));
  }

  let postsFromPeopleThatUserIsFollowing = [];

  for (let i = 0; i < peopleThatUserIsFollowing.length; i++) {
    try {
      const followedUser = await User.findById(peopleThatUserIsFollowing[i]);
      for (let k = 0; k < followedUser.posts.length; k++) {
        postsFromPeopleThatUserIsFollowing.push(followedUser.posts[k]);
      }
    } catch (err) {
      const error = new HttpError(
        "Something went wrong when retrieving the timeline, please try again.",
        500
      );
      return next(error);
    }
  }

  if (
    !postsFromPeopleThatUserIsFollowing ||
    postsFromPeopleThatUserIsFollowing.length === 0
  ) {
    return next(new HttpError("None of the users followed have any posts."));
  }

  let infoFromPeopleThatUserIsFollowing = [];

  let posts = [];
  for (let i = 0; i < postsFromPeopleThatUserIsFollowing.length; i++) {
    posts[i] = await Post.findById(postsFromPeopleThatUserIsFollowing[i]);
    infoFromPeopleThatUserIsFollowing[i] = await User.findById(
      posts[i].creator
    );
  }

  res.status(201).json({
    posts: posts.map((post) => post.toObject({ getters: true })),
    users: infoFromPeopleThatUserIsFollowing.map((user) =>
      user.toObject({ getters: true })
    ),
  });
};

const createPost = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpError("Invalid input data, please try again.", 422));
  }

  const { description } = req.body;

  const createdPost = new Post({
    creator: req.userData.userId,
    description: description,
    image: req.file.path,
    hearts: [],
  });

  let user;
  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    const error = new HttpError(
      "Finding a user for the provided id failed, please try again.",
      500
    );
    return next(error);
  }

  if (!user) {
    const error = new HttpError("Couldn't find user for the provided id.", 404);
    return next(error);
  }

  try {
    // The code below does not work with the latest
    // mongoose-unique-validator, hence the usage of
    // the 2.0.3 version, which is where it does work
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await createdPost.save({ session: sess });
    user.posts.push(createdPost);
    await user.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      "Creating a post failed, please try again.",
      500
    );
    return next(error);
  }

  res.status(201).json({ post: createdPost });
};

const deletePost = async (req, res, next) => {
  const postId = req.params.pid;

  let post;
  try {
    post = await Post.findById(postId).populate("creator");
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not delete the post.",
      500
    );
    return next(error);
  }

  if (!post) {
    const error = new HttpError(
      "Couldn't find a post for the provided id.",
      404
    );
    return next(error);
  }

  if (post.creator.id !== req.userData.userId) {
    const error = new HttpError(
      "Not authorized to delete this post.",
      401
    );
    return next(error);
  }

  const imagePath = post.image;

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await post.remove({ session: sess });
    post.creator.posts.pull(post);
    await post.creator.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not delete the post.",
      500
    );
    return next(error);
  }

  fs.unlink(imagePath, err => {
    console.log(err);
  });

  res.status(200).json({ message: "The post has been deleted." });
};

const heartPost = async (req, res, next) => {
  const postId = req.params.pid;
  const user = req.body.userId;

  let post;
  try {
    post = await Post.findById(postId);
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not fetch the post.",
      500
    );
    return next(error);
  }

  if (!post) {
    const error = new HttpError(
      "Couldn't find a post for the provided id.",
      404
    );
    return next(error);
  }

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    if (!post.hearts.includes(user)) {
      post.hearts.push(user);
    } else {
      post.hearts.pull(user);
    }
    await post.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not heart the post.",
      404
    );
    return next(error);
  }

  res.status(201).json({ hearts: post.hearts });
};

const isHearted = async (req, res, next) => {
  const postId = req.params.pid;
  const user = req.query.userId;
  let returnValue;

  let post;
  try {
    post = await Post.findById(postId);
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not fetch the post.",
      500
    );
    return next(error);
  }

  if (!post) {
    const error = new HttpError(
      "Couldn't find a post for the provided id.",
      404
    );
    return next(error);
  }

    if (!post.hearts.includes(user)) {
      returnValue = false;
    } else {
      returnValue = true;
    }
  
  res.status(201).json({ isHearted: returnValue });
}

exports.getPostById = getPostById;
exports.getPostsForUserId = getPostsForUserId;
exports.createPost = createPost;
exports.deletePost = deletePost;
exports.getPostsFromFollowing = getPostsFromFollowing;
exports.heartPost = heartPost;
exports.isHearted = isHearted;
