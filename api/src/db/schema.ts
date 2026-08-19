import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  json,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ── Enums ─────────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("Role", ["USER", "ADMIN", "MODERATOR", "ANALYST"]);
export const kycStatusEnum = pgEnum("KycStatus", ["NONE", "PENDING", "APPROVED", "REJECTED", "EXPIRED"]);
export const transactionStatusEnum = pgEnum("TransactionStatus", ["PENDING", "COMPLETED", "REJECTED"]);
export const withdrawalStatusEnum = pgEnum("WithdrawalStatus", ["PENDING_VERIFICATION", "PENDING", "APPROVED", "REJECTED"]);
export const ticketStatusEnum = pgEnum("TicketStatus", ["OPEN", "CLOSED"]);
export const messageSenderEnum = pgEnum("MessageSender", ["USER", "ADMIN"]);
export const transactionTypeEnum = pgEnum("TransactionType", ["Deposit", "Withdrawal", "Trade", "SubscriptionFee", "SubscriptionUpgrade", "SubscriptionDowngrade"]);
export const riskLabelEnum = pgEnum("RiskLabel", ["CONSERVATIVE", "MODERATE", "AGGRESSIVE", "SPECULATIVE"]);
export const positionSideEnum = pgEnum("PositionSide", ["LONG", "SHORT"]);
export const positionStatusEnum = pgEnum("PositionStatus", ["OPEN", "CLOSED", "LIQUIDATED"]);
export const botStatusEnum = pgEnum("BotStatus", ["RUNNING", "PAUSED", "STOPPED"]);
export const tradeSideEnum = pgEnum("TradeSide", ["BUY", "SELL"]);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const users = pgTable("User", {
  id:                     text("id").primaryKey(),
  firstName:              text("firstName"),
  lastName:               text("lastName"),
  email:                  text("email").notNull().unique(),
  emailVerified:          timestamp("emailVerified"),
  password:               text("password"),
  image:                  text("image"),
  phone:                  text("phone"),
  country:                text("country"),
  role:                   roleEnum("role").notNull().default("USER"),
  portfolioBalance:       decimal("portfolioBalance", { precision: 19, scale: 8 }).notNull().default("0"),
  previousBalance:        decimal("previousBalance", { precision: 19, scale: 8 }).notNull().default("0"),
  portfolioChangePercent: decimal("portfolioChangePercent", { precision: 19, scale: 8 }).notNull().default("0"),
  realisedPnl:            decimal("realisedPnl", { precision: 19, scale: 8 }).notNull().default("0"),
  volatility:             decimal("volatility", { precision: 19, scale: 8 }).notNull().default("0"),
  riskLabel:              riskLabelEnum("riskLabel").notNull().default("CONSERVATIVE"),
  kycStatus:              kycStatusEnum("kycStatus").notNull().default("NONE"),
  createdAt:              timestamp("createdAt").notNull().defaultNow(),
  updatedAt:              timestamp("updatedAt").notNull().defaultNow(),
}, (t) => [
  index("User_kycStatus_createdAt_idx").on(t.kycStatus, t.createdAt),
  index("User_role_idx").on(t.role),
  index("User_country_idx").on(t.country),
]);

