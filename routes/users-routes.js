const express = require("express");
const { check } = require("express-validator");

const usersControllers = require("../controllers/users-controllers");
const fileUpload = require("../middleware/file-upload");
const checkAuth = require("../middleware/check-auth");

const router = express.Router();

router.post(
  "/signup",
  fileUpload.single("image"),
  [
    check("name").not().isEmpty(),
    check("email").normalizeEmail().isEmail(),
    check("password").isLength({ min: 6 }),
    check("description").not().isEmpty(),
  ],
  usersControllers.signup
);

router.post("/login", usersControllers.login);

router.use(checkAuth);

router.get("/following/:uid", usersControllers.getFollowersForUser);

router.get("/search", usersControllers.searchUsers);

router.get("/:uid", usersControllers.getUserById);

router.get("/:uid/isfollowed", usersControllers.isFollowed);

router.put("/:uid/follow", usersControllers.followUser);

router.patch(
  "/:uid",
  [check("description").not().isEmpty()],
  usersControllers.editUserInfo
);

module.exports = router;
