const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const postSchema = new Schema(
  {
    creator: {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "User",
    },
    description: { type: String, required: true, maxlength: 100 },
    image: { type: String, required: true },
    hearts: { type: Array, required: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Post", postSchema);
