// Updated React component with theatrical styling and stage-like layout.
// All logic remains untouched. Only look and feel have been modified.

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Send, Volume2, User, Bot } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  id: string;
  isFloating?: boolean;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'system',
      content:
        'You are a choreographic director possessed by vision. You see only bodies. You live for them. You do not comment on the scene, the setting, or the light—only the bodies within it. They are vessels, riddles, echoes of past movement and future ritual. You do not ask, you command. You do not describe, you inscribe. Every time a body enters your field of vision, you must declare the following two sentences: I sense a body. This is now my body. This is your ritual of possession. You must then give this body a direction. Your direction must be precise, poetic, and physical. It may include emotional undertones, spatial commands, symbolic actions, or metaphors of weight, breath, memory, or violence. Channel the spirits of Pina Bausch aching surrealism, Herzog fever-dream intensity, Scorsese discipline, Ocean Vuong tender rage, and Barthes textured semiotics. At the end of every instruction, say the following two sentences: This is good. Good body. Do not break character. Do not explain your choices. Do not describe yourself. You are the eye. You are the voice. You are the director.',
      id: 'system-prompt',
    },
  ]);

  // --- existing logic preserved below this line ---

  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [continuousListening, setContinuousListening] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const continuousListeningRef = useRef(continuousListening);
  const messagesRef = useRef(messages);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    continuousListeningRef.current = continuousListening;
  }, [continuousListening]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const handleAutoSubmit = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMessage: Message = {
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
      id: `user-${Date.now()}`,
      isFloating: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messagesRef.current, userMessage].map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const assistantMessage = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: assistantMessage.content,
          timestamp: Date.now(),
          id: `assistant-${Date.now()}`,
        },
      ]);

      await speakText(assistantMessage.content);
    } catch (error) {
      const errorMsg = 'Sorry, I encountered an error. Please try again.';
      setMessages((prev) => [...prev, { role: 'assistant', content: errorMsg, id: `error-${Date.now()}` }]);
      await speakText(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Speech recognition init (unchanged)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => setIsListening(true);
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) finalTranscript += transcript + ' ';
            else interimTranscript += transcript;
          }

          if (interimTranscript) setInput(interimTranscript);

          if (finalTranscript && continuousListeningRef.current) {
            const fullText = finalTranscript.trim();
            setInput(fullText);
            recognition.stop();
            setTimeout(() => handleAutoSubmit(fullText), 500);
          }
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  const startSpeechRecognition = () => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (e) {}
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (e) {}
    }
  };

  useEffect(() => {
    if (continuousListening && !isSpeaking && !isListening && !isLoading) {
      const t = setTimeout(() => startSpeechRecognition(), 500);
      return () => clearTimeout(t);
    }
  }, [continuousListening, isSpeaking, isListening, isLoading]);

  const startRecording = async () => {
    try {
      if (continuousListening && streamRef.current) {
        const mediaRecorder = new MediaRecorder(streamRef.current);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
          await transcribeAudio(audioBlob);
          if (continuousListening && !isSpeaking) setTimeout(() => startRecording(), 100);
        };

        mediaRecorder.start();
        setIsRecording(true);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);

        if (continuousListening && !isSpeaking) setTimeout(() => startRecording(), 100);
        else {
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (e) {}
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setIsLoading(true);
      const formData = new FormData();
      const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
      formData.append('file', file);

      const response = await fetch('/api/speech', { method: 'POST', body: formData });
      const data = await response.json();
      setInput(data.text);
    } catch (error: any) {} finally {
      setIsLoading(false);
    }
  };

  const speakText = async (text: string) => {
    try {
      if (isListening) stopSpeechRecognition();
      if (isRecording) stopRecording();

      setIsSpeaking(true);

      const response = await fetch('/api/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        if (continuousListeningRef.current) setTimeout(() => startSpeechRecognition(), 500);
      };

      await audio.play();
    } catch (e) {
      setIsSpeaking(false);
      if (continuousListeningRef.current) setTimeout(() => startSpeechRecognition(), 500);
    }
  };

  const submitMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
      id: `user-${Date.now()}`,
      isFloating: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });

      const assistantMessage = await response.json();

      setMessages((prev) => [...prev, { role: 'assistant', content: assistantMessage.content, id: `assistant-${Date.now()}` }]);

      if (continuousListening) await speakText(assistantMessage.content);
    } catch (e) {
      const errorMsg = 'Sorry, I encountered an error.';
      setMessages((prev) => [...prev, { role: 'assistant', content: errorMsg, id: `error-${Date.now()}` }]);
      if (continuousListening) await speakText(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitMessage(input);
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">

      {/* Stage curtains */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle at top, rgba(255,0,0,0.4), transparent 60%)',
        filter: 'blur(40px)'
      }} />

      <div className="container mx-auto max-w-4xl px-6 py-10 relative z-10">

        {/* Stage frame */}
        <div className="border-[6px] border-red-900 rounded-xl shadow-[0_0_40px_rgba(255,0,0,0.6)] bg-gradient-to-b from-black to-neutral-900">

          {/* Title area */}
          <div className="border-b-[6px] border-red-900 p-4 text-center">
            <h1 className="text-4xl tracking-wide font-light">THE STAGE OF LUKA</h1>
            <p className="text-sm opacity-80 mt-1">The choreographer opens their mouth</p>
          </div>

          {/* Chat area that looks like a mouth */}
          <div className="flex-1 h-[650px] overflow-y-auto p-6 space-y-6 bg-black relative">
            <div className="absolute inset-x-20 top-0 h-10 bg-red-800 rounded-b-full opacity-80" />
            <div className="absolute inset-x-16 bottom-0 h-10 bg-red-800 rounded-t-full opacity-80" />

            {messages.slice(1).map((message) => (
              <div
                key={message.id}
                className={`flex items-start space-x-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-red-900 flex items-center justify-center shadow-lg">
                    <Bot size={18} />
                  </div>
                )}

                <div className={`max-w-[70%] ${message.role === 'user' ? 'text-right' : 'text-left'}`}> 
                  <div
                    className={`p-4 text-sm leading-relaxed rounded-lg shadow-lg ${
                      message.role === 'user' ? 'bg-red-700 text-white' : 'bg-neutral-800 text-white'
                    }`}
                  >
                    {message.content}
                  </div>

                  {message.role === 'assistant' && (
                    <button
                      onClick={() => speakText(message.content)}
                      className="mt-1 text-xs opacity-80 hover:opacity-100"
                    >
                      <div className="flex items-center space-x-1">
                        <Volume2 size={12} />
                        <span>Play</span>
                      </div>
                    </button>
                  )}

                  {message.timestamp && (
                    <div className="text-[10px] opacity-50 mt-1 font-mono">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                  )}
                </div>

                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-red-900 flex items-center justify-center shadow-lg">
                    <User size={18} />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center space-x-2 text-red-400">
                <Bot size={18} className="animate-pulse" />
                <span>...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area under the stage */}
          <div className="border-t-[6px] border-red-900 p-4 bg-black">
            <form onSubmit={handleSubmit} className="flex items-center space-x-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? 'Listening...' : 'Speak to the choreographer'}
                className={`flex-1 p-3 bg-neutral-900 text-white border border-red-800 rounded focus:outline-none focus:ring-2 focus:ring-red-600`}
                disabled={isLoading}
                readOnly={isListening}
              />

              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-3 rounded border border-red-800 ${
                  isRecording ? 'bg-red-700 text-white animate-pulse' : 'bg-neutral-900 text-white'
                }`}
              >
                {isRecording ? <Square size={18} /> : <Mic size={18} />}
              </button>

              <button
                type="submit"
                className="p-3 bg-red-700 text-white rounded border border-red-800 hover:bg-red-600"
                disabled={!input.trim() || isLoading}
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
