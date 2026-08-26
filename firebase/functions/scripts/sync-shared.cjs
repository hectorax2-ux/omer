const fs = require("fs");
const path = require("path");

const sharedDir = path.join(__dirname, "../../shared");
const targetDir = path.join(__dirname, "../src");

fs.copyFileSync(path.join(sharedDir, "duel-automation.ts"), path.join(targetDir, "duel-automation.ts"));
fs.copyFileSync(path.join(sharedDir, "prophecy-schedule.ts"), path.join(targetDir, "prophecy-schedule.ts"));
fs.copyFileSync(path.join(sharedDir, "prophecy-duel-bridge.ts"), path.join(targetDir, "prophecy-duel-bridge.ts"));
fs.copyFileSync(path.join(sharedDir, "competition-week.ts"), path.join(targetDir, "competition-week.ts"));
fs.copyFileSync(path.join(sharedDir, "notification-automation.ts"), path.join(targetDir, "notification-automation.ts"));
fs.copyFileSync(path.join(sharedDir, "messaging.ts"), path.join(targetDir, "messaging.ts"));
fs.copyFileSync(path.join(sharedDir, "content-schedule.ts"), path.join(targetDir, "content-schedule.ts"));
fs.copyFileSync(path.join(sharedDir, "notification-targeting.ts"), path.join(targetDir, "notification-targeting.ts"));
fs.copyFileSync(path.join(sharedDir, "timeline-game.ts"), path.join(targetDir, "timeline-game-core.ts"));
