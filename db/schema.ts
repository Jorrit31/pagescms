import {
  pgTable,
  text,
  integer,
  bigint,
  boolean,
  serial,
  timestamp,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const userTable = pgTable("user", {
  id: text("id").notNull().primaryKey(),
  name: text("name").notNull(),
  image: text("image"),
  githubUsername: text("github_username"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

const sessionTable = pgTable("session", {
  id: text("id").notNull().primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => userTable.id, { onDelete: "cascade" })
}, table => ({
  idx_session_userId: index("idx_session_userId").on(table.userId)
}));

const accountTable = pgTable("account", {
  id: text("id").notNull().primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => userTable.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
}, table => ({
  idx_account_userId: index("idx_account_userId").on(table.userId),
  idx_account_providerId: index("idx_account_providerId").on(table.providerId)
}));

const verificationTable = pgTable("verification", {
  id: text("id").notNull().primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
}, table => ({
  idx_verification_identifier: index("idx_verification_identifier").on(table.identifier)
}));

const githubInstallationTokenTable = pgTable("github_installation_token", {
  id: serial("id").primaryKey(),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  installationId: integer("installation_id").notNull(),
  expiresAt: timestamp("expires_at").notNull()
}, table => ({
  uq_github_installation_token_installationId: uniqueIndex("uq_github_installation_token_installationId").on(table.installationId)
}));

const collaboratorTable = pgTable("collaborator", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  installationId: integer("installation_id").notNull(),
  ownerId: integer("owner_id").notNull(),
  repoId: integer("repo_id"),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  branch: text("branch"),
  email: text("email").notNull(),
  userId: text("user_id").references(() => userTable.id),
  invitedBy: text("invited_by").references(() => userTable.id),
  // JSON list of content names (from .pages.yml) this person may edit.
  // Empty (null) means everything.
  permissions: text("permissions")
}, table => ({
  idx_collaborator_owner_repo_email: index("idx_collaborator_owner_repo_email").on(table.owner, table.repo, table.email),
  idx_collaborator_userId: index("idx_collaborator_userId").on(table.userId),
  uq_collaborator_owner_repo_email_ci: uniqueIndex("uq_collaborator_owner_repo_email_ci").on(
    sql`lower(${table.owner})`,
    sql`lower(${table.repo})`,
    sql`lower(${table.email})`,
  ),
}));

const collaboratorInviteTable = pgTable("collaborator_invite", {
  id: serial("id").primaryKey(),
  token: text("token").notNull(),
  email: text("email").notNull(),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
}, table => ({
  uq_collaborator_invite_token: uniqueIndex("uq_collaborator_invite_token").on(table.token),
  idx_collaborator_invite_owner_repo_email: index("idx_collaborator_invite_owner_repo_email").on(table.owner, table.repo, table.email),
  uq_collaborator_invite_owner_repo_email_ci: uniqueIndex("uq_collaborator_invite_owner_repo_email_ci").on(
    sql`lower(${table.owner})`,
    sql`lower(${table.repo})`,
    sql`lower(${table.email})`,
  ),
}));

const configTable = pgTable("config", {
  id: serial("id").primaryKey(),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  branch: text("branch").notNull(),
  sha: text("sha").notNull(),
  version: text("version").notNull(),
  object: text("object").notNull(),
  lastCheckedAt: timestamp("last_checked_at").notNull().defaultNow()
}, table => ({
  idx_config_owner_repo_branch: uniqueIndex("idx_config_owner_repo_branch").on(table.owner, table.repo, table.branch)
}));

const cacheFileTable = pgTable("cache_file", {
  id: serial("id").primaryKey(),
  context: text("context").notNull().default('collection'),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  branch: text("branch").notNull(),
  parentPath: text("parent_path").notNull(),
  name: text("name").notNull(),
  path: text("path").notNull(),
  type: text("type").notNull(),
  content: text("content"),
  sha: text("sha"),
  size: integer("size"),
  downloadUrl: text("download_url"),
  commitSha: text('commit_sha'),
  commitTimestamp: timestamp('commit_timestamp'),
  updatedAt: timestamp("updated_at").notNull()
}, table => ({
  idx_cache_file_owner_repo_branch_parentPath: index("idx_cache_file_owner_repo_branch_parentPath").on(table.owner, table.repo, table.branch, table.parentPath),
  idx_cache_file_owner_repo_branch_path: uniqueIndex("idx_cache_file_owner_repo_branch_path").on(table.owner, table.repo, table.branch, table.path)
}));

const cacheFileMetaTable = pgTable("cache_file_meta", {
  id: serial("id").primaryKey(),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  branch: text("branch").notNull(),
  path: text("path").notNull().default(""),
  context: text("context").notNull().default("branch"),
  commitSha: text("commit_sha"),
  commitTimestamp: timestamp("commit_timestamp"),
  status: text("status").notNull().default("ok"),
  error: text("error"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastCheckedAt: timestamp("last_checked_at").notNull().defaultNow(),
}, table => ({
  idx_cache_file_meta_owner_repo_branch_path_context: uniqueIndex("idx_cache_file_meta_owner_repo_branch_path_context").on(table.owner, table.repo, table.branch, table.path, table.context)
}));

const cachePermissionTable = pgTable("cache_permission", {
  id: serial("id").primaryKey(),
  githubId: integer("github_id").notNull(),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  lastUpdated: timestamp("last_updated").notNull()
}, table => ({
  idx_cache_permission_githubId_owner_repo: uniqueIndex("idx_cache_permission_githubId_owner_repo").on(table.githubId, table.owner, table.repo)
}));

const actionRunTable = pgTable("action_run", {
  id: serial("id").primaryKey(),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  ref: text("ref").notNull(),
  workflowRef: text("workflow_ref").notNull(),
  sha: text("sha").notNull(),
  actionName: text("action_name").notNull(),
  contextType: text("context_type").notNull(),
  contextName: text("context_name"),
  contextPath: text("context_path"),
  workflow: text("workflow").notNull(),
  workflowRunId: bigint("workflow_run_id", { mode: "number" }),
  status: text("status").notNull(),
  conclusion: text("conclusion"),
  htmlUrl: text("html_url"),
  triggeredBy: jsonb("triggered_by").notNull(),
  failure: jsonb("failure"),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, table => ({
  idx_action_run_owner_repo_createdAt: index("idx_action_run_owner_repo_createdAt").on(table.owner, table.repo, table.createdAt),
  idx_action_run_owner_repo_actionName: index("idx_action_run_owner_repo_actionName").on(table.owner, table.repo, table.actionName),
  idx_action_run_owner_repo_status: index("idx_action_run_owner_repo_status").on(table.owner, table.repo, table.status),
  idx_action_run_context: index("idx_action_run_context").on(table.owner, table.repo, table.contextType, table.contextName, table.contextPath),
  idx_action_run_workflowRunId: uniqueIndex("idx_action_run_workflowRunId").on(table.workflowRunId),
}));

const appSettingTable = pgTable("app_setting", {
  key: text("key").primaryKey(),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Webstudio: messages sent with a form on a client's website (contact form etc.).
const formSubmissionTable = pgTable("form_submission", {
  id: serial("id").primaryKey(),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  form: text("form").notNull(),
  // [{ name, label, value }] in the order of the form.
  fields: jsonb("fields").notNull(),
  email: text("email"),
  page: text("page"),
  ipHash: text("ip_hash"),
  mailed: boolean("mailed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  readAt: timestamp("read_at"),
}, table => ({
  idx_form_submission_owner_repo_createdAt: index("idx_form_submission_owner_repo_createdAt").on(
    sql`lower(${table.owner})`,
    sql`lower(${table.repo})`,
    table.createdAt,
  ),
}));

// Webstudio: settings per client website that live in the CMS, not in the repo
// (so Jorrit can set them on the Medewerkers page). data = { forms: { <name>: { to, subject } } }.
const siteSettingTable = pgTable("site_setting", {
  id: serial("id").primaryKey(),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  uq_site_setting_owner_repo_ci: uniqueIndex("uq_site_setting_owner_repo_ci").on(
    sql`lower(${table.owner})`,
    sql`lower(${table.repo})`,
  ),
}));

// Webstudio: visits on clients' websites, without cookies. `visitor` is a hash
// of IP + browser that changes every day, so nobody can be followed over days.
const pageViewTable = pgTable("page_view", {
  id: serial("id").primaryKey(),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  path: text("path").notNull(),
  // Host of the site someone came from (google.com, instagram.com), or null.
  source: text("source"),
  // "mobiel" | "tablet" | "computer"
  device: text("device").notNull(),
  visitor: text("visitor").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => ({
  idx_page_view_owner_repo_createdAt: index("idx_page_view_owner_repo_createdAt").on(
    sql`lower(${table.owner})`,
    sql`lower(${table.repo})`,
    table.createdAt,
  ),
}));

// Webstudio: page views summed per day, so we don't keep every single visit.
// After about a week the visits of a day are added up here and then deleted.
// kind "total": all visits of the day (label ""), "page": per path (views),
// "source": per site someone came from ("" = direct), "device": per device.
// `visitors` counts different visitors that day (for "page" it stays 0).
const pageViewDayTable = pgTable("page_view_day", {
  id: serial("id").primaryKey(),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  // Day in Dutch time, "2026-11-18".
  day: text("day").notNull(),
  kind: text("kind").notNull(),
  label: text("label").notNull(),
  views: integer("views").notNull().default(0),
  visitors: integer("visitors").notNull().default(0),
}, table => ({
  idx_page_view_day_unique: uniqueIndex("idx_page_view_day_unique").on(
    table.owner,
    table.repo,
    table.day,
    table.kind,
    table.label,
  ),
  idx_page_view_day_site: index("idx_page_view_day_site").on(
    sql`lower(${table.owner})`,
    sql`lower(${table.repo})`,
    table.day,
  ),
}));

// Webstudio: who changed what, when ("Logboek"). One row per save, delete,
// rename or "Zet online" done in the CMS, in words a client understands.
const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  branch: text("branch").notNull(),
  userId: text("user_id"),
  userName: text("user_name"),
  userEmail: text("user_email"),
  // "create" | "update" | "delete" | "rename" | "upload" | "publish" | "settings"
  action: text("action").notNull(),
  // Label of the content type ("Openingstijden"), or null for publish/settings.
  label: text("label"),
  // Title or file name of the entry ("Kerstbrood"), when there is one.
  title: text("title"),
  path: text("path"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => ({
  idx_activity_log_site: index("idx_activity_log_site").on(
    sql`lower(${table.owner})`,
    sql`lower(${table.repo})`,
    table.createdAt,
  ),
}));

// Webstudio: which monthly report mails went out, so a site never gets the
// same month twice (the cron can run again after a failure).
const reportSentTable = pgTable("report_sent", {
  id: serial("id").primaryKey(),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  // "2026-11"
  month: text("month").notNull(),
  recipients: text("recipients"),
  error: text("error"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
}, table => ({
  uq_report_sent_site_month: uniqueIndex("uq_report_sent_site_month").on(
    sql`lower(${table.owner})`,
    sql`lower(${table.repo})`,
    table.month,
  ),
}));

export {
  reportSentTable,
  activityLogTable,
  pageViewDayTable,
  pageViewTable,
  siteSettingTable,
  formSubmissionTable,
  appSettingTable,
  userTable,
  sessionTable,
  accountTable,
  verificationTable,
  githubInstallationTokenTable,
  collaboratorTable,
  collaboratorInviteTable,
  configTable,
  cacheFileTable,
  cacheFileMetaTable,
  cachePermissionTable,
  actionRunTable
};
