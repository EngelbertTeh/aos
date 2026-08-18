"use client";

import { clearLobbyId, getOrCreateUserId, getStoredNickname } from "@/lib/identity";
import { splitWords } from "@/lib/splitWords";
import { supabase } from "@/utils/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Lobby = {
    id: string;
    title: string;
    source_text: string;
    started: boolean;
    paused: boolean;
    current_index: number;
    participant_order: {
        user_id: string;
        nickname: string;
    }[];
    host_id: string;
};

type Section = {
    user_id: string;
    nickname: string;
    text: string;
};

export default function SessionPage() {
    const params = useParams();
    const router = useRouter();

    const lobbyId = params.id as string;

    const [loading, setLoading] = useState(true);

    const [lobby, setLobby] = useState<Lobby | null>(null);

    const [sections, setSections] = useState<Section[]>([]);

    const [isHost, setIsHost] = useState(false);

    const currentUserNickname = getStoredNickname();

    //----------------------------------------------------------
    // Load lobby
    //----------------------------------------------------------

    const loadLobby = useCallback(async () => {
        const { data, error } = await supabase
            .from("lobbies")
            .select("*")
            .eq("id", lobbyId)
            .single();

        if (error || !data) {
            router.replace("/");
            return;
        }

        setLobby(data);

        const uid = getOrCreateUserId();

        setIsHost(data.host_id === uid);
    }, [lobbyId, router]);

    //----------------------------------------------------------
    // Build reading sections
    //----------------------------------------------------------

    const buildSections = useCallback((currentLobby: Lobby | null | undefined) => {
        const participantOrder = currentLobby?.participant_order;
        const sourceText = currentLobby?.source_text ?? "";

        if (!participantOrder?.length || !sourceText.trim()) {
            setSections((prev) => prev);
            return;
        }

        const pieces = splitWords(sourceText, participantOrder.length || 1);

        const result: Section[] = participantOrder.map((reader, index) => ({
            user_id: reader.user_id,
            nickname: reader.nickname,
            text: pieces[index] ?? "",
        }));

        setSections(result);
    }, []);

    //----------------------------------------------------------
    // Initial load
    //----------------------------------------------------------

    useEffect(() => {
        async function init() {
            await loadLobby();

            const { data } = await supabase
                .from("lobbies")
                .select("*")
                .eq("id", lobbyId)
                .single();

            if (data) {
                buildSections(data as Lobby);
            }

            setLoading(false);
        }

        init();
    }, [loadLobby, buildSections, lobbyId]);

    //----------------------------------------------------------
    // Realtime updates
    //----------------------------------------------------------

    useEffect(() => {
        const channel = supabase
            .channel(`session-${lobbyId}`)
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

                    setLobby(updated);

                    buildSections(updated);
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "DELETE",
                    schema: "public",
                    table: "lobbies",
                    filter: `id=eq.${lobbyId}`,
                },
                () => {
                    setLobby(null);
                    clearLobbyId();
                    router.replace("/");
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [buildSections, lobbyId, router]);

    //----------------------------------------------------------
    //----------------------------------------------------------
    // Host controls
    //----------------------------------------------------------

    async function nextReader() {
        if (!lobby) return;

        if (lobby.current_index >= sections.length - 1) return;

        await supabase
            .from("lobbies")
            .update({
                current_index: lobby.current_index + 1,
            })
            .eq("id", lobby.id);
    }

    async function previousReader() {
        if (!lobby) return;

        if (lobby.current_index <= 0) return;

        await supabase
            .from("lobbies")
            .update({
                current_index: lobby.current_index - 1,
            })
            .eq("id", lobby.id);
    }

    async function togglePause() {
        if (!lobby) return;

        await supabase
            .from("lobbies")
            .update({
                paused: !lobby.paused,
            })
            .eq("id", lobby.id);
    }

    const destroyAssemblyForEveryone = useCallback(async () => {
        if (!lobby) return;

        await supabase
            .from("participants")
            .delete()
            .eq("lobby_id", lobby.id);

        await supabase
            .from("lobbies")
            .delete()
            .eq("id", lobby.id);

        clearLobbyId();
    }, [lobby]);

    async function endAssembly() {
        if (!confirm("End assembly?")) return;
        if (!lobby) return;

        await destroyAssemblyForEveryone();
        router.replace("/");
    }

    useEffect(() => {
        if (!isHost || !lobby) return;

        const handlePageExit = () => {
            void destroyAssemblyForEveryone();
        };

        window.addEventListener("beforeunload", handlePageExit);

        return () => {
            window.removeEventListener("beforeunload", handlePageExit);
            if (isHost && lobby) {
                void destroyAssemblyForEveryone();
            }
        };
    }, [destroyAssemblyForEveryone, isHost, lobby]);

    //----------------------------------------------------------
    // Loading
    //----------------------------------------------------------

    if (loading) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center">
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-green-600" />
                    <p className="mt-4 text-gray-600">Loading assembly...</p>
                </div>
            </main>
        );
    }

    if (!lobby) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <p>Assembly not found.</p>
            </main>
        );
    }

    //----------------------------------------------------------
    // Render
    //----------------------------------------------------------

    return (
        <main className="relative min-h-screen bg-gray-100 pb-32">

            {lobby.paused && !isHost && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2f241d]/35 px-4 backdrop-blur-md">
                    <div className="rounded-full border border-[#d8cdb4] bg-[#fffdf8]/95 px-8 py-4 shadow-2xl">
                        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-[#8a6b3d]">
                            Paused
                        </p>
                    </div>
                </div>
            )}

            <div className="mx-auto max-w-4xl px-4 py-8">

                {/* Title */}

                <div className="rounded-xl bg-white p-6 shadow">

                    <h1 className="text-center text-2xl font-bold">
                        Assembly of Sekkhas
                    </h1>

                    <p className="mt-2 text-center text-lg text-gray-700">
                        {lobby.title}
                    </p>

                </div>

                {/* Reader Indicator */}

                <div className="sticky top-4 z-30 mt-6 rounded-xl border border-[#e6dcc9] bg-[#fffdf8] p-6 shadow-sm text-center">

                    <h2 className="text-3xl font-bold text-[#5c3d20]">
                        You are {currentUserNickname}
                    </h2>

                    <p className="mt-2 text-sm text-[#6c5842]">
                        Reader {lobby.current_index + 1} of {sections.length}
                    </p>

                </div>

                {/* Reading Sections */}

                <div className="mt-6 space-y-6">

                    {sections.map((section, index) => {

                        const active = index === lobby.current_index;

                        return (

                            <section
                                key={section.user_id}
                                className={`rounded-[22px] border p-6 shadow-sm transition-all duration-300 ${active
                                    ? "border-[#d8cdb4] bg-[#fffdf8]"
                                    : lobby.paused
                                        ? "border-[#e6dcc9] bg-[#f8f2e8]"
                                        : "border-gray-200 bg-gray-50 opacity-40"
                                    }`}
                            >

                                <div className="mb-5 flex items-center justify-between gap-3">

                                    <h3
                                        className={`text-lg font-semibold ${active
                                            ? "text-[#5c3d20]"
                                            : lobby.paused
                                                ? "text-[#6f5634]"
                                                : "text-gray-500"
                                            }`}
                                    >
                                        {section.nickname}
                                    </h3>

                                    {active && (
                                        <span className="rounded-full bg-[#efe2c8] px-3 py-1 text-xs font-semibold text-[#6b4729]">
                                            Current Reader
                                        </span>
                                    )}

                                </div>

                                <p
                                    className={`whitespace-pre-wrap text-[1.05rem] leading-[1.9] tracking-[0.01em] font-[Georgia,Times,serif] ${active
                                        ? "text-[#2f241d]"
                                        : lobby.paused
                                            ? "text-[#4d3d2f]"
                                            : "text-gray-500"
                                        }`}
                                >
                                    {section.text}
                                </p>

                            </section>

                        );

                    })}

                </div>

                {/* Host Controls */}

                {isHost && (

                    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur">

                        <div className="mx-auto flex max-w-4xl flex-col gap-3">
                            <h2 className="text-lg font-semibold">
                                Host Controls
                            </h2>

                            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

                                <button
                                    onClick={previousReader}
                                    disabled={lobby.current_index === 0}
                                    className="rounded-lg bg-gray-700 py-3 font-semibold text-white disabled:bg-gray-300"
                                >
                                    Previous
                                </button>

                                <button
                                    onClick={togglePause}
                                    className="rounded-lg bg-yellow-500 py-3 font-semibold text-white"
                                >
                                    {lobby.paused ? "Unpause" : "Pause"}
                                </button>

                                <button
                                    onClick={nextReader}
                                    disabled={lobby.current_index >= sections.length - 1}
                                    className="rounded-lg bg-green-600 py-3 font-semibold text-white disabled:bg-gray-300"
                                >
                                    Next
                                </button>

                                <button
                                    onClick={endAssembly}
                                    className="rounded-lg bg-red-600 py-3 font-semibold text-white"
                                >
                                    Exit
                                </button>

                            </div>
                        </div>

                    </div>

                )}

            </div>

        </main>
    );
}