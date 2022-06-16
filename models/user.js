const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, minlength: 6 },
    profilePicture: { type: String, required: true },
    coverPicture: { type: String, required: true },
    followers: { type: Array, required: true },
    following: { type: Array, required: true },
    description: { type: String, required: true, maxlength: 100 },
    posts: [
      { type: mongoose.Types.ObjectId, required: true, ref: "Post" },
    ],
  },
  {
    timestamps: true,
  }
);

userSchema.plugin(uniqueValidator);

module.exports = mongoose.model("User", userSchema);
