const multer = require("multer");
const { v1: uuidv1 } = require("uuid");

const MIME_TYPE_MAP = {
    "image/png": "png",
    "image/jpeg": "jpeg",
    "image/jpg": "jpg",
}

const fileUpload = multer({
    limits: 500000,
    storage: multer.diskStorage({
        // Here is where we change the destination of where images are stored
        destination: (req, file, cb) => {
            cb(null, "uploads/images");
        },
        filename: (req, file, cb) => {
            const ext = MIME_TYPE_MAP[file.mimetype]
            cb(null, uuidv1() + "." + ext);
        }
    }),
    fileFilter: (req, file, cb) => {
        const isValid = !!MIME_TYPE_MAP[file.mimetype];
        let error = isValid ? null : new Error("Invalid image type.");
        cb(error, isValid);
    }
});

module.exports = fileUpload;
