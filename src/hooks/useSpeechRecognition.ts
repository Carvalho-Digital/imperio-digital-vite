import { useCallback, useEffect, useRef, useState } from 'react';

type RecogState = 'idle' | 'listening' | 'unsupported' | 'denied' | 'error';

interface SpeechRecognitionAlternative { transcript: string; confidence: number; }
interface SpeechRecognitionResult { 0: SpeechRecognitionAlternative; isFinal: boolean; length: number; }
interface SpeechRecognitionResultList { 0: SpeechRecognitionResult; length: number; item(i: number): SpeechRecognitionResult; }
interface SpeechRecognitionEvent extends Event { resultIndex: number; results: SpeechRecognitionResultList; }
interface SpeechRecognitionErrorEvent extends Event { error: string; }
interface SpeechRecognitionInstance extends EventTarget {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export interface UseSpeechRecognitionReturn {
  state: RecogState;
  transcript: string;
  interim: string;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useSpeechRecognition(lang = 'pt-BR'): UseSpeechRecognitionReturn {
  const [state, setState] = useState<RecogState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const recRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) { setState('unsupported'); return; }
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let finalText = '';
      let interimText = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results.item(i);
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (finalText) setTranscript(prev => (prev + ' ' + finalText).trim());
      setInterim(interimText);
    };
    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') setState('denied');
      else setState('error');
    };
    rec.onend = () => setState(s => (s === 'listening' ? 'idle' : s));
    recRef.current = rec;
    return () => { try { rec.abort(); } catch { /* noop */ } };
  }, [lang]);

  const start = useCallback(() => {
    const rec = recRef.current;
    if (!rec || state === 'unsupported') return;
    setTranscript('');
    setInterim('');
    try { rec.start(); setState('listening'); } catch { /* já rodando */ }
  }, [state]);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    try { rec.stop(); } catch { /* noop */ }
    setState('idle');
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setInterim('');
  }, []);

  return { state, transcript, interim, start, stop, reset };
}
