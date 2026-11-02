import type { Db } from "@hyphae/db";
import type { Api } from "grammy";
import { announceRaid } from "../raid-alerts/announce-raid.js";
import { fetchPost } from "../x/oembed.js";
import type { PostRaidDeps } from "./raids.js";

// The live dependencies of a raid posted from Organic: the bot announces it in the community's
// group as /raid would, with cards or the plain message.
export function telegramRaidDeps(db: Db, api: Api, webUrl: string): PostRaidDeps {
  let me: ReturnType<Api["getMe"]> | undefined;
  const bot = () => {
    me ??= api.getMe().catch((error: unknown) => {
      me = undefined;
      throw error;
    });
    return me;
  };
  return {
    db,
    fetchPost,
    botId: async () => BigInt((await bot()).id),
    announce: async (community, post, task, hours) =>
      announceRaid(
        db,
        {
          api,
          botUsername: (await bot()).username,
          sendText: (text, other) => api.sendMessage(Number(community.telegramChatId), text, other),
        },
        community,
        post,
        task,
        hours,
        webUrl,
      ),
  };
}
