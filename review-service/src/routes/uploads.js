const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const { v4: uuidv4 } = require("uuid");
const logger = require("../utils/logger");

// Configure multer storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads");
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter for code files
const fileFilter = (req, file, cb) => {
  const allowedExtensions = [
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".py",
    ".java",
    ".go",
    ".rs",
    ".cpp",
    ".c",
    ".h",
    ".cs",
    ".php",
    ".rb",
    ".swift",
    ".kt",
    ".txt",
    ".md",
    ".json",
    ".xml",
  ];

  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${ext}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Upload single file
router.post("/file", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileInfo = {
      id: path.parse(req.file.filename).name,
      filename: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedAt: new Date().toISOString(),
    };

    logger.info(
      `File uploaded: ${req.file.originalname} (${req.file.size} bytes)`
    );

    res.json({
      success: true,
      file: fileInfo,
      message: "File uploaded successfully",
    });
  } catch (error) {
    logger.error("File upload error:", error);
    res.status(500).json({ error: "File upload failed" });
  }
});

// Upload multiple files
router.post("/files", upload.array("files", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const filesInfo = req.files.map((file) => ({
      id: path.parse(file.filename).name,
      filename: file.originalname,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype,
      uploadedAt: new Date().toISOString(),
    }));

    logger.info(`${req.files.length} files uploaded`);

    res.json({
      success: true,
      files: filesInfo,
      count: filesInfo.length,
      message: "Files uploaded successfully",
    });
  } catch (error) {
    logger.error("Multiple files upload error:", error);
    res.status(500).json({ error: "Files upload failed" });
  }
});

// Get file content
router.get("/file/:id", async (req, res) => {
  try {
    const uploadDir = path.join(__dirname, "../../uploads");
    const files = await fs.readdir(uploadDir);
    const file = files.find((f) => f.startsWith(req.params.id));

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const filePath = path.join(uploadDir, file);
    const content = await fs.readFile(filePath, "utf-8");
    const stats = await fs.stat(filePath);

    res.json({
      success: true,
      file: {
        id: req.params.id,
        filename: file,
        content,
        size: stats.size,
        uploadedAt: stats.birthtime,
      },
    });
  } catch (error) {
    logger.error("Get file error:", error);
    res.status(500).json({ error: "Failed to get file" });
  }
});

// Download file
router.get("/download/:id", async (req, res) => {
  try {
    const uploadDir = path.join(__dirname, "../../uploads");
    const files = await fs.readdir(uploadDir);
    const file = files.find((f) => f.startsWith(req.params.id));

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const filePath = path.join(uploadDir, file);
    res.download(filePath);
  } catch (error) {
    logger.error("Download file error:", error);
    res.status(500).json({ error: "Failed to download file" });
  }
});

// Delete file
router.delete("/file/:id", async (req, res) => {
  try {
    const uploadDir = path.join(__dirname, "../../uploads");
    const files = await fs.readdir(uploadDir);
    const file = files.find((f) => f.startsWith(req.params.id));

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const filePath = path.join(uploadDir, file);
    await fs.unlink(filePath);

    logger.info(`File deleted: ${file}`);

    res.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    logger.error("Delete file error:", error);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

// List all files
router.get("/files", async (req, res) => {
  try {
    const uploadDir = path.join(__dirname, "../../uploads");

    try {
      await fs.mkdir(uploadDir, { recursive: true });
    } catch (e) {
      // Directory exists
    }

    const files = await fs.readdir(uploadDir);

    const filesInfo = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(uploadDir, file);
        const stats = await fs.stat(filePath);

        return {
          id: path.parse(file).name,
          filename: file,
          size: stats.size,
          uploadedAt: stats.birthtime,
        };
      })
    );

    res.json({
      success: true,
      files: filesInfo,
      count: filesInfo.length,
    });
  } catch (error) {
    logger.error("List files error:", error);
    res.status(500).json({ error: "Failed to list files" });
  }
});

module.exports = router;
