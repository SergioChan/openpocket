import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadConfig } = require("../dist/config/index.js");
const { TelegramGateway } = require("../dist/gateway/telegram-gateway.js");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTempHome(prefix, fn) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const prevHome = process.env.OPENPOCKET_HOME;
  process.env.OPENPOCKET_HOME = home;
  try {
    await fn(home);
  } finally {
    if (prevHome === undefined) {
      delete process.env.OPENPOCKET_HOME;
    } else {
      process.env.OPENPOCKET_HOME = prevHome;
    }
  }
}

test("TelegramGateway keeps typing heartbeat during async operation", async () => {
  await withTempHome("openpocket-telegram-typing-", async () => {
    const cfg = loadConfig();
    cfg.telegram.botToken = "test-bot-token";

    const gateway = new TelegramGateway(cfg, { typingIntervalMs: 30 });
    gateway.bot.on("polling_error", () => {});
    await gateway.bot.stopPolling().catch(() => {});
    const calls = [];

    gateway.bot.sendChatAction = async (chatId, action) => {
      calls.push({ chatId, action, at: Date.now() });
      return true;
    };

    await gateway.withTypingStatus(123456, async () => {
      await sleep(135);
    });

    assert.equal(calls.length >= 3, true, "typing should be sent repeatedly during operation");
    assert.equal(calls.every((item) => item.chatId === 123456), true);
    assert.equal(calls.every((item) => item.action === "typing"), true);

    const doneCount = calls.length;
    await sleep(80);
    assert.equal(calls.length, doneCount, "typing heartbeat should stop after operation finishes");
  });
});

test("TelegramGateway typing heartbeat supports nested operations", async () => {
  await withTempHome("openpocket-telegram-typing-nested-", async () => {
    const cfg = loadConfig();
    cfg.telegram.botToken = "test-bot-token";

    const gateway = new TelegramGateway(cfg, { typingIntervalMs: 25 });
    gateway.bot.on("polling_error", () => {});
    await gateway.bot.stopPolling().catch(() => {});
    const calls = [];

    gateway.bot.sendChatAction = async (chatId, action) => {
      calls.push({ chatId, action, at: Date.now() });
      return true;
    };

    await gateway.withTypingStatus(8899, async () => {
      await sleep(40);
      await gateway.withTypingStatus(8899, async () => {
        await sleep(60);
      });
      await sleep(40);
    });

    assert.equal(calls.length >= 3, true);

    const doneCount = calls.length;
    await sleep(70);
    assert.equal(calls.length, doneCount, "typing heartbeat should not leak after nested operations");
  });
});

test("TelegramGateway syncs bot display name after onboarding update", async () => {
  await withTempHome("openpocket-telegram-bot-name-sync-", async () => {
    const cfg = loadConfig();
    cfg.telegram.botToken = "test-bot-token";

    const gateway = new TelegramGateway(cfg, { typingIntervalMs: 30 });
    gateway.bot.on("polling_error", () => {});
    await gateway.bot.stopPolling().catch(() => {});

    const setNameCalls = [];
    const messageCalls = [];
    gateway.bot.setMyName = async (form) => {
      setNameCalls.push(form);
      return true;
    };
    gateway.bot.sendMessage = async (chatId, text) => {
      messageCalls.push({ chatId, text });
      return {};
    };

    await gateway.syncBotDisplayName(123, "Jarvis", "zh");
    await gateway.syncBotDisplayName(123, "Jarvis", "zh");

    assert.equal(setNameCalls.length, 1);
    assert.equal(setNameCalls[0].name, "Jarvis");
    assert.equal(messageCalls.length, 1);
    assert.match(messageCalls[0].text, /已同步 Telegram Bot 显示名/);
  });
});

