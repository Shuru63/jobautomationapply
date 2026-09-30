import fs from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const SCREENSHOT_DIR = path.join(process.cwd(), "public", "screenshots");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Check if Cloudinary is configured
function isCloudinaryConfigured(): boolean {
  return !!(process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET && process.env.CLOUDINARY_CLOUD_NAME);
}

async function saveToCloudinary(
  buffer: Buffer,
  folder: string,
  resourceType: "auto" | "image" | "raw" = "auto"
): Promise<string> {
  try {
    const cloudinary = require("cloudinary").v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, resource_type: resourceType },
        (error: any, result: any) => {
          if (error) reject(error);
          else resolve(result.secure_url);
        }
      );
      const { Readable } = require("stream");
      Readable.from(buffer).pipe(uploadStream);
    });
  } catch (err) {
    console.warn("Cloudinary upload failed, falling back to local storage", err);
    return "";
  }
}

export async function saveFile(
  buffer: Buffer,
  fileName: string,
  subDir: string = "resumes"
): Promise<{ fileUrl: string; filePath: string }> {
  const uniqueName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  if (isCloudinaryConfigured()) {
    const resourceType = (fileName.endsWith(".pdf") || fileName.endsWith(".docx") || fileName.endsWith(".doc")) ? "raw" : "auto";
    const fileUrl = await saveToCloudinary(buffer, subDir, resourceType);
    if (fileUrl) return { fileUrl, filePath: "" };
  }

  // Local storage
  const dir = path.join(UPLOAD_DIR, subDir);
  ensureDir(dir);
  const filePath = path.join(dir, uniqueName);
  fs.writeFileSync(filePath, buffer);
  return { fileUrl: `/uploads/${subDir}/${uniqueName}`, filePath };
}

export async function saveScreenshot(
  buffer: Buffer,
  label: string
): Promise<string> {
  const fileName = `screenshot-${label}-${Date.now()}.png`;

  if (isCloudinaryConfigured()) {
    const fileUrl = await saveToCloudinary(buffer, "screenshots", "image");
    if (fileUrl) return fileUrl;
  }

  ensureDir(SCREENSHOT_DIR);
  const filePath = path.join(SCREENSHOT_DIR, fileName);
  fs.writeFileSync(filePath, buffer);
  return `/screenshots/${fileName}`;
}

export function getAbsolutePath(relativePath: string): string {
  return path.join(process.cwd(), "public", relativePath);
}

export function deleteFile(relativePath: string): boolean {
  try {
    const fullPath = path.join(process.cwd(), "public", relativePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
  } catch {
    // Ignore errors
  }
  return false;
}