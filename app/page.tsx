"use client";

import { useCallback, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import CreateLobbyModal from "@/components/CreateLobbyModal";
import LobbyCard from "@/components/LobbyCard";

import {
  ensureUserRecord,
  getStoredLobbyId,
  getStoredNickname,
  persistLobbyId,
  setStoredNickname,
} from "@/lib/identity";
import { generateName } from "@/lib/randomName";
import type { Lobby } from "@/types/lobby";
import { supabase } from "@/utils/supabase/client";

type RealtimeLobby = Lobby & {
  expires_at?: string;
};

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState(() => getStoredNickname());
  const [open, setOpen] = useState(false);
  const [lobbies, setLobbies] = useState<Lobby[]>([]);

  const fetchLobbies = useCallback(async () => {
    const { data } = await supabase
      .from("lobbies")
      .select("*")
      .eq("started", false)
      .gt("expires_at", new Date().toISOString());

    setLobbies(data || []);
  }, []);

  useEffect(() => {
    void fetchLobbies();
  }, [fetchLobbies]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void ensureUserRecord(name);
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [name]);

  useEffect(() => {
    const channel = supabase
      .channel("home-lobbies")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "lobbies",
        },
        (payload) => {
          const nextLobby = payload.new as RealtimeLobby;

          if (nextLobby.started) return;

          setLobbies((prev) => {
            if (prev.some((lobby) => lobby.id === nextLobby.id)) return prev;
            if (!nextLobby.expires_at) return prev;
            if (new Date(nextLobby.expires_at).getTime() <= Date.now()) return prev;
            return [nextLobby, ...prev];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "lobbies",
        },
        (payload) => {
          const nextLobby = payload.new as RealtimeLobby;

          setLobbies((prev) => {
            const filtered = prev.filter((lobby) => lobby.id !== nextLobby.id);

            if (nextLobby.started) return filtered;
            if (!nextLobby.expires_at) return filtered;
            if (new Date(nextLobby.expires_at).getTime() <= Date.now()) return filtered;

            return [nextLobby, ...filtered];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "lobbies",
        },
        (payload) => {
          const oldLobby = payload.old as { id: string };

          setLobbies((prev) => prev.filter((lobby) => lobby.id !== oldLobby.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const lobbyId = getStoredLobbyId();

    if (!lobbyId) return;

    const restoreLobby = async () => {
      const { data, error } = await supabase
        .from("lobbies")
        .select("id, started")
        .eq("id", lobbyId)
        .maybeSingle();

      if (!error && data) {
        router.replace(data.started ? `/session/${data.id}` : `/lobby/${data.id}`);
      }
    };

    void restoreLobby();
  }, [router]);

  async function createLobby(title: string, text: string) {
    if (!title.trim() || !text.trim()) {
      alert("Please provide both an assembly name and source text.");
      return;
    }

    const userId = await ensureUserRecord(name);

    const { data, error } = await supabase
      .from("lobbies")
      .insert({
        title: title.trim(),
        source_text: text,
        host_id: userId,
        started: false,
        paused: false,
        current_index: 0,
        participant_order: [],
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();

    if (error || !data) {
      alert(error?.message ?? "Unable to create the assembly.");
      return;
    }

    persistLobbyId(data.id);
    setOpen(false);
    setStoredNickname(name);
    router.push(`/lobby/${data.id}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col bg-[#f8f3e8] text-[#2f241d]">
      <div className="px-4 pt-4">
        <div className="mb-8 rounded-2xl border border-[#d8cdb4] bg-[#fffdf8] p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-[#8a6b3d]">Assembly of Sekkhas</p>
          <h1 className="mt-2 text-2xl font-semibold text-[#3f2f1f]">
            Sutta Study
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#5d4937]">
            Gather together, read long texts in sequence, and let the host guide the flow.
          </p>
        </div>

        <label className="mb-2 block text-sm font-semibold text-[#5d4937]">
          Your nickname
        </label>
        <input
          maxLength={22}
          value={name}
          onChange={(e) => {
            const next = e.target.value;
            setName(next);
            setStoredNickname(next);
          }}
          className="w-full rounded-xl border border-[#d8cdb4] bg-[#fffdf8] p-4 text-[#2f241d] outline-none ring-0"
        />

        <button
          type="button"
          onClick={() => {
            const nextName = generateName();
            setName(nextName);
            setStoredNickname(nextName);
          }}
          className="mt-3 self-start rounded-xl border border-[#d8cdb4] bg-[#fdf8ec] px-4 py-2 text-sm font-semibold text-[#5d4937]"
        >
          Random nickname
        </button>

        <button
          onClick={() => setOpen(true)}
          className="mt-6 mb-0 w-full rounded-xl bg-[#4c6b3b] px-4 py-3 font-semibold text-[#f8f3e8] shadow-sm"
        >
          Create Assembly
        </button>
      </div>

      <div className="relative mt-5 flex-1 w-full overflow-hidden bg-[#f8f3e8] px-2.5 py-2.5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/favicon.ico')",
            backgroundSize: '100% 100%',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
        <div className="relative space-y-1.5">
          {lobbies.map((lobby) => (
            <div key={lobby.id} className="rounded-2xl border border-[#d8cdb4] bg-[#fffdf8]">
              <LobbyCard lobby={lobby} />
            </div>
          ))}
        </div>
      </div>

      <CreateLobbyModal
        open={open}
        onClose={() => setOpen(false)}
        onCreate={createLobby}
      />
    </main>
  );
}