"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Ditado por voz na descrição do relato, com o reconhecimento de voz do próprio
 * navegador (Web Speech API).
 *
 * Privacidade — o que NÃO muda e o que muda:
 *  - O canal nunca recebe nem guarda o áudio: só o texto que vai para a caixa.
 *  - Mas, para transcrever, o navegador/aparelho PODE enviar o áudio ao fabricante
 *    (Google no Chrome, Apple no Safari). Por isso o primeiro uso passa por um
 *    aviso (`DictationConsent`) e o ditado é sempre opcional.
 *  - Nada é guardado no navegador: o "já li o aviso" vive só em memória, na aba.
 *
 * O botão só existe onde o navegador oferece o reconhecimento de voz (Firefox, por
 * exemplo, não oferece): nesse caso a pessoa digita normalmente.
 */

interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: RecognitionAlternative;
}
interface RecognitionResultEvent {
  resultIndex: number;
  results: { length: number; [index: number]: RecognitionResult };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const subscribe = () => () => {};

/** `false` no servidor e na primeira pintura; vira `true` só se o navegador oferece voz. */
export function useDictationSupported(): boolean {
  return useSyncExternalStore(subscribe, () => getCtor() !== null, () => false);
}

/** O aviso de privacidade já foi aceito nesta aba? Só em memória — nada vai para o armazenamento. */
let consentGiven = false;
export function hasDictationConsent(): boolean {
  return consentGiven;
}
export function giveDictationConsent(): void {
  consentGiven = true;
}

function join(base: string, addition: string): string {
  if (!base) return addition.trimStart();
  if (!addition) return base;
  return `${/\s$/.test(base) ? base : `${base} `}${addition.trimStart()}`;
}

function errorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Não foi possível usar o microfone. Verifique a permissão do navegador ou digite normalmente.";
    case "network":
      return "O reconhecimento de voz precisa de conexão com a internet. Tente de novo ou digite normalmente.";
    case "audio-capture":
      return "Nenhum microfone foi encontrado. Você pode digitar normalmente.";
    default:
      return "O reconhecimento de voz parou. Você pode tentar de novo ou digitar normalmente.";
  }
}

export function useDictation({
  text,
  onText,
  maxLength,
}: {
  text: string;
  onText: (value: string) => void;
  maxLength: number;
}) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsReview, setNeedsReview] = useState(false);

  const wanted = useRef(false);
  const recognition = useRef<Recognition | null>(null);
  const textRef = useRef(text);
  const base = useRef("");
  const confirmed = useRef("");

  // Sempre o texto mais recente, para a próxima rodada de escuta partir do que a pessoa editou.
  useEffect(() => {
    textRef.current = text;
  }, [text]);

  const stop = useCallback(() => {
    wanted.current = false;
    recognition.current?.stop();
    setListening(false);
    if (textRef.current.trim()) setNeedsReview(true);
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    setError(null);
    setNeedsReview(false);

    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;

    base.current = textRef.current;
    confirmed.current = "";

    rec.onresult = event => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) confirmed.current += result[0].transcript;
        else interim += result[0].transcript;
      }
      onText(join(base.current, confirmed.current + interim).slice(0, maxLength));
    };
    rec.onerror = event => {
      // Silêncio e cancelamento são normais; qualquer outro erro encerra e avisa.
      if (event.error === "no-speech" || event.error === "aborted") return;
      wanted.current = false;
      setListening(false);
      setError(errorMessage(event.error));
    };
    rec.onend = () => {
      // O Chrome encerra sozinho depois de um silêncio: recomeça enquanto a pessoa não parou.
      if (wanted.current) {
        base.current = textRef.current;
        confirmed.current = "";
        try {
          rec.start();
          return;
        } catch {
          wanted.current = false;
        }
      }
      setListening(false);
    };

    recognition.current = rec;
    wanted.current = true;
    try {
      rec.start();
      setListening(true);
    } catch {
      wanted.current = false;
      setError(errorMessage("other"));
    }
  }, [onText, maxLength]);

  // Sair da etapa (ou da página) desliga o microfone.
  useEffect(() => {
    return () => {
      wanted.current = false;
      recognition.current?.stop();
    };
  }, []);

  return { listening, error, needsReview, start, stop };
}