test("TelegramGateway startup sync reads assistant name from IDENTITY.md", async () => {
  await withTempHome("openpocket-telegram-startup-name-sync-", async () => {
    const cfg = loadConfig();
    cfg.telegram.botToken = "test-bot-token";
    fs.writeFileSync(
      path.join(cfg.workspaceDir, "IDENTITY.md"),
      [
        "# IDENTITY",
        "",
        "## Agent Identity",
        "",
        "- Name: Jarvis-Startup",
      ].join("\n"),
      "utf-8",
    );

    const gateway = new TelegramGateway(cfg, { typingIntervalMs: 30 });
    gateway.bot.on("polling_error", () => {});
    await gateway.bot.stopPolling().catch(() => {});

    const setNameCalls = [];
    gateway.bot.setMyName = async (form) => {
      setNameCalls.push(form);
      return true;
    };

    await gateway.syncBotDisplayNameFromIdentity();
    await gateway.syncBotDisplayNameFromIdentity();

    assert.equal(setNameCalls.length, 1);
    assert.equal(setNameCalls[0].name, "Jarvis-Startup");
  });
});

test("TelegramGateway consumes profile-update payload after chat reply", async () => {
  await withTempHome("openpocket-telegram-profile-update-", async () => {
    const cfg = loadConfig();
    cfg.telegram.botToken = "test-bot-token";

    const gateway = new TelegramGateway(cfg, { typingIntervalMs: 30 });
    gateway.bot.on("polling_error", () => {});
    await gateway.bot.stopPolling().catch(() => {});

    const messageCalls = [];
    const setNameCalls = [];
    gateway.bot.sendMessage = async (chatId, text) => {
      messageCalls.push({ chatId, text });
      return {};
    };
    gateway.bot.setMyName = async (form) => {
      setNameCalls.push(form);
      return true;
    };

    let consumed = false;
    gateway.chat.decide = async () => ({
      mode: "chat",
      task: "",
      reply: "已更新。我的名字改为“Jarvis-Phone”。",
      confidence: 1,
      reason: "profile_update",
    });
    gateway.chat.consumePendingProfileUpdate = () => {
      if (consumed) {
        return null;
      }
      consumed = true;
      return { assistantName: "Jarvis-Phone", locale: "zh" };
    };

    await gateway.consumeMessage({ chat: { id: 456 }, text: "你把名字改成 Jarvis-Phone 吧" });

    assert.equal(setNameCalls.length, 1);
    assert.equal(setNameCalls[0].name, "Jarvis-Phone");
    assert.equal(messageCalls.length, 2);
    assert.match(messageCalls[0].text, /已更新/);
    assert.match(messageCalls[1].text, /已同步 Telegram Bot 显示名/);
  });
});

test("TelegramGateway resolves pending 2FA request from plain numeric text", async () => {
  await withTempHome("openpocket-telegram-otp-inline-", async () => {
    const cfg = loadConfig();
    cfg.telegram.botToken = "test-bot-token";

    const gateway = new TelegramGateway(cfg, { typingIntervalMs: 30 });
    gateway.bot.on("polling_error", () => {});
    await gateway.bot.stopPolling().catch(() => {});

    const sent = [];
    gateway.bot.sendMessage = async (chatId, text) => {
      sent.push({ chatId, text });
      return {};
    };

    let resolved = null;
    gateway.humanAuth.listPending = () => [
      {
        requestId: "auth-otp-1",
        chatId: 9001,
        task: "OTP flow",
        capability: "2fa",
        currentApp: "com.example",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        relayEnabled: true,
      },
    ];
    gateway.humanAuth.resolvePending = (requestId, approved, note, actor) => {
      resolved = { requestId, approved, note, actor };
      return true;
    };

    let decideCalled = false;
    gateway.chat.decide = async () => {
      decideCalled = true;
      return {
        mode: "chat",
        task: "",
        reply: "fallback",
        confidence: 1,
        reason: "fallback",
      };
    };

    await gateway.consumeMessage({
      chat: { id: 9001 },
      text: "123456",
    });

    assert.deepEqual(
      resolved,
      {
        requestId: "auth-otp-1",
        approved: true,
        note: "123456",
        actor: "chat:9001:otp-inline",
      },
    );
    assert.equal(decideCalled, false);
    assert.equal(sent.length >= 1, true);
    assert.match(sent[0].text, /Received code/i);
  });
});

