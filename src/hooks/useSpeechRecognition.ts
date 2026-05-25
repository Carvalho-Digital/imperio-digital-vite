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
  errorMessage: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

const LOG_PREFIX = '[speech]';

export function useSpeechRecognition(lang = 'pt-BR'): UseSpeechRecognitionReturn {
  const [state, setState] = useState<RecogState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  // Pra debug: timestamp do start, pra ver se onend dispara imediatamente
  const startTsRef = useRef<number>(0);

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      console.warn(`${LOG_PREFIX} Web Speech API não suportada neste navegador`);
      setState('unsupported');
      return;
    }
    const rec = new Ctor();
    rec.lang = lang;
    // continuous: false costuma ser mais estável em Edge/Mac.
    // Se quiser sessões longas, mude pra true (mais sujeito a bug em Edge).
    rec.continuous = false;
    rec.interimResults = true;

    rec.onresult = (ev) => {
      let finalText = '';
      let interimText = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results.item(i);
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (finalText) {
        console.log(`${LOG_PREFIX} final:`, finalText);
        setTranscript(prev => (prev + ' ' + finalText).trim());
      }
      if (interimText) console.log(`${LOG_PREFIX} interim:`, interimText);
      setInterim(interimText);
    };

    rec.onerror = (ev) => {
      const err = ev.error;
      console.error(`${LOG_PREFIX} erro:`, err);
      // Mensagens humanas pros erros mais comuns
      const msg: Record<string, string> = {
        'not-allowed': 'Permissão de microfone negada. Libere nas configurações do navegador.',
        'service-not-allowed': 'Serviço de reconhecimento de voz não permitido.',
        'no-speech': 'Não detectei áudio. Fale mais perto do microfone e tente de novo.',
        'audio-capture': 'Não consegui acessar o microfone. Verifique se outro app não está usando.',
        'network': 'Problema de rede no reconhecimento de voz. Tente de novo.',
        'aborted': 'Gravação interrompida.',
        'language-not-supported': `Idioma ${lang} não suportado neste navegador. Tente em outro navegador (Chrome funciona melhor).`,
      };
      setErrorMessage(msg[err] ?? `Erro: ${err}`);
      if (err === 'not-allowed' || err === 'service-not-allowed') setState('denied');
      else setState('error');
    };

    rec.onend = () => {
      const dur = Date.now() - startTsRef.current;
      console.log(`${LOG_PREFIX} onend após ${dur}ms`);
      // Se rolou em menos de 500ms sem áudio capturado, provável bug Edge/Mac
      if (dur > 0 && dur < 500) {
        console.warn(`${LOG_PREFIX} onend muito rápido (${dur}ms) — possível bug Edge/Mac. Web Speech API encerrou sem capturar.`);
      }
      setState(s => (s === 'listening' ? 'idle' : s));
    };

    recRef.current = rec;
    return () => { try { rec.abort(); } catch { /* noop */ } };
  }, [lang]);

  const start = useCallback(() => {
    const rec = recRef.current;
    if (!rec || state === 'unsupported') return;
    console.log(`${LOG_PREFIX} start (lang=${lang})`);
    setTranscript('');
    setInterim('');
    setErrorMessage(null);
    startTsRef.current = Date.now();
    try {
      rec.start();
      setState('listening');
    } catch (e) {
      console.error(`${LOG_PREFIX} falha ao iniciar:`, e);
      setErrorMessage('Não consegui iniciar a gravação. Tente recarregar a página.');
    }
  }, [state, lang]);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    console.log(`${LOG_PREFIX} stop chamado pelo usuário`);
    try { rec.stop(); } catch { /* noop */ }
    setState('idle');
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setInterim('');
    setErrorMessage(null);
  }, []);

  return { state, transcript, interim, errorMessage, start, stop, reset };
}
