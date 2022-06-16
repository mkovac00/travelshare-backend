const express = require("express");
const { check } = require("express-validator");

const postsControllers = require("../controllers/posts-controllers");
const fileUpload = require("../middleware/file-upload");
const checkAuth = require("../middleware/check-auth");

const router = express.Router();

router.use(checkAuth);

router.get("/:pid", postsControllers.getPostById);

router.get("/user/:uid", postsControllers.getPostsForUserId);

router.get("/user/timeline/:uid", postsControllers.getPostsFromFollowing);

router.get("/:pid/ishearted", postsControllers.isHearted);

router.put("/:pid/heart", postsControllers.heartPost);

router.post(
  "/",
  fileUpload.single("image"),
  check("description").not().isEmpty(),
  postsControllers.createPost
);

router.delete("/:pid", postsControllers.deletePost);

module.exports = router;
