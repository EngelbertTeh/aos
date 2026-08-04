"use client";

import { v4 as uuidv4 } from "uuid";

import { generateName } from "@/lib/randomName";
import { supabase } from "@/utils/supabase/client";

const USER_ID_KEY = "assembly_user_id";
const NICKNAME_KEY = "assembly_nickname";
const SESSION_ID_KEY = "assembly_session_id";
const LOBBY_ID_KEY = "assembly_lobby_id";

function readStorage(key: string) {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
}

function writeStorage(key: string, value: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
}

export function getOrCreateUserId() {
    const existing = readStorage(USER_ID_KEY);
    if (existing) return existing;

    const nextId = uuidv4();
    writeStorage(USER_ID_KEY, nextId);
    return nextId;
}

export function getStoredNickname() {
    const existing = readStorage(NICKNAME_KEY);
    if (existing && existing.trim()) return existing.trim();

    const fallback = generateName();
    writeStorage(NICKNAME_KEY, fallback);
    return fallback;
}

export function setStoredNickname(nickname: string) {
    const trimmed = nickname.trim().slice(0, 15);
    if (!trimmed) return;
    writeStorage(NICKNAME_KEY, trimmed);
}

export function getOrCreateSessionId() {
    const existing = readStorage(SESSION_ID_KEY);
    if (existing) return existing;

    const nextId = uuidv4();
    writeStorage(SESSION_ID_KEY, nextId);
    return nextId;
}

export function persistLobbyId(lobbyId: string) {
    writeStorage(LOBBY_ID_KEY, lobbyId);
}

export function clearLobbyId() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(LOBBY_ID_KEY);
}

export function getStoredLobbyId() {
    return readStorage(LOBBY_ID_KEY);
}

export async function ensureUserRecord(nickname: string) {
    const userId = getOrCreateUserId();
    const sessionId = getOrCreateSessionId();
    const trimmed = nickname.trim().slice(0, 15) || getStoredNickname();

    if (!readStorage(NICKNAME_KEY)) {
        writeStorage(NICKNAME_KEY, trimmed);
    }

    try {
        const { data, error } = await supabase
            .from("users")
            .select("id")
            .eq("id", userId)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            const { error: updateError } = await supabase
                .from("users")
                .update({
                    nickname: trimmed,
                    session_id: sessionId,
                })
                .eq("id", userId);

            if (updateError) throw updateError;
        } else {
            const { error: insertError } = await supabase.from("users").insert({
                id: userId,
                session_id: sessionId,
                nickname: trimmed,
                created_at: new Date().toISOString(),
            });

            if (insertError) throw insertError;
        }
    } catch {
        // Ignore local identity sync failures so the app still works anonymously.
    }

    return userId;
}
