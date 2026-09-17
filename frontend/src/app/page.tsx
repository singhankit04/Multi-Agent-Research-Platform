"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  Clock,
  ExternalLink,
  FileText,
  Layers,
  Terminal,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  History,
  Plus,
} from "lucide-react";
import type { PipelineFinalOutput, ApiResponse } from "../types";

const SAMPLE_QUERIES = [
  "Quantum advantage in post-quantum cryptography",
  "Solid-state battery electrolyte developments in 2025",
  "Mechanistic interpretability in large reasoning models",
  "Autonomous agent architectures and memory systems",
];

const BACKEND_URL = process.env.BACKEND_URL

export default function Home() {
  const [topic, setTopic] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [apiUrl] = useState(BACKEND_URL);
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [result, setResult] = useState<PipelineFinalOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"report" | "pipeline" | "critique" | "sources">("report");
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<Array<{ topic: string; timestamp: string; data: PipelineFinalOutput }>>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({
    research: true,
    scrape: false,
    writer: false,
    critic: false,
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const stepTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("research_history");
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Check backend health
  const checkHealth = async (urlToCheck = apiUrl) => {
    setBackendStatus("checking");
    try {
      const res = await fetch(`${urlToCheck}/health`, { method: "GET" });
      if (res.ok) {
        setBackendStatus("online");
      } else {
        setBackendStatus("offline");
      }
    } catch {
      setBackendStatus("offline");
    }
  };

  useEffect(() => {
    checkHealth(apiUrl);
  }, [apiUrl]);

  // Handle live elapsed timer during active research
  useEffect(() => {
    if (isLoading) {
      setElapsedSeconds(0);
      setCurrentStepIndex(0);

      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      // Simulate step progression for UX feedback while awaiting backend response
      stepTimerRef.current = setInterval(() => {
        setCurrentStepIndex((prev) => (prev < 3 ? prev + 1 : prev));
      }, 4500);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, [isLoading]);

  const handleSubmit = async (queryToRun?: string) => {
    const q = (queryToRun !== undefined ? queryToRun : topic).trim();
    if (!q || isLoading) return;

    setActiveQuery(q);
    setHasStarted(true);
    setIsLoading(true);
    setError(null);
    setResult(null);
    setActiveTab("report");

    try {
      const res = await fetch(`${apiUrl}/api/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: q }),
      });

      const json: ApiResponse = await res.json();

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || "Failed to execute research pipeline.");
      }

      setResult(json.data);

      // Save to history
      const newEntry = {
        topic: q,
        timestamp: new Date().toISOString(),
        data: json.data,
      };
      setHistory((prev) => {
        const updated = [newEntry, ...prev.filter((item) => item.topic !== q)].slice(0, 10);
        try {
          localStorage.setItem("research_history", JSON.stringify(updated));
        } catch {
          // Ignore storage quota
        }
        return updated;
      });
    } catch (err: any) {
      setError(
        err.message ||
          "Could not connect to backend server. Make sure the backend is running on " +
            apiUrl
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetNewChat = () => {
    setHasStarted(false);
    setIsLoading(false);
    setResult(null);
    setError(null);
    setTopic("");
    setActiveQuery("");
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadReport = (content: string, filenameTopic: string) => {
    const cleanName = filenameTopic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40);
    const element = document.createElement("a");
    const file = new Blob([content], { type: "text/markdown" });
    element.href = URL.createObjectURL(file);
    element.download = `${cleanName || "research-report"}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const toggleStep = (stepKey: string) => {
    setExpandedSteps((prev) => ({
      ...prev,
      [stepKey]: !prev[stepKey],
    }));
  };

  const pipelineStages = [
    { name: "Research Agent", role: "Search and discovery" },
    { name: "Scrape Agent", role: "Content extraction" },
    { name: "Writer Chain", role: "Synthesis and drafting" },
    { name: "Critic Chain", role: "Review and scoring" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 font-sans">
      {/* Top Navigation */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-2.5 h-2.5 bg-zinc-100 rounded-xs" />
            <div className="flex items-center space-x-2 font-mono text-xs tracking-wider uppercase text-zinc-300">
              <span className="font-semibold text-white">RESEARCH ENGINE</span>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-400">MULTI-AGENT SYSTEM</span>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            {/* Backend connection indicator */}
            <button
              onClick={() => checkHealth(apiUrl)}
              title="Click to recheck backend connection"
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/60 transition-colors text-zinc-400"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  backendStatus === "online"
                    ? "bg-emerald-500"
                    : backendStatus === "checking"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-rose-500"
                }`}
              />
              <span className="font-mono text-[11px]">
                {backendStatus === "online"
                  ? "API READY"
                  : backendStatus === "checking"
                  ? "CHECKING"
                  : "DISCONNECTED"}
              </span>
            </button>

            {/* History Toggle */}
            {history.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center space-x-1 px-2.5 py-1 rounded border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/60 transition-colors text-zinc-300"
              >
                <History className="w-3.5 h-3.5" />
                <span className="font-mono text-[11px]">HISTORY ({history.length})</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col space-y-6">
        {/* History drawer */}
        {showHistory && history.length > 0 && (
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-lg p-4 mb-2">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800">
              <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                Recent Queries
              </span>
              <button
                onClick={() => {
                  setHistory([]);
                  localStorage.removeItem("research_history");
                }}
                className="text-[11px] font-mono text-zinc-500 hover:text-zinc-300"
              >
                Clear History
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {history.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setTopic(item.topic);
                    setActiveQuery(item.topic);
                    setResult(item.data);
                    setHasStarted(true);
                    setError(null);
                    setShowHistory(false);
                  }}
                  className="text-left px-3 py-2 rounded bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700 transition-colors text-xs text-zinc-300 flex flex-col justify-between"
                >
                  <span className="truncate font-medium">{item.topic}</span>
                  <span className="text-[10px] font-mono text-zinc-500 mt-1">
                    {new Date(item.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conditional Header: Initial Query Input Box VS Squeezed Query Bar */}
        {!hasStarted ? (
          /* Initial State: Expanded Research Query & Statement Box with generous padding & margins */
          <div className="w-full max-w-5xl mx-auto py-4 sm:py-8">
            <section className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-6 sm:p-8 md:p-10 shadow-lg space-y-6">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="research-query-input"
                  className="text-xs font-mono text-zinc-400 tracking-wider uppercase"
                >
                  Research Query or Statement
                </label>
                {topic && (
                  <button
                    onClick={() => {
                      setTopic("");
                      if (textareaRef.current) textareaRef.current.focus();
                    }}
                    className="text-xs text-zinc-500 hover:text-zinc-300 font-mono transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="relative">
                <textarea
                  id="research-query-input"
                  ref={textareaRef}
                  rows={4}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Paste or type a topic, research question, or thesis to analyze..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 sm:p-5 text-sm sm:text-base text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 font-sans resize-y transition-colors leading-relaxed min-h-[130px]"
                />
              </div>

              {/* Quick query sample chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-mono text-zinc-500 mr-1">Examples:</span>
                {SAMPLE_QUERIES.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setTopic(q);
                      if (textareaRef.current) {
                        textareaRef.current.focus();
                      }
                    }}
                    disabled={isLoading}
                    className="text-xs font-mono bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80 hover:border-zinc-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Action Row */}
              <div className="flex items-center justify-between pt-4 border-t border-zinc-800/60">
                <span className="text-xs font-mono text-zinc-500">
                  Press <kbd className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-400 font-mono">Ctrl + Enter</kbd> to execute
                </span>

                <button
                  onClick={() => handleSubmit()}
                  disabled={!topic.trim() || isLoading}
                  className="flex items-center space-x-2 bg-zinc-100 hover:bg-white text-zinc-950 disabled:bg-zinc-800 disabled:text-zinc-500 px-6 py-2.5 rounded-xl font-medium text-xs sm:text-sm tracking-wide transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed"
                >
                  <span>Run Pipeline</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </section>
          </div>
        ) : (
          /* Squeezed State: Compact Query Header Bar + New Chat Button */
          <section className="border border-zinc-800 bg-zinc-900/50 rounded-xl px-5 py-3.5 flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center space-x-3 overflow-hidden">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 shrink-0">
                QUERY:
              </span>
              <span className="text-sm font-medium text-zinc-100 truncate">
                {activeQuery}
              </span>
            </div>

            <button
              onClick={handleResetNewChat}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-zinc-700/80 bg-zinc-800/80 hover:bg-zinc-700 hover:text-white text-zinc-200 text-xs font-mono transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Chat</span>
            </button>
          </section>
        )}

        {/* Live Execution Status & Pipeline Progression */}
        {isLoading && (
          <section className="border border-zinc-800 bg-zinc-900/50 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-2 h-2 bg-zinc-300 rounded-full animate-ping" />
                <span className="font-mono text-xs text-zinc-300 uppercase tracking-wider">
                  Sequential Multi-Agent Pipeline Active
                </span>
              </div>
              <div className="flex items-center space-x-1.5 font-mono text-xs text-zinc-400">
                <Clock className="w-3.5 h-3.5" />
                <span>{elapsedSeconds}s elapsed</span>
              </div>
            </div>

            {/* Stepped progression grid */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
              {pipelineStages.map((stage, idx) => {
                const isCurrent = currentStepIndex === idx;
                const isDone = currentStepIndex > idx;

                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border transition-colors ${
                      isCurrent
                        ? "bg-zinc-900 border-zinc-600 text-zinc-100"
                        : isDone
                        ? "bg-zinc-950/60 border-zinc-800 text-zinc-400"
                        : "bg-zinc-950/30 border-zinc-800/40 text-zinc-600"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] text-zinc-500">
                        0{idx + 1}
                      </span>
                      {isCurrent ? (
                        <div className="w-2 h-2 bg-zinc-200 rounded-full animate-pulse" />
                      ) : isDone ? (
                        <Check className="w-3 h-3 text-zinc-400" />
                      ) : null}
                    </div>
                    <div className="text-xs font-semibold">{stage.name}</div>
                    <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                      {stage.role}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Error Notice */}
        {error && (
          <section className="border border-rose-900/60 bg-rose-950/20 rounded-xl p-4 flex items-start space-x-3 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold mb-0.5">Pipeline Execution Error</div>
              <div className="text-rose-400/90 font-mono">{error}</div>
            </div>
            <button
              onClick={() => handleSubmit(activeQuery)}
              className="px-2.5 py-1 bg-rose-900/40 hover:bg-rose-900/60 text-rose-200 rounded text-xs font-mono border border-rose-800/60"
            >
              Retry
            </button>
          </section>
        )}

        {/* Results Container */}
        {result && (
          <section className="border border-zinc-800 bg-zinc-900/40 rounded-xl overflow-hidden shadow-sm">
            {/* Report Header Bar */}
            <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-900/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                    STATUS: {result.status}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500">
                    Duration: {(result.totalDurationMs / 1000).toFixed(2)}s
                  </span>
                  {result.sources && (
                    <span className="text-[11px] font-mono text-zinc-500">
                      Sources: {result.sources.length}
                    </span>
                  )}
                </div>
                <h1 className="text-base font-semibold text-zinc-100 tracking-tight">
                  {result.topic}
                </h1>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => copyToClipboard(result.finalReport || "")}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-zinc-700/80 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs font-mono transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Report</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => downloadReport(result.finalReport || "", result.topic)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-zinc-700/80 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs font-mono transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .md</span>
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="px-5 border-b border-zinc-800 flex space-x-6 text-xs font-mono">
              <button
                onClick={() => setActiveTab("report")}
                className={`py-3 border-b-2 font-medium transition-colors flex items-center space-x-1.5 ${
                  activeTab === "report"
                    ? "border-zinc-100 text-white"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>FINAL REPORT</span>
              </button>

              <button
                onClick={() => setActiveTab("pipeline")}
                className={`py-3 border-b-2 font-medium transition-colors flex items-center space-x-1.5 ${
                  activeTab === "pipeline"
                    ? "border-zinc-100 text-white"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>PIPELINE STEPS</span>
              </button>

              {result.critique && (
                <button
                  onClick={() => setActiveTab("critique")}
                  className={`py-3 border-b-2 font-medium transition-colors flex items-center space-x-1.5 ${
                    activeTab === "critique"
                      ? "border-zinc-100 text-white"
                      : "border-transparent text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>CRITIQUE REVIEW</span>
                </button>
              )}

              {result.sources && result.sources.length > 0 && (
                <button
                  onClick={() => setActiveTab("sources")}
                  className={`py-3 border-b-2 font-medium transition-colors flex items-center space-x-1.5 ${
                    activeTab === "sources"
                      ? "border-zinc-100 text-white"
                      : "border-transparent text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>SOURCES ({result.sources.length})</span>
                </button>
              )}
            </div>

            {/* Tab 1: Final Markdown Report */}
            {activeTab === "report" && (
              <div className="p-6 sm:p-8 bg-zinc-950/60">
                {result.finalReport ? (
                  <div className="markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {result.finalReport}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-zinc-500 font-mono text-xs">
                    No final report generated. Check the pipeline steps.
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Detailed Pipeline Inspection */}
            {activeTab === "pipeline" && (
              <div className="p-6 space-y-4 bg-zinc-950/60">
                {/* Step 1: Research Agent */}
                {result.steps?.researchAgent && (
                  <div className="border border-zinc-800 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleStep("research")}
                      className="w-full px-4 py-3 bg-zinc-900/70 hover:bg-zinc-900 flex items-center justify-between text-xs font-mono text-zinc-300 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-zinc-100">
                          01. Research Agent (Tavily Search)
                        </span>
                        <span className="text-zinc-500">
                          {result.steps.researchAgent.durationMs}ms
                        </span>
                      </div>
                      {expandedSteps.research ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </button>
                    {expandedSteps.research && (
                      <div className="p-4 bg-zinc-950 text-xs space-y-3 font-sans border-t border-zinc-800">
                        <div>
                          <div className="text-[11px] font-mono text-zinc-500 uppercase mb-1">
                            Discovered Links ({result.steps.researchAgent.links?.length || 0})
                          </div>
                          <ul className="space-y-1 font-mono text-[11px]">
                            {result.steps.researchAgent.links?.map((link, i) => (
                              <li key={i}>
                                <a
                                  href={link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-zinc-400 hover:text-zinc-200 underline truncate block"
                                >
                                  {link}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <div className="text-[11px] font-mono text-zinc-500 uppercase mb-1">
                            Preliminary Findings Summary
                          </div>
                          <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800/80 text-zinc-300 leading-relaxed whitespace-pre-wrap">
                            {result.steps.researchAgent.summary}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2: Scrape Agent */}
                {result.steps?.scrapeAgent && (
                  <div className="border border-zinc-800 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleStep("scrape")}
                      className="w-full px-4 py-3 bg-zinc-900/70 hover:bg-zinc-900 flex items-center justify-between text-xs font-mono text-zinc-300 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-zinc-100">
                          02. Scrape Agent (Deep URL Extraction)
                        </span>
                        <span className="text-zinc-500">
                          {result.steps.scrapeAgent.durationMs}ms
                        </span>
                      </div>
                      {expandedSteps.scrape ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </button>
                    {expandedSteps.scrape && (
                      <div className="p-4 bg-zinc-950 text-xs space-y-3 font-sans border-t border-zinc-800">
                        <div>
                          <div className="text-[11px] font-mono text-zinc-500 uppercase mb-1">
                            Scraped Target URLs
                          </div>
                          <ul className="space-y-1 font-mono text-[11px]">
                            {result.steps.scrapeAgent.targetUrls?.map((url, i) => (
                              <li key={i}>
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-zinc-400 hover:text-zinc-200 underline truncate block"
                                >
                                  {url}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <div className="text-[11px] font-mono text-zinc-500 uppercase mb-1">
                            Synthesized Extraction Content
                          </div>
                          <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800/80 text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
                            {result.steps.scrapeAgent.scrapedSummary}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Writer Chain */}
                {result.steps?.writerChain && (
                  <div className="border border-zinc-800 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleStep("writer")}
                      className="w-full px-4 py-3 bg-zinc-900/70 hover:bg-zinc-900 flex items-center justify-between text-xs font-mono text-zinc-300 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-zinc-100">
                          03. Writer Chain (LCEL Synthesis)
                        </span>
                        <span className="text-zinc-500">
                          {result.steps.writerChain.durationMs}ms
                        </span>
                      </div>
                      {expandedSteps.writer ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </button>
                    {expandedSteps.writer && (
                      <div className="p-4 bg-zinc-950 text-xs font-sans border-t border-zinc-800">
                        <div className="text-[11px] font-mono text-zinc-500 uppercase mb-1">
                          Draft Output
                        </div>
                        <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800/80 text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
                          {result.steps.writerChain.report}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 4: Critic Chain */}
                {result.steps?.criticChain && (
                  <div className="border border-zinc-800 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleStep("critic")}
                      className="w-full px-4 py-3 bg-zinc-900/70 hover:bg-zinc-900 flex items-center justify-between text-xs font-mono text-zinc-300 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-zinc-100">
                          04. Critic Chain (Editorial Review)
                        </span>
                        <span className="text-zinc-500">
                          {result.steps.criticChain.durationMs}ms
                        </span>
                      </div>
                      {expandedSteps.critic ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </button>
                    {expandedSteps.critic && (
                      <div className="p-4 bg-zinc-950 text-xs font-sans border-t border-zinc-800">
                        <div className="text-[11px] font-mono text-zinc-500 uppercase mb-1">
                          Critique and Quality Score
                        </div>
                        <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800/80 text-zinc-300 leading-relaxed whitespace-pre-wrap">
                          {result.steps.criticChain.critique}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Critique Review */}
            {activeTab === "critique" && (
              <div className="p-6 sm:p-8 bg-zinc-950/60">
                <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40">
                  <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-3">
                    Editorial Critique and Quality Assessment
                  </div>
                  <div className="markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {result.critique || "No critique available."}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Sources and References */}
            {activeTab === "sources" && (
              <div className="p-6 bg-zinc-950/60">
                <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-4">
                  Referenced Source Documents ({result.sources?.length || 0})
                </div>
                <div className="space-y-2">
                  {result.sources?.map((sourceUrl, idx) => {
                    let domain = sourceUrl;
                    try {
                      domain = new URL(sourceUrl).hostname;
                    } catch {
                      // fallback
                    }

                    return (
                      <a
                        key={idx}
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 hover:border-zinc-700 transition-colors group"
                      >
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <span className="font-mono text-xs text-zinc-500">
                            0{idx + 1}
                          </span>
                          <span className="text-xs text-zinc-200 group-hover:text-white truncate">
                            {sourceUrl}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0 ml-3">
                          <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/60">
                            {domain}
                          </span>
                          <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 py-4 mt-auto text-center text-zinc-500 font-mono text-[11px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-center">
          <span>Multi-Agent Research Pipeline</span>
        </div>
      </footer>
    </div>
  );
}
