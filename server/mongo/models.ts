import mongoose, { Schema } from "mongoose";
import type { PortfolioProject } from "../../shared/portfolio";

mongoose.set("bufferCommands", false);
mongoose.set("autoCreate", false);
mongoose.set("autoIndex", false);

const options = {
  strict: "throw" as const,
  timestamps: true,
  versionKey: false as const,
  id: false,
  autoCreate: false,
  autoIndex: false,
};
const projectSchema = new Schema<PortfolioProject>(
  {
    id: { type: String, required: true, unique: true, maxlength: 100 },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    subtitle: { type: String, default: "", maxlength: 200 },
    description: {
      type: String,
      required: true,
      minlength: 10,
      maxlength: 5000,
    },
    category: {
      type: String,
      required: true,
      enum: ["Full-stack", "Web application"],
    },
    year: { type: String, required: true, maxlength: 30 },
    technologies: {
      type: [String],
      required: true,
      validate: (items: string[]) => items.length <= 20,
    },
    status: { type: String, required: true, maxlength: 80 },
    featured: { type: Boolean, required: true },
    published: { type: Boolean, required: true },
    cover: {
      type: String,
      required: true,
      enum: ["delivery", "banking", "portfolio"],
    },
    imageUrl: { type: String, default: "", maxlength: 2048 },
    githubUrl: { type: String, default: "", maxlength: 2048 },
    liveUrl: { type: String, default: "", maxlength: 2048 },
    highlights: {
      type: [String],
      required: true,
      validate: (items: string[]) => items.length <= 12,
    },
    order: {
      type: Number,
      required: true,
      min: 0,
      max: 100000,
      validate: Number.isInteger,
    },
  },
  options
);
projectSchema.index({ published: 1, order: 1, id: 1 });

export interface MessageRecord {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "unread" | "read" | "archived";
  createdAt: Date;
  updatedAt: Date;
}
const messageSchema = new Schema<MessageRecord>(
  {
    id: { type: String, required: true, unique: true, maxlength: 100 },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: { type: String, required: true, trim: true, maxlength: 320 },
    subject: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 160,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 5000,
    },
    status: {
      type: String,
      required: true,
      enum: ["unread", "read", "archived"],
      default: "unread",
    },
  },
  options
);
messageSchema.index({ createdAt: -1, id: 1 });

export interface UserRecord {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
}
const userSchema = new Schema<UserRecord>(
  {
    id: {
      type: Number,
      required: true,
      unique: true,
      validate: Number.isSafeInteger,
    },
    openId: { type: String, required: true, unique: true, maxlength: 256 },
    name: { type: String, default: null, maxlength: 500 },
    email: { type: String, default: null, maxlength: 320 },
    loginMethod: { type: String, default: null, maxlength: 64 },
    role: {
      type: String,
      required: true,
      enum: ["user", "admin"],
      default: "user",
    },
    lastSignedIn: { type: Date, required: true, default: Date.now },
  },
  options
);

const settingsSchema = new Schema(
  {
    _id: { type: String, required: true },
    seededAt: { type: Date, required: true },
    seedCompletedAt: { type: Date, default: null },
  },
  { strict: "throw", versionKey: false, autoCreate: false, autoIndex: false }
);

export const ProjectModel =
  (mongoose.models.PortfolioProject as mongoose.Model<PortfolioProject>) ||
  mongoose.model<PortfolioProject>("PortfolioProject", projectSchema);
export const MessageModel =
  (mongoose.models.ContactMessage as mongoose.Model<MessageRecord>) ||
  mongoose.model<MessageRecord>("ContactMessage", messageSchema);
export const UserModel =
  (mongoose.models.PortfolioUser as mongoose.Model<UserRecord>) ||
  mongoose.model<UserRecord>("PortfolioUser", userSchema);
export const SettingsModel =
  mongoose.models.PortfolioSettings ||
  mongoose.model("PortfolioSettings", settingsSchema);
