"use client";

import { clearLobbyId, ensureUserRecord, getOrCreateUserId, getStoredNickname, persistLobbyId } from "@/lib/identity";
import { shuffle } from "@/lib/shuffle";
import { supabase } from "@/utils/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Lobby = {
    id: string;
    title: string;
    host_id: string;
    started: boolean;
    current_index: number;
};

type Participant = {
    id: string;
    lobby_id: string;
    user_id: string;
    active: boolean;
    joined_at: string;
    users: Array<{
        id: string;
        nickname: string;
    }>;
};

export default function LobbyPage() {
    const params = useParams();
    const router = useRouter();

    const lobbyId = params.id as string;

    const [loading, setLoading] = useState(true);

    const [lobby, setLobby] = useState<Lobby | null>(null);

    const [participants, setParticipants] = useState<Participant[]>([]);

    const [isHost, setIsHost] = useState(false);

    const currentUserId = getOrCreateUserId();

    //-----------------------------------------------------
    // Load lobby
    //-----------------------------------------------------

    const loadLobby = useCallback(async () => {
        const { data, error } = await supabase
            .from("lobbies")
            .select("*")
            .eq("id", lobbyId)
            .single();

        if (error || !data) {
            alert("Lobby not found.");
            router.replace("/");
            return;
        }

        setLobby(data);

        const uid = getOrCreateUserId();

        setIsHost(data.host_id === uid);
    }, [lobbyId, router]);

    //-----------------------------------------------------
    // Load participants
    //-----------------------------------------------------

    const loadParticipants = useCallback(async () => {
        const { data: participantRows, error: participantError } = await supabase
            .from("participants")
            .select("id, lobby_id, user_id, active, joined_at")
            .eq("lobby_id", lobbyId)
            .eq("active", true)
            .order("joined_at");

        if (participantError) throw participantError;

        const userIds = Array.from(new Set((participantRows ?? []).map((row) => row.user_id)));

        const { data: userRows, error: userError } = await supabase
            .from("users")
            .select("id, nickname")
            .in("id", userIds);

        if (userError) throw userError;

        const nicknameMap = new Map<string, string>();
        (userRows ?? []).forEach((row) => {
            nicknameMap.set(row.id, row.nickname ?? "");
        });

        const uniqueParticipants = new Map<string, Participant>();

        (participantRows ?? []).forEach((participant) => {
            if (!uniqueParticipants.has(participant.user_id)) {
                uniqueParticipants.set(participant.user_id, {
                    ...participant,
                    users: [{
                        id: participant.user_id,
                        nickname: nicknameMap.get(participant.user_id) ?? "",
                    }],
                } as Participant);
            }
        });

        setParticipants(Array.from(uniqueParticipants.values()));
    }, [lobbyId]);

    //-----------------------------------------------------
    // Join lobby
    //-----------------------------------------------------

    const joinLobby = useCallback(async () => {
        const uid = getOrCreateUserId();
        const nickname = getStoredNickname();

        await ensureUserRecord(nickname);

        const { data: existingRows, error: existingError } = await supabase
            .from("participants")
            .select("id")
            .eq("lobby_id", lobbyId)
            .eq("user_id", uid)
            .order("joined_at", { ascending: false });

        if (existingError) throw existingError;

        if (existingRows && existingRows.length > 0) {
            const activeId = existingRows[0].id;
            const inactiveIds = existingRows.slice(1).map((row) => row.id);

            await supabase
                .from("participants")
                .update({ active: true })
                .eq("id", activeId);

            if (inactiveIds.length > 0) {
                await supabase
                    .from("participants")
                    .update({ active: false })
                    .in("id", inactiveIds);
            }
        } else {
            await supabase.from("participants").insert({
                lobby_id: lobbyId,
                user_id: uid,
                active: true,
            });
        }

        persistLobbyId(lobbyId);
    }, [lobbyId]);

    //-----------------------------------------------------
    // Initialize
    //-----------------------------------------------------

    useEffect(() => {
        async function init() {
            await loadLobby();
            await joinLobby();
            await loadParticipants();
            setLoading(false);
        }

        init();
    }, [loadLobby, joinLobby, loadParticipants]);

    //-----------------------------------------------------
    // Participant realtime
    //-----------------------------------------------------

    useEffect(() => {
        const channel = supabase
            .channel(`participants-${lobbyId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "participants",
                    filter: `lobby_id=eq.${lobbyId}`,
                },
                () => {
                    loadParticipants();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [lobbyId, loadParticipants]);

    //-----------------------------------------------------
    // Lobby realtime
    //-----------------------------------------------------

    useEffect(() => {
        const channel = supabase
            .channel(`lobby-${lobbyId}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "lobbies",
                    filter: `id=eq.${lobbyId}`,
                },
                (payload) => {
                    const updated = payload.new as Lobby;

                    if (updated.started) {
                        router.replace(`/session/${lobbyId}`);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [lobbyId, router]);

    //-----------------------------------------------------
    // Start session
    //-----------------------------------------------------

    async function handleStart() {
        if (!isHost) return;

        const shuffled = shuffle(participants);

        const order = shuffled.map((p) => ({
            user_id: p.user_id,
            nickname: p.users[0]?.nickname || p.user_id,
        }));

        const { error } = await supabase
            .from("lobbies")
            .update({
                participant_order: order,
                started: true,
                current_index: 0,
            })
            .eq("id", lobbyId);

        if (error) {
            alert(error.message);
            return;
        }

        router.replace(`/session/${lobbyId}`);
    }

    //-----------------------------------------------------
    // Exit
    //-----------------------------------------------------

    async function handleLeaveLobby() {
        if (!confirm("Leave this lobby?")) return;

        await supabase
            .from("participants")
            .delete()
            .eq("lobby_id", lobbyId)
            .eq("user_id", currentUserId);

        clearLobbyId();
        router.replace("/");
    }

    async function handleExit() {
        if (!confirm("Close this assembly?")) return;

        await supabase
            .from("participants")
            .delete()
            .eq("lobby_id", lobbyId);

        await supabase
            .from("lobbies")
            .delete()
            .eq("id", lobbyId);

        clearLobbyId();

        router.replace("/");
    }

    //-----------------------------------------------------
    // Loading
    //-----------------------------------------------------

    if (loading) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-[#f8f3e8] text-[#2f241d]">
                <div className="text-center">
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#d8cdb4] border-t-[#4c6b3b]" />
                    <p className="mt-4 text-[#5d4937]">Joining assembly...</p>
                </div>
            </main>
        );
    }

    if (!lobby) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-[#f8f3e8] text-[#2f241d]">
                <p>Lobby not found.</p>
            </main>
        );
    }

    //-----------------------------------------------------
    // UI
    //-----------------------------------------------------

    return (
        <main className="min-h-screen bg-[#f8f3e8] px-4 py-8 text-[#2f241d]">
            <div className="mx-auto max-w-xl">

                {/* Header */}

                <div className="rounded-2xl border border-[#d8cdb4] bg-[#fffdf8] p-6 shadow-sm">

                    <h1 className="text-center text-2xl font-semibold text-[#3f2f1f]">
                        Assembly of Sekkhas
                    </h1>

                    <p className="mt-2 text-center text-lg text-[#4b3b2c]">
                        {lobby.title}
                    </p>

                </div>

                {/* Participants */}

                <div className="mt-6 rounded-2xl border border-[#d8cdb4] bg-[#fffdf8] p-6 shadow-sm">

                    <h2 className="mb-4 text-lg font-semibold text-[#3f2f1f]">
                        Participants ({participants.length})
                    </h2>

                    {participants.length === 0 ? (
                        <p className="text-[#5d4937]">
                            Waiting for participants...
                        </p>
                    ) : (
                        <ul className="space-y-3">
                            {participants.map((participant) => {
                                const nickname = participant.users[0]?.nickname || participant.user_id;
                                const isCurrentUser = participant.user_id === currentUserId;
                                const isHostUser = participant.user_id === lobby.host_id;

                                return (
                                    <li
                                        key={participant.id}
                                        className="flex items-center justify-between rounded-lg border border-[#e8dfcc] bg-[#fcf8f0] px-4 py-3"
                                    >
                                        <span className="font-medium text-[#2f241d]">
                                            {nickname}
                                        </span>

                                        <div className="flex items-center gap-2">
                                            {isCurrentUser && (
                                                <span className="rounded-full bg-[#efe2c8] px-3 py-1 text-xs font-semibold text-[#6b4729]">
                                                    You
                                                </span>
                                            )}

                                            {isHostUser && (
                                                <span className="rounded-full bg-[#e8f1e2] px-3 py-1 text-xs font-semibold text-[#4c6b3b]">
                                                    Host
                                                </span>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                </div>

                {/* Waiting message */}

                {!isHost && (
                    <div className="mt-6 rounded-2xl border border-[#d8cdb4] bg-[#fffdf8] p-6 text-center shadow-sm">

                        <p className="text-lg font-medium text-[#3f2f1f]">
                            Waiting for the host to begin...
                        </p>

                        <p className="mt-2 text-sm text-[#5d4937]">
                            The reading session will start automatically.
                        </p>

                        <button
                            onClick={handleLeaveLobby}
                            className="mt-5 w-full rounded-lg border border-[#b77a61] bg-[#f6ede8] py-3 font-semibold text-[#5d3a2c] transition hover:bg-[#f1e3db]"
                        >
                            Exit Lobby
                        </button>

                    </div>
                )}

                {/* Host controls */}

                {isHost && (
                    <div className="mt-6 rounded-2xl border border-[#d8cdb4] bg-[#fffdf8] p-6 shadow-sm">

                        <h2 className="mb-4 text-lg font-semibold text-[#3f2f1f]">
                            Host Controls
                        </h2>

                        <div className="flex gap-4">

                            <button
                                onClick={handleExit}
                                className="flex-1 rounded-lg bg-[#9b4f3a] py-3 font-semibold text-[#f8f3e8] transition hover:bg-[#874436]"
                            >
                                Exit
                            </button>

                            <button
                                onClick={handleStart}
                                disabled={participants.length === 0}
                                className="flex-1 rounded-lg bg-[#4c6b3b] py-3 font-semibold text-[#f8f3e8] transition hover:bg-[#405d32] disabled:bg-[#c9bfa9]"
                            >
                                Start
                            </button>

                        </div>

                        <p className="mt-4 text-sm text-[#5d4937]">
                            Starting will randomize the participant order and move everyone
                            into the synchronized reading session.
                        </p>

                    </div>
                )}

            </div>
        </main>
    );
}
