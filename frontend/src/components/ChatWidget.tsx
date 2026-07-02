import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api";
import type { ChatReply } from "../types";

interface Msg {
  role: "user" | "bot";
  text: string;
}

const GREETING: Msg = {
  role: "bot",
  text:
    'Hi! Tell me what you spent or earned and I\'ll log it.\nYou can also correct, delete, or ask questions — e.g. "the salary is 2500 not 2478", "how much did I spend this month?", or tap 📷 to scan a receipt.',
};

export function ChatWidget({ onChanged }: { onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const SR =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;
  const micSupported = !!SR;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  const runReply = async (promise: Promise<ChatReply>) => {
    setBusy(true);
    try {
      const res = await promise;
      setMessages((m) => [...m, { role: "bot", text: res.reply }]);
      // Reload the ledger — the assistant may have created, corrected, or deleted entries.
      onChanged();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Something went wrong. Try again.";
      setMessages((m) => [...m, { role: "bot", text: msg }]);
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    await runReply(api.sendChat(text));
  };

  const handleImage = async (file: File) => {
    if (busy) return;
    setMessages((m) => [...m, { role: "user", text: `📷 ${file.name}` }]);
    await runReply(api.sendChatImage(file));
  };

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (file) handleImage(file);
  };

  const toggleMic = () => {
    if (!SR) return;
    if (recording) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput((prev) => (prev ? prev + " " : "") + transcript);
    };
    rec.onend = () => setRecording(false);
    rec.onerror = () => setRecording(false);
    recRef.current = rec;
    setRecording(true);
    rec.start();
  };

  if (!open) {
    return (
      <button
        className="chat-fab"
        onClick={() => setOpen(true)}
        title="Ask the assistant"
      >
        💬
      </button>
    );
  }

  return (
    <div className="chat-panel">
      <div className="chat-head">
        <span className="t">Assistant</span>
        <button className="chat-close" onClick={() => setOpen(false)} title="Close">
          ✕
        </button>
      </div>

      <div className="chat-msgs" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            {m.text}
          </div>
        ))}
        {busy && <div className="chat-msg bot">…</div>}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onFilePick}
      />

      <div className="chat-input-row">
        <button
          className="chat-mic"
          onClick={() => fileRef.current?.click()}
          title="Scan a receipt"
          disabled={busy}
        >
          📷
        </button>
        {micSupported && (
          <button
            className={`chat-mic ${recording ? "rec" : ""}`}
            onClick={toggleMic}
            title={recording ? "Stop" : "Speak"}
          >
            {recording ? "■" : "🎤"}
          </button>
        )}
        <input
          type="text"
          placeholder="Type or speak…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button className="chat-send" onClick={send} disabled={busy} title="Send">
          ➤
        </button>
      </div>
    </div>
  );
}
