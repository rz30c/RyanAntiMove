/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/**
 * @name 1 0 Pro
 * @description Full protection + instant return + message to anyone who tries to pull you
 * @version 2.0.0
 */

import definePlugin from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { ApplicationCommandInputType } from "@api/Commands";
import { findByProps } from "@webpack";

/* ========== STORES ========== */
const VoiceActions = findByProps("selectVoiceChannel");
const UserStore = findByProps("getCurrentUser");
const DMUtils = findByProps("openPrivateChannel");
const RelationshipStore = findByProps("addRelationship");

/* ========== SETTINGS ========== */
const settings = definePluginSettings({
    antiMove: { type: "boolean", description: "منع السحب", default: true },
    notifySound: { type: "boolean", description: "صوت تنبيه", default: true },
    autoDM: { type: "boolean", description: "DM تلقائي", default: true },
    trollMode: { type: "boolean", description: "وضع استفزاز 😂", default: false },
    lockRoom: { type: "boolean", description: "قفل الروم", default: true },
    autoBlockAfter: { type: "number", description: "حظر بعد كم محاولة", default: 3 },
    ignoredUsers: { type: "string", description: "IDs متجاهلة", default: "" }
});

/* ========== STATE ========== */
let lastVoiceChannelId: string | null = null;
const attempts: Record<string, number> = {};

/* ========== UI ========== */
function overlay(text: string) {
    const el = document.createElement("div");
    el.textContent = text;
    el.style.cssText = `
        position:fixed;
        bottom:20px;
        right:20px;
        background:#0f172a;
        color:#fff;
        padding:12px 16px;
        border-radius:10px;
        z-index:9999;
        font-size:14px;
        box-shadow:0 10px 25px rgba(0,0,0,.4);
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4500);
}

/* ========== PLUGIN ========== */
export default definePlugin({
    name: "10AntiMove",
    description: "حماية كاملة من سحب الرومات 🔒",
    authors: [{ name: "10" }],
    settings,

    start() {
        console.log("🛡️ 10AntiMove شغال");

        // Slash Command
        this.registerCommand({
            name: "antimove",
            description: "تشغيل / إيقاف منع السحب",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: () => {
                settings.store.antiMove = !settings.store.antiMove;
                return {
                    content: `🛡️ AntiMove: ${settings.store.antiMove ? "مفعل ✅" : "موقف ❌"}`
                };
            }
        });

        // Voice Protection
        this.addFluxListener("VOICE_STATE_UPDATE", async (p: any) => {
            const myId = UserStore.getCurrentUser()?.id;
            if (!myId || p.userId !== myId) return;

            if (p.channelId) {
                lastVoiceChannelId = p.channelId;
                return;
            }

            if (!settings.store.antiMove || !lastVoiceChannelId) return;

            const executorId = p?.member?.user?.id;
            if (!executorId) return;

            const ignored = settings.store.ignoredUsers
                .split(",")
                .map(x => x.trim())
                .filter(Boolean);

            if (ignored.includes(executorId)) return;

            attempts[executorId] = (attempts[executorId] || 0) + 1;

            // رجوع فوري
            VoiceActions.selectVoiceChannel(lastVoiceChannelId);

            // صوت
            if (settings.store.notifySound) {
                new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg").play();
            }

            // Overlay
            overlay(`🚨 محاولة سحب من <@${executorId}> (${attempts[executorId]})`);

            // DM لك
            const me = await DMUtils.openPrivateChannel(myId);
            me?.sendMessage?.({
                content:
                    `🛡️ محاولة سحب\n` +
                    `👤 <@${executorId}>\n` +
                    `🔢 العدد: ${attempts[executorId]}`
            });

            // DM له
            if (settings.store.autoDM) {
                const msg =
                    attempts[executorId] >= settings.store.autoBlockAfter
                        ? "⛔ تم حظرك تلقائيًا بسبب تكرار السحب."
                        : settings.store.trollMode
                            ? "😂 رجعت غصب… لا تحاول"
                            : "تنبيه: لا يمكن سحبي من الروم.";

                const him = await DMUtils.openPrivateChannel(executorId);
                him?.sendMessage?.({ content: msg });
            }

            // حظر تلقائي
            if (attempts[executorId] >= settings.store.autoBlockAfter) {
                RelationshipStore.addRelationship(executorId, 2);
            }

            console.log("🛡️ AntiMove", executorId, attempts[executorId]);
        });
    },

    stop() {
        console.log("🛑 10AntiMove توقف");
    }
});
