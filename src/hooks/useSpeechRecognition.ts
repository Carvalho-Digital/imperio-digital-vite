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

/**
 * Detecta combinações de navegador + SO conhecidas por ter problemas
 * com Web Speech API. Retorna um aviso quando há problema esperado.
 */
export function detectVoiceCompatibilityWarning(): string | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  const platform = navigator.platform || '';
  const isMac = /Mac|iPhone|iPad/.test(platform) || /Macintosh/.test(ua);
  const isEdge = / Edg\//.test(ua);
  const isFirefox = /Firefox\//.test(ua);

  if (isFirefox) {
    return 'Firefox não suporta reconhecimento de voz. Use Chrome ou Safari pra falar com o agente.';
  }
  if (isEdge && isMac) {
    return 'Edge no Mac tem problemas conhecidos com reconhecimento de voz (erro de rede com servidor da Microsoft). Use Chrome ou Safari pra funcionar bem.';
  }
  return null;
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
  // Flag pra controlar auto-reinicio: TRUE = usuário quer continuar gravando.
  // Quando o navegador encerra a sessão sozinho (pausa natural na fala), reinicia automaticamente.
  // Só vira FALSE quando o usuário clica em "parar" manualmente.
  const wantsListeningRef = useRef<boolean>(false);

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      console.warn(`${LOG_PREFIX} Web Speech API não suportada neste navegador`);
      setState('unsupported');
      return;
    }
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;       // captura sessão longa
    rec.interimResults = true;   // mostra resultados parciais enquanto fala

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
      const msg: Record<string, string> = {
        'not-allowed': 'Permissão de microfone negada. Libere nas configurações do navegador.',
        'service-not-allowed': 'Serviço de reconhecimento de voz não permitido.',
        'no-speech': 'Não detectei áudio. Fale mais perto do microfone e tente de novo.',
        'audio-capture': 'Não consegui acessar o microfone. Verifique se outro app não está usando.',
        'network': 'Problema de rede no reconhecimento de voz. Tente de novo.',
        'aborted': 'Gravação interrompida.',
        'language-not-supported': `Idioma ${lang} não suportado neste navegador. Tente em outro navegador (Chrome funciona melhor).`,
      };
      // Erros que devem PARAR de vez (não tentar reiniciar)
      const fatal = ['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'];
      if (fatal.includes(err)) {
        wantsListeningRef.current = false;
        setErrorMessage(msg[err] ?? `Erro: ${err}`);
        if (err === 'not-allowed' || err === 'service-not-allowed') setState('denied');
        else setState('error');
      } else if (err === 'no-speech' || err === 'aborted') {
        // Erros leves — não mostra mensagem, deixa o onend tratar (auto-restart se for o caso)
        console.log(`${LOG_PREFIX} erro leve ignorado: ${err} (deixando onend reiniciar se ainda estiver listening)`);
      } else {
        setErrorMessage(msg[err] ?? `Erro: ${err}`);
        wantsListeningRef.current = false;
        setState('error');
      }
    };

    rec.onend = () => {
      const dur = Date.now() - startTsRef.current;
      console.log(`${LOG_PREFIX} onend após ${dur}ms (wantsListening=${wantsListeningRef.current})`);

      // AUTO-REINÍCIO: se o usuário ainda quer gravar mas o navegador parou sozinho
      // (pausa natural na fala, timeout interno do Chrome, etc), reinicia.
      if (wantsListeningRef.current) {
        try {
          startTsRef.current = Date.now();
          rec.start();
          console.log(`${LOG_PREFIX} auto-reiniciado`);
          return;
        } catch (e) {
          console.warn(`${LOG_PREFIX} falha no auto-restart:`, e);
        }
      }

      setState(s => (s === 'listening' ? 'idle' : s));
    };

    recRef.current = rec;
    return () => {
      wantsListeningRef.current = false;
      try { rec.abort(); } catch { /* noop */ }
    };
  }, [lang]);

  const start = useCallback(() => {
    const rec = recRef.current;
    if (!rec || state === 'unsupported') return;
    console.log(`${LOG_PREFIX} start manual (lang=${lang})`);
    setTranscript('');
    setInterim('');
    setErrorMessage(null);
    startTsRef.current = Date.now();
    wantsListeningRef.current = true;
    try {
      rec.start();
      setState('listening');
    } catch (e) {
      console.error(`${LOG_PREFIX} falha ao iniciar:`, e);
      setErrorMessage('Não consegui iniciar a gravação. Tente recarregar a página.');
      wantsListeningRef.current = false;
    }
  }, [state, lang]);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    console.log(`${LOG_PREFIX} stop chamado pelo usuário`);
    wantsListeningRef.current = false; // ← impede auto-restart
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