test("TelegramGateway /start triggers onboarding reply when onboarding is pending", async () => {
  await withTempHome("openpocket-telegram-start-onboarding-", async () => {
    const cfg = loadConfig();
    cfg.telegram.botToken = "test-bot-token";

    const gateway = new TelegramGateway(cfg, { typingIntervalMs: 30 });
    gateway.bot.on("polling_error", () => {});
    await gateway.bot.stopPolling().catch(() => {});

    const sent = [];
    gateway.bot.sendMessage = async (chatId, text) => {
      sent.push({ chatId, text });
      return {};
    };

    let decideInput = "";
    gateway.chat.isOnboardingPending = () => true;
    gateway.chat.decide = async (_chatId, inputText) => {
      decideInput = inputText;
      return {
        mode: "chat",
        task: "",
        reply: "先做个简短初始化：我该怎么称呼你？",
        confidence: 1,
        reason: "profile_onboarding",
      };
    };

    let taskStarted = false;
    gateway.runTaskAsync = async () => {
      taskStarted = true;
    };

    await gateway.consumeMessage({
      chat: { id: 9101 },
      from: { id: 1, is_bot: false, language_code: "zh-CN", first_name: "Tester" },
      text: "/start",
    });

    assert.equal(decideInput, "你好");
    assert.equal(taskStarted, false);
    assert.equal(sent.length, 1);
    assert.match(sent[0].text, /简短初始化/);
  });
});

test("TelegramGateway /start replies with stable welcome when onboarding is completed", async () => {
  await withTempHome("openpocket-telegram-start-ready-", async () => {
    const cfg = loadConfig();
    cfg.telegram.botToken = "test-bot-token";

    const gateway = new TelegramGateway(cfg, { typingIntervalMs: 30 });
    gateway.bot.on("polling_error", () => {});
    await gateway.bot.stopPolling().catch(() => {});

    const sent = [];
    gateway.bot.sendMessage = async (chatId, text) => {
      sent.push({ chatId, text });
      return {};
    };

    let decideCalled = false;
    gateway.chat.isOnboardingPending = () => false;
    gateway.chat.decide = async () => {
      decideCalled = true;
      return {
        mode: "chat",
        task: "",
        reply: "",
        confidence: 1,
        reason: "noop",
      };
    };

    await gateway.consumeMessage({
      chat: { id: 9102 },
      from: { id: 1, is_bot: false, language_code: "en", first_name: "Tester" },
      text: "/start",
    });

    assert.equal(decideCalled, false);
    assert.equal(sent.length, 1);
    assert.match(sent[0].text, /OpenPocket is ready/);
  });
});

test("TelegramGateway /reset sends session reset startup prompt when onboarding is completed", async () => {
  await withTempHome("openpocket-telegram-reset-startup-", async () => {
    const cfg = loadConfig();
    cfg.telegram.botToken = "test-bot-token";

    const gateway = new TelegramGateway(cfg, { typingIntervalMs: 30 });
    gateway.bot.on("polling_error", () => {});
    await gateway.bot.stopPolling().catch(() => {});

    const sent = [];
    gateway.bot.sendMessage = async (chatId, text) => {
      sent.push({ chatId, text });
      return {};
    };
    gateway.chat.isOnboardingPending = () => false;
    gateway.chat.sessionResetPrompt = () => "Session reset complete. Run Session Startup first.";
    gateway.agent.stopCurrentTask = () => false;

    await gateway.consumeMessage({
      chat: { id: 9103 },
      from: { id: 1, is_bot: false, language_code: "en", first_name: "Tester" },
      text: "/reset",
    });

    assert.equal(sent.length, 2);
    assert.match(sent[0].text, /Conversation memory cleared/);
    assert.match(sent[1].text, /Session reset complete/);
  });
});

