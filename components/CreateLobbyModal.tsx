"use client";

import { useState } from "react";

interface Props {
    open: boolean;
    onClose: () => void;
    onCreate: (title: string, text: string) => void;
}

export default function CreateLobbyModal({
    open,
    onClose,
    onCreate,
}: Props) {
    const [title, setTitle] = useState("");
    const [text, setText] = useState("");

    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2f241d]/50 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-[#d8cdb4] bg-[#fffdf8] p-5 shadow-sm">

                <label className="mb-2 block text-sm font-semibold text-[#5d4937]">
                    Assembly title
                </label>
                <input
                    placeholder="Assembly name"
                    maxLength={80}
                    className="mb-3 w-full rounded-lg border border-[#d8cdb4] bg-[#fcf8f0] p-3 text-[#2f241d] outline-none"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />

                <label className="mb-2 block text-sm font-semibold text-[#5d4937]">
                    Source text
                </label>
                <textarea
                    placeholder="Paste text here"
                    rows={10}
                    className="mb-4 w-full rounded-lg border border-[#d8cdb4] bg-[#fcf8f0] p-3 text-[#2f241d] outline-none"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                />

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="rounded-lg border border-[#d8cdb4] px-4 py-2 text-[#5d4937]"
                    >
                        Close
                    </button>

                    <button
                        className="rounded-lg bg-[#4c6b3b] px-4 py-2 font-semibold text-[#f8f3e8]"
                        onClick={() => onCreate(title, text)}
                    >
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
}