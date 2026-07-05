import React, { useState, useRef } from "react";
import { Send, Bot, User, Upload } from "lucide-react";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export function ChatComponent({
  matchId,
  apiUrl,
  isAdmin = false,
  setAlertMessage,
}: {
  matchId: string | null;
  apiUrl: string;
  isAdmin?: boolean;
  setAlertMessage: (msg: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! Ask me anything about the live match!" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isUploadingRules, setIsUploadingRules] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRulesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingRules(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const response = await fetch(`${apiUrl}/rules/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileBase64: reader.result }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Upload failed");
        setAlertMessage(
          `✅ Rules uploaded! Processed ${data.chunksProcessed} sections.`,
        );
      } catch (err: any) {
        setAlertMessage(`❌ Upload failed: ${err.message}`);
      } finally {
        setIsUploadingRules(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputText = input.trim();
    if (!inputText || loading) return;

    if (inputText.startsWith("/login ")) {
      const pin = inputText.split(" ")[1];
      const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || "2403";
      if (pin === ADMIN_PIN) {
        sessionStorage.setItem("auth_admin", "true");
        window.location.reload();
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "user", content: inputText },
          { role: "assistant", content: "❌ Invalid Admin PIN." },
        ]);
        setInput("");
      }
      return;
    }

    const userMsg = { role: "user" as const, content: inputText };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Send chat history minus the initial greeting if it's the only one
      const history = messages.filter((m) => m.role !== "system");

      const res = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg.content,
          matchId,
          history,
          isAdmin,
        }),
      });
      const data = await res.json();

      if (data.reply) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Error: " + data.error },
        ]);
      }
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Network Error: " + error.message },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] w-full max-w-4xl mx-auto bg-slate-900 rounded-xl border border-white/10 shadow-2xl overflow-hidden mt-6">
      <div className="p-4 bg-slate-800 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Bot className="text-indigo-400" />
          Live Match AI Assistant
        </h3>
        {isAdmin && (
          <div className="flex items-center">
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              ref={fileInputRef}
              onChange={handleRulesUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingRules}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-bold rounded-lg transition-colors border border-indigo-500/30 disabled:opacity-50"
            >
              <Upload size={14} />
              {isUploadingRules ? "Uploading..." : "Upload Rules PDF"}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-indigo-500" : "bg-slate-700"}`}
            >
              {msg.role === "user" ? (
                <User size={16} className="text-white" />
              ) : (
                <Bot size={16} className="text-indigo-300" />
              )}
            </div>
            <div
              className={`p-3 rounded-2xl max-w-[80%] ${msg.role === "user" ? "bg-indigo-600 text-white rounded-tr-none" : "bg-slate-800 text-slate-200 rounded-tl-none border border-white/5"}`}
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {msg.content}
              </p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3 flex-row">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
              <Bot size={16} className="text-indigo-300 animate-pulse" />
            </div>
            <div className="p-3 rounded-2xl bg-slate-800 text-slate-400 rounded-tl-none border border-white/5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-slate-500 animate-bounce"></div>
              <div
                className="w-2 h-2 rounded-full bg-slate-500 animate-bounce"
                style={{ animationDelay: "0.2s" }}
              ></div>
              <div
                className="w-2 h-2 rounded-full bg-slate-500 animate-bounce"
                style={{ animationDelay: "0.4s" }}
              ></div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-800 border-t border-white/10">
        <form onSubmit={sendMessage} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the match, score, or players..."
            className="w-full bg-slate-900 border border-white/10 rounded-full py-3 px-6 pr-14 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-2 p-2 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-indigo-500 transition-colors"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