test("TelegramGateway /reset routes into onboarding when onboarding is pending", async () => {
  await withTempHome("openpocket-telegram-reset-onboarding-", async () => {
    const cfg = loadConfig();
    cfg.telegram.botToken = "test-bot-token";

    const gateway = new TelegramGateway(cfg, { typingIntervalMs: 30 });
    gateway.bot.on("polling_error", () => {});
    await gateway.bot.stopPolling().catch(() => {});

    const sent = [];
    gateway.bot.sendMessage = async (chatId, text) => {
      sent.push({ chatId, text });
      return {};
    };

    gateway.chat.isOnboardingPending = () => true;
    gateway.chat.decide = async () => ({
      mode: "chat",
      task: "",
      reply: "先做个简短初始化：我该怎么称呼你？",
      confidence: 1,
      reason: "profile_onboarding",
    });
    gateway.agent.stopCurrentTask = () => false;

    await gateway.consumeMessage({
      chat: { id: 9104 },
      from: { id: 1, is_bot: false, language_code: "zh-CN", first_name: "Tester" },
      text: "/reset",
    });

    assert.equal(sent.length, 2);
    assert.match(sent[0].text, /Conversation memory cleared/);
    assert.match(sent[1].text, /简短初始化/);
  });
});

test("TelegramGateway /context returns summary report", async () => {
  await withTempHome("openpocket-telegram-context-summary-", async () => {
    const cfg = loadConfig();
    cfg.telegram.botToken = "test-bot-token";

    const gateway = new TelegramGateway(cfg, { typingIntervalMs: 30 });
    gateway.bot.on("polling_error", () => {});
    await gateway.bot.stopPolling().catch(() => {});

    const sent = [];
    gateway.bot.sendMessage = async (chatId, text) => {
      sent.push({ chatId, text });
      return {};
    };
    gateway.agent.getWorkspacePromptContextReport = () => ({
      maxCharsPerFile: 20000,
      maxCharsTotal: 150000,
      totalIncludedChars: 1024,
      hookApplied: false,
      files: [
        {
          fileName: "AGENTS.md",
          originalChars: 500,
          includedChars: 500,
          truncated: false,
          included: true,
          missing: false,
          snippet: "test",
        },
      ],
    });

    await gateway.consumeMessage({
      chat: { id: 9105 },
      text: "/context",
    });

    assert.equal(sent.length, 1);
    assert.match(sent[0].text, /Workspace prompt context report/);
    assert.match(sent[0].text, /AGENTS\.md/);
  });
});

test("TelegramGateway /context detail returns file snippet", async () => {
  await withTempHome("openpocket-telegram-context-detail-", async () => {
    const cfg = loadConfig();
    cfg.telegram.botToken = "test-bot-token";

    const gateway = new TelegramGateway(cfg, { typingIntervalMs: 30 });
    gateway.bot.on("polling_error", () => {});
    await gateway.bot.stopPolling().catch(() => {});

    const sent = [];
    gateway.bot.sendMessage = async (chatId, text) => {
      sent.push({ chatId, text });
      return {};
    };
    gateway.agent.getWorkspacePromptContextReport = () => ({
      maxCharsPerFile: 20000,
      maxCharsTotal: 150000,
      totalIncludedChars: 2048,
      hookApplied: true,
      files: [
        {
          fileName: "SOUL.md",
          originalChars: 1000,
          includedChars: 900,
          truncated: true,
          included: true,
          missing: false,
          snippet: "soul-snippet-body",
        },
      ],
    });

    await gateway.consumeMessage({
      chat: { id: 9106 },
      text: "/context detail SOUL.md",
    });

    assert.equal(sent.length, 1);
    assert.match(sent[0].text, /SOUL\.md/);
    assert.match(sent[0].text, /soul-snippet-body/);
  });
});
