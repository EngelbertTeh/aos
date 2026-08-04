"use client";

import { Lobby } from "@/types/lobby";
import Link from "next/link";

interface Props {
    lobby: Lobby;
}

export default function LobbyCard({ lobby }: Props) {
    return (
        <Link href={`/lobby/${lobby.id}`}>
            <div className="rounded-2xl border border-[#d8cdb4] bg-[#fffdf8] p-4 shadow-sm transition hover:bg-[#fcf8f0]">
                <h2 className="font-semibold text-[#3f2f1f]">
                    {lobby.title}
                </h2>

                <p className="mt-1 text-sm text-[#5d4937]">
                    Tap to join
                </p>
            </div>
        </Link>
    );
}