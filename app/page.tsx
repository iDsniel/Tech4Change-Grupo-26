"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, FileText, Mic, Send, Sparkles, Upload, X, ClipboardList, ShieldCheck } from "lucide-react";
import { sampleProcedure } from "@/lib/demo";

type Message = { role: "user" | "assistant"; text: string; demo?: boolean };

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

export default function Home() {
  const [manual, setManual] = useState(sampleProcedure);
  const [manualName, setManualName] = useState("procedimento-demo.txt");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Procedimento demo carregado. Pergunte por voz ou texto, ou envie uma foto do contexto." }
  ]);
  const [imageDataUrl, setImageDataUrl] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [report, setReport] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const canSend = useMemo(() => question.trim().length > 0 && !busy, [question, busy]);

  async function loadManual(file?: File) {
    if (!file) return;
    const text = await file.text();
    setManual(text);
    setManualName(file.name);
    setMessages([{ role: "assistant", text: `Procedimento “${file.name}” carregado. O que você precisa fazer?` }]);
  }

  async function loadPhoto(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  function startVoice() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      alert("Reconhecimento de voz não suportado neste navegador. Use o campo de texto.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event: any) => setQuestion(event.results[0][0].transcript);
    recognition.start();
  }

  async function ask() {
    const q = question.trim();
    if (!q || busy) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setQuestion("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, manual, imageDataUrl })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao consultar assistente");
      setMessages((m) => [...m, { role: "assistant", text: data.answer, demo: data.demo }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", text: `Não consegui responder: ${e.message}` }]);
    } finally {
      setBusy(false);
    }
  }

  async function generateReport() {
    setBusy(true);
    try {
      const res = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript: messages }) });
      const data = await res.json();
      setReport(data.report || "");
    } finally { setBusy(false); }
  }

  return (
    <main>
      <section className="shell">
        <header className="topbar">
          <div>
            <div className="eyebrow">TECH4CHANGE 2026 · GRUPO 26</div>
            <h1>MãoLivre <span>AI</span></h1>
            <p>Conhecimento técnico no momento da execução.</p>
          </div>
          <div className="status"><span></span> copiloto ativo</div>
        </header>

        <section className="procedureCard">
          <div className="icon"><FileText size={22} /></div>
          <div className="grow"><strong>Procedimento ativo</strong><small>{manualName}</small></div>
          <button className="secondary" onClick={() => fileInputRef.current?.click()}><Upload size={16}/> Trocar</button>
          <input ref={fileInputRef} hidden type="file" accept=".txt,.md,.csv,.json" onChange={(e) => loadManual(e.target.files?.[0])}/>
        </section>

        <div className="chat" ref={scrollRef}>
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              {m.role === "assistant" && <div className="aiMark"><Sparkles size={14}/> IA</div>}
              <div>{m.text}</div>
              {m.demo && <small className="demoTag">modo demonstração</small>}
            </div>
          ))}
          {busy && <div className="bubble assistant typing">Analisando procedimento…</div>}
        </div>

        {imageDataUrl && (
          <div className="photoPreview">
            <img src={imageDataUrl} alt="Contexto enviado"/>
            <div><strong>Foto anexada</strong><small>A IA usará a imagem apenas como contexto complementar.</small></div>
            <button onClick={() => setImageDataUrl(undefined)}><X size={18}/></button>
          </div>
        )}

        <section className="composer">
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ex.: Qual é o primeiro passo?" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); }}} />
          <div className="actions">
            <button className={listening ? "tool listening" : "tool"} onClick={startVoice}><Mic size={20}/><span>{listening ? "Ouvindo…" : "Falar"}</span></button>
            <button className="tool" onClick={() => photoInputRef.current?.click()}><Camera size={20}/><span>Foto</span></button>
            <input ref={photoInputRef} hidden type="file" accept="image/*" capture="environment" onChange={(e) => loadPhoto(e.target.files?.[0])}/>
            <button className="send" disabled={!canSend} onClick={ask}><Send size={20}/></button>
          </div>
        </section>

        <div className="footerActions">
          <button onClick={generateReport} disabled={busy}><ClipboardList size={18}/> Gerar relatório do atendimento</button>
        </div>

        {report && <section className="report"><div className="reportTitle"><ClipboardList size={18}/> Relatório</div><pre>{report}</pre></section>}

        <section className="guardrail"><ShieldCheck size={17}/><p>O assistente responde apenas com base no procedimento carregado. Condições não previstas devem ser escaladas ao responsável técnico.</p></section>
      </section>
    </main>
  );
}