// ── Finance ───────────────────────────────────────────────────────────────────
export const depositMethods = pgTable("DepositMethod", {
  id: text("id").primaryKey(), label: text("label").notNull(), icon: text("icon").notNull(),
  address: text("address").notNull(), logoUrl: text("logoUrl"), network: text("network"),
  note: text("note"), isActive: boolean("isActive").notNull().default(true),
  sortOrder: integer("sortOrder").notNull().default(0), createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const deposits = pgTable("Deposit", {
  id: text("id").primaryKey(), userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 19, scale: 8 }).notNull(), currency: text("currency").notNull().default("USD"),
  status: transactionStatusEnum("status").notNull().default("PENDING"), methodLabel: text("methodLabel"),
  note: text("note"), adminNote: text("adminNote"), createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const withdrawals = pgTable("Withdrawal", {
  id: text("id").primaryKey(), userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 19, scale: 8 }).notNull(), currency: text("currency").notNull().default("USD"),
  status: withdrawalStatusEnum("status").notNull().default("PENDING"), note: text("note"), adminNote: text("adminNote"),
  createdAt: timestamp("createdAt").notNull().defaultNow(), updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const notifications = pgTable("Notification", {
  id: text("id").primaryKey(), userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(), read: boolean("read").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(), updatedAt: timestamp("updatedAt").notNull().defaultNow(),
}, (t) => [index("Notification_userId_read_idx").on(t.userId, t.read)]);

export const activityLogs = pgTable("ActivityLog", {
  id: text("id").primaryKey(), userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  description: text("description").notNull(), createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
}, (t) => [index("ActivityLog_userId_createdAt_idx").on(t.userId, t.createdAt)]);

export const kycSubmissions = pgTable("KYCSubmission", {
  id: text("id").primaryKey(), userId: text("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("PENDING"), documentType: text("documentType").notNull().default("PASSPORT"),
  frontUrl: text("frontUrl"), backUrl: text("backUrl"), selfieUrl: text("selfieUrl"), notes: text("notes"),
  submittedAt: timestamp("submittedAt").notNull().defaultNow(), reviewedAt: timestamp("reviewedAt"),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

// ── Support ───────────────────────────────────────────────────────────────────
export const supportTickets = pgTable("SupportTicket", {
  id: text("id").primaryKey(), userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(), status: ticketStatusEnum("status").notNull().default("OPEN"),
  createdAt: timestamp("createdAt").notNull().defaultNow(), updatedAt: timestamp("updatedAt").notNull().defaultNow(),
}, (t) => [
  index("SupportTicket_userId_status_idx").on(t.userId, t.status),
  index("SupportTicket_status_createdAt_idx").on(t.status, t.createdAt),
]);

export const supportMessages = pgTable("SupportMessage", {
  id: text("id").primaryKey(), ticketId: text("ticketId").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  sender: messageSenderEnum("sender").notNull(), body: text("body").notNull(), createdAt: timestamp("createdAt").notNull().defaultNow(),
}, (t) => [index("SupportMessage_ticketId_createdAt_idx").on(t.ticketId, t.createdAt)]);

export const marketPrices = pgTable("MarketPrice", {
  id: text("id").primaryKey(), symbol: text("symbol").notNull().unique(), geckoId: text("geckoId").notNull().unique(),
  name: text("name").notNull(), icon: text("icon").notNull().default("?"), iconBg: text("iconBg").notNull().default("#cccccc"),
  iconCol: text("iconCol").notNull().default("#ffffff"), isActive: boolean("isActive").notNull().default(true),
  sortOrder: integer("sortOrder").notNull().default(0), createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const positions = pgTable("Position", {
  id: text("id").primaryKey(), userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  asset: text("asset").notNull(), symbol: text("symbol").notNull(),
  quantity: decimal("quantity", { precision: 19, scale: 8 }).notNull().default("0"),
  entryPrice: decimal("entryPrice", { precision: 19, scale: 8 }).notNull().default("0"),
  currentPnl: decimal("currentPnl", { precision: 19, scale: 8 }).notNull().default("0"),
  side: positionSideEnum("side").notNull().default("LONG"), status: positionStatusEnum("status").notNull().default("OPEN"),
  leverage: decimal("leverage", { precision: 5, scale: 2 }).notNull().default("1"), marketType: text("marketType").notNull().default("CRYPTO"),
  openedAt: timestamp("openedAt").notNull().defaultNow(), closedAt: timestamp("closedAt"), updatedAt: timestamp("updatedAt").notNull().defaultNow(),
}, (t) => [
  index("Position_userId_status_idx").on(t.userId, t.status),
  index("Position_symbol_status_idx").on(t.symbol, t.status),
]);

export const transactions = pgTable("Transaction", {
  id: text("id").primaryKey(), type: transactionTypeEnum("type").notNull(), asset: text("asset"),
  amount: decimal("amount", { precision: 19, scale: 8 }).notNull(), price: decimal("price", { precision: 19, scale: 8 }),
  action: text("action"), leverage: decimal("leverage", { precision: 5, scale: 2 }), pnl: decimal("pnl", { precision: 19, scale: 8 }),
  status: transactionStatusEnum("status").notNull().default("PENDING"),
  userId: text("userId").notNull().references(() => users.id), description: text("description"),
  createdAt: timestamp("createdAt").notNull().defaultNow(), updatedAt: timestamp("updatedAt").notNull().defaultNow(),
}, (t) => [
  index("Transaction_userId_createdAt_idx").on(t.userId, t.createdAt),
  index("Transaction_type_status_idx").on(t.type, t.status),
]);

// ── Subscriptions ─────────────────────────────────────────────────────────────
export const subscriptionPlans = pgTable("SubscriptionPlan", {
  id: text("id").primaryKey(), name: text("name").notNull(), tier: text("tier").notNull().default("basic"),
  description: text("description"), price: decimal("price", { precision: 19, scale: 8 }).notNull(),
  minInvestment: decimal("minInvestment", { precision: 19, scale: 8 }).notNull().default("0"),
  weeklyReturnRate: decimal("weeklyReturnRate", { precision: 5, scale: 4 }).notNull().default("0"),
  interval: text("interval").notNull().default("WEEKLY"), features: json("features"),
  isActive: boolean("isActive").notNull().default(true), highlight: text("highlight"),
  sortOrder: integer("sortOrder").notNull().default(0), createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const subscriptions = pgTable("Subscription", {
  id: text("id").primaryKey(), userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  planId: text("planId").notNull().references(() => subscriptionPlans.id), status: text("status").notNull().default("active"),
  startDate: timestamp("startDate").notNull(), currentPeriodStart: timestamp("currentPeriodStart").notNull(),
  currentPeriodEnd: timestamp("currentPeriodEnd").notNull(), nextBillingDate: timestamp("nextBillingDate").notNull(),
  autoRenew: boolean("autoRenew").notNull().default(true), cancelledAt: timestamp("cancelledAt"),
  pendingPlanId: text("pendingPlanId").references(() => subscriptionPlans.id),
  previousSubscriptionId: text("previousSubscriptionId"),
  createdAt: timestamp("createdAt").notNull().defaultNow(), updatedAt: timestamp("updatedAt").notNull().defaultNow(),
}, (t) => [
  index("Subscription_userId_status_idx").on(t.userId, t.status),
  index("Subscription_nextBillingDate_autoRenew_status_idx").on(t.nextBillingDate, t.autoRenew, t.status),
]);

// ── Trading Bots ──────────────────────────────────────────────────────────────
export const tradingBots = pgTable("TradingBot", {
  id: text("id").primaryKey(), userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(), strategy: text("strategy").notNull(), config: json("config").notNull(),
  status: botStatusEnum("status").notNull().default("STOPPED"), lastRun: timestamp("lastRun"),
  createdAt: timestamp("createdAt").notNull().defaultNow(), updatedAt: timestamp("updatedAt").notNull().defaultNow(),
}, (t) => [
  index("TradingBot_userId_status_idx").on(t.userId, t.status),
  index("TradingBot_status_lastRun_idx").on(t.status, t.lastRun),
]);

export const botTrades = pgTable("BotTrade", {
  id: text("id").primaryKey(), botId: text("botId").notNull().references(() => tradingBots.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(), side: tradeSideEnum("side").notNull(),
  quantity: decimal("quantity", { precision: 19, scale: 8 }).notNull(), price: decimal("price", { precision: 19, scale: 8 }).notNull(),
  amount: decimal("amount", { precision: 19, scale: 8 }).notNull(), executedAt: timestamp("executedAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
}, (t) => [
  index("BotTrade_botId_executedAt_idx").on(t.botId, t.executedAt),
  index("BotTrade_symbol_executedAt_idx").on(t.symbol, t.executedAt),
]);
