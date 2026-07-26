"use client";

import {
  Archive,
  Check,
  CircleStop,
  FileText,
  Mic,
  Plus,
  Radio,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  captureModeDetails,
  captureModes,
  getCaptureTitle,
  type CaptureMode,
  type CaptureSession,
  type CaptureSource,
  type CaptureStatus,
} from "@/domain/capture/capture";
import {
  archiveCaptureAction,
  recordMicrophoneConsentAction,
  saveCaptureAction,
} from "@/features/capture/actions";

import styles from "./capture-hub.module.css";

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type CaptureHubProps = {
  workspaceId: string;
  editable: boolean;
  deleteAudioAfterTranscription: boolean;
  initialSessions: CaptureSession[];
};

function formatSavedAt(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function CaptureHub({
  workspaceId,
  editable,
  deleteAudioAfterTranscription,
  initialSessions,
}: CaptureHubProps) {
  const firstSession = initialSessions[0] ?? null;
  const [sessions, setSessions] = useState(initialSessions);
  const [activeId, setActiveId] = useState<string | null>(firstSession?.id ?? null);
  const activeIdRef = useRef(activeId);
  const [mode, setMode] = useState<CaptureMode>(firstSession?.mode ?? "plan");
  const [source, setSource] = useState<CaptureSource>(
    firstSession?.source ?? "manual",
  );
  const [inputText, setInputText] = useState(firstSession?.inputText ?? "");
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>(
    firstSession?.status ?? "draft",
  );
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [consentOpen, setConsentOpen] = useState(false);
  const [microphoneAuthorized, setMicrophoneAuthorized] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const lastPersistedRef = useRef(
    firstSession
      ? `${firstSession.mode}:${firstSession.source}:${firstSession.status}:${firstSession.inputText}`
      : "",
  );

  const persist = useCallback(
    async (status: "draft" | "ready", quiet = false) => {
      if (!editable || !inputText.trim()) {
        if (!quiet) {
          setSaveState("error");
          setMessage("Escribe una solicitud antes de guardarla.");
        }
        return false;
      }

      const captureId = activeIdRef.current ?? crypto.randomUUID();
      if (!activeIdRef.current) {
        activeIdRef.current = captureId;
        setActiveId(captureId);
      }

      setSaveState("saving");
      if (!quiet) {
        setMessage(status === "ready" ? "Preparando entrada…" : "Guardando…");
      }

      const result = await saveCaptureAction({
        id: captureId,
        workspaceId,
        mode,
        source,
        inputText,
        status,
      });

      if (result.status === "error") {
        setSaveState("error");
        setMessage(result.message);
        return false;
      }

      const savedAt = result.savedAt ?? new Date().toISOString();
      const savedSession: CaptureSession = {
        id: captureId,
        workspaceId,
        createdBy:
          sessions.find((session) => session.id === captureId)?.createdBy ?? "",
        mode,
        source,
        inputText: inputText.trimEnd(),
        status,
        createdAt:
          sessions.find((session) => session.id === captureId)?.createdAt ??
          savedAt,
        updatedAt: savedAt,
      };

      setSessions((current) => [
        savedSession,
        ...current.filter((session) => session.id !== captureId),
      ]);
      setCaptureStatus(status);
      lastPersistedRef.current = `${mode}:${source}:${status}:${inputText}`;
      setSaveState("saved");
      setMessage(result.message);
      return true;
    },
    [editable, inputText, mode, sessions, source, workspaceId],
  );

  useEffect(() => {
    if (!editable || !inputText.trim() || captureStatus === "ready") {
      return;
    }

    const snapshot = `${mode}:${source}:draft:${inputText}`;
    if (snapshot === lastPersistedRef.current) {
      return;
    }

    setSaveState("idle");
    const timer = window.setTimeout(() => {
      void persist("draft", true);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [captureStatus, editable, inputText, mode, persist, source]);

  useEffect(
    () => () => {
      recognitionRef.current?.stop();
    },
    [],
  );

  function beginNewCapture() {
    recognitionRef.current?.stop();
    activeIdRef.current = null;
    setActiveId(null);
    setMode("plan");
    setSource("manual");
    setInputText("");
    setCaptureStatus("draft");
    setSaveState("idle");
    setMessage("");
    lastPersistedRef.current = "";
  }

  function openSession(session: CaptureSession) {
    recognitionRef.current?.stop();
    activeIdRef.current = session.id;
    setActiveId(session.id);
    setMode(session.mode);
    setSource(session.source);
    setInputText(session.inputText);
    setCaptureStatus(session.status);
    setSaveState("saved");
    setMessage(
      session.status === "ready"
        ? "Entrada lista para organizar."
        : "Borrador recuperado.",
    );
    lastPersistedRef.current = `${session.mode}:${session.source}:${session.status}:${session.inputText}`;
  }

  async function archiveCurrent() {
    if (!activeIdRef.current) {
      beginNewCapture();
      return;
    }

    const captureId = activeIdRef.current;
    setSaveState("saving");
    const result = await archiveCaptureAction({ id: captureId });
    if (result.status === "error") {
      setSaveState("error");
      setMessage(result.message);
      return;
    }

    setSessions((current) =>
      current.filter((session) => session.id !== captureId),
    );
    beginNewCapture();
  }

  function startRecognition() {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setSaveState("error");
      setMessage(
        "Este navegador no ofrece dictado. La entrada manual sigue disponible.",
      );
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "es-MX";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        if (event.results[index].isFinal) {
          transcript += event.results[index][0].transcript;
        }
      }

      if (transcript.trim()) {
        setSource(mode === "meeting" ? "meeting_transcript" : "dictation");
        setCaptureStatus("draft");
        setInputText((current) =>
          `${current}${current.trim() ? " " : ""}${transcript.trim()}`,
        );
      }
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setSaveState("error");
      setMessage("El navegador interrumpió el dictado. Puedes continuar escribiendo.");
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setMessage("Escuchando. Habla con naturalidad.");
  }

  async function authorizeMicrophone() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      const result = await recordMicrophoneConsentAction({
        workspaceId,
        captureId: activeIdRef.current,
        decision: "granted",
      });
      if (result.status === "error") {
        throw new Error(result.message);
      }
      setMicrophoneAuthorized(true);
      setConsentOpen(false);
      startRecognition();
    } catch {
      setConsentOpen(false);
      setSaveState("error");
      setMessage(
        "No se habilitó el micrófono. Revisa el permiso del navegador o continúa escribiendo.",
      );
      void recordMicrophoneConsentAction({
        workspaceId,
        captureId: activeIdRef.current,
        decision: "denied",
      });
    }
  }

  function toggleDictation() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      setMessage("Dictado detenido. La transcripción puede editarse.");
      return;
    }

    if (!microphoneAuthorized) {
      setConsentOpen(true);
      return;
    }

    startRecognition();
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p><span aria-hidden="true" /> CAPTURE / ENTRADA</p>
          <h1>Capture Hub</h1>
          <span>
            Conserva primero la intención original. La organización inteligente
            llegará después y nunca reemplazará tu texto.
          </span>
        </div>
        <div className={styles.statusStamp}>
          <Radio size={17} aria-hidden="true" />
          <span><strong>{sessions.length.toString().padStart(2, "0")}</strong> activas</span>
        </div>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.sessionRail}>
          <header>
            <div>
              <span>SESIONES</span>
              <strong>Borradores recientes</strong>
            </div>
            {editable && (
              <button type="button" onClick={beginNewCapture} aria-label="Nueva captura">
                <Plus size={16} aria-hidden="true" />
              </button>
            )}
          </header>

          <div className={styles.sessionList}>
            {sessions.length ? (
              sessions.map((session) => (
                <button
                  type="button"
                  data-active={session.id === activeId}
                  onClick={() => openSession(session)}
                  key={session.id}
                >
                  <span className={styles.sessionIcon}>
                    {session.status === "ready" ? (
                      <Check size={14} aria-hidden="true" />
                    ) : (
                      <FileText size={14} aria-hidden="true" />
                    )}
                  </span>
                  <span>
                    <strong>{getCaptureTitle(session.inputText)}</strong>
                    <small>
                      {captureModeDetails[session.mode].shortLabel} ·{" "}
                      {formatSavedAt(session.updatedAt)}
                    </small>
                  </span>
                  <em>{session.status === "ready" ? "Lista" : "Draft"}</em>
                </button>
              ))
            ) : (
              <div className={styles.emptyRail}>
                <Sparkles size={20} aria-hidden="true" />
                <strong>Primera entrada</strong>
                <span>Escribe o dicta para crear un borrador.</span>
              </div>
            )}
          </div>

          <footer>
            <ShieldCheck size={15} aria-hidden="true" />
            <span>
              <strong>Aislamiento activo</strong>
              <small>Solo integrantes del workspace</small>
            </span>
          </footer>
        </aside>

        <main className={styles.composer}>
          <div className={styles.modeBar} aria-label="Modo de captura">
            {captureModes.map((item) => (
              <button
                type="button"
                data-active={mode === item}
                disabled={!editable}
                onClick={() => {
                  setMode(item);
                  setCaptureStatus("draft");
                  if (item === "meeting" && source === "manual") {
                    setSource("meeting_transcript");
                  } else if (item !== "meeting" && source === "meeting_transcript") {
                    setSource("manual");
                  }
                }}
                key={item}
              >
                {captureModeDetails[item].shortLabel}
              </button>
            ))}
          </div>

          <section className={styles.editor}>
            <header>
              <div>
                <span>{captureModeDetails[mode].label.toUpperCase()}</span>
                <h2>{captureModeDetails[mode].description}</h2>
              </div>
              <span className={styles.saveIndicator} data-state={saveState}>
                {saveState === "saving"
                  ? "Guardando…"
                  : saveState === "saved"
                    ? "Sincronizado"
                    : saveState === "error"
                      ? "Revisar"
                      : "Autoguardado activo"}
              </span>
            </header>

            <textarea
              value={inputText}
              disabled={!editable}
              maxLength={20000}
              onChange={(event) => {
                setInputText(event.target.value);
                setCaptureStatus("draft");
                if (source !== "dictation" && mode !== "meeting") {
                  setSource("manual");
                }
              }}
              placeholder={
                mode === "standup"
                  ? "Ayer avanzamos… Hoy necesitamos… Estamos bloqueados por…"
                  : mode === "command"
                    ? "Crea un ticket para…"
                    : "Describe el trabajo con tus propias palabras…"
              }
              aria-label="Contenido de la captura"
            />

            <div className={styles.editorMeta}>
              <span>{inputText.length.toLocaleString("es-MX")} / 20,000</span>
              <span>
                Fuente ·{" "}
                {source === "dictation"
                  ? "Dictado"
                  : source === "meeting_transcript"
                    ? "Minuta"
                    : "Manual"}
              </span>
              <span>Estado · {captureStatus === "ready" ? "Lista" : "Borrador"}</span>
            </div>

            <div className={styles.voiceBar} data-listening={listening}>
              <span className={styles.micState}>
                {listening ? <CircleStop size={18} /> : <Mic size={18} />}
              </span>
              <span>
                <strong>{listening ? "Escuchando ahora" : "Dictado bajo control"}</strong>
                <small>
                  {deleteAudioAfterTranscription
                    ? "El audio no se conserva; solo queda el texto editable."
                    : "Se respeta la política de retención configurada."}
                </small>
              </span>
              {editable && (
                <button type="button" onClick={toggleDictation}>
                  {listening ? "Detener" : "Iniciar dictado"}
                </button>
              )}
            </div>

            {message && (
              <p className={styles.message} data-error={saveState === "error"}>
                {message}
              </p>
            )}
          </section>

          <footer className={styles.actions}>
            <div>
              {editable && activeId && (
                <button type="button" className={styles.archiveButton} onClick={() => void archiveCurrent()}>
                  <Archive size={15} aria-hidden="true" /> Archivar
                </button>
              )}
            </div>
            {editable ? (
              <div>
                <button type="button" onClick={() => void persist("draft")}>
                  <Save size={15} aria-hidden="true" /> Guardar borrador
                </button>
                {captureStatus === "ready" && activeId ? (
                  <Link
                    className={styles.primaryButton}
                    href={`/app/tickets/new?capture=${activeId}`}
                  >
                    Organizar entrada <Send size={15} aria-hidden="true" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => void persist("ready")}
                  >
                    Lista para organizar <Send size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
            ) : (
              <span className={styles.viewerNotice}>
                Tu rol Viewer permite consultar, no crear capturas.
              </span>
            )}
          </footer>
        </main>
      </div>

      {consentOpen && (
        <div className={styles.consentBackdrop} role="presentation">
          <section
            className={styles.consentDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="microphone-consent-title"
          >
            <span className={styles.consentIcon}><Mic size={23} /></span>
            <p>PRIVACIDAD / MICRÓFONO</p>
            <h2 id="microphone-consent-title">Tú decides cuándo escuchamos.</h2>
            <span>
              El navegador solicitará acceso al micrófono exclusivamente para
              convertir tu voz en texto. TicketRoute no cargará ni conservará
              el audio en este bloque.
            </span>
            <ul>
              <li><Check size={13} /> Inicio y detención manual</li>
              <li><Check size={13} /> Transcripción editable</li>
              <li><Check size={13} /> Consentimiento registrado</li>
            </ul>
            <div>
              <button
                type="button"
                onClick={() => {
                  setConsentOpen(false);
                  void recordMicrophoneConsentAction({
                    workspaceId,
                    captureId: activeIdRef.current,
                    decision: "denied",
                  });
                }}
              >
                Ahora no
              </button>
              <button type="button" className={styles.primaryButton} onClick={() => void authorizeMicrophone()}>
                Autorizar micrófono
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
