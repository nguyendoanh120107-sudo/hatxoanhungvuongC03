import { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Play, Pause, Square, AlertCircle } from 'lucide-react';

interface AudioSpeechReaderProps {
  text: string;
  title: string;
  pieceId: string;
}

export function AudioSpeechReader({ text, title, pieceId }: AudioSpeechReaderProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(0.9); // Slightly slower for cultural folk poetry cadence
  const [hasSupport, setHasSupport] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [hasVietnameseVoice, setHasVietnameseVoice] = useState<boolean>(true);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setHasSupport(false);
      setStatusMessage('Trình duyệt không hỗ trợ Web Speech API.');
      return;
    }

    // Check voices
    const checkVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const viVoice = voices.find(
        (v) => v.lang.toLowerCase().includes('vi') || v.lang.toLowerCase().includes('vietnam')
      );
      if (voices.length > 0 && !viVoice) {
        setHasVietnameseVoice(false);
      } else if (viVoice) {
        setHasVietnameseVoice(true);
      }
    };

    checkVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = checkVoices;
    }

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // When text or piece changes, stop current speaking
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
      setStatusMessage('');
    }
  }, [pieceId, text]);

  const handlePlay = () => {
    if (!hasSupport) {
      setStatusMessage('Trình duyệt của bạn không hỗ trợ tính năng đọc tự động.');
      return;
    }

    const synth = window.speechSynthesis;

    if (isPaused) {
      synth.resume();
      setIsPaused(false);
      setIsPlaying(true);
      setStatusMessage('Đang tiếp tục đọc lời ca di sản...');
      return;
    }

    synth.cancel();

    // Prepare text: strip slashes and format pauses
    const cleanText = `Bản ghi ${pieceId}. Bài ${title}. Trích đoạn lời ca: ${text.replace(/\//g, ', ')}`;
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utteranceRef.current = utterance;

    const voices = synth.getVoices();
    const viVoice = voices.find(
      (v) => v.lang.toLowerCase().includes('vi') || v.lang.toLowerCase().includes('vietnam')
    );

    if (viVoice) {
      utterance.voice = viVoice;
      utterance.lang = viVoice.lang;
    } else {
      utterance.lang = 'vi-VN';
    }

    utterance.rate = speed;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
      setStatusMessage(
        viVoice
          ? 'Đang phát âm thanh đọc lời ca (giọng vi-VN)...'
          : 'Đang đọc bằng bộ tổng hợp giọng nói mặc định của hệ thống...'
      );
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setStatusMessage('Đã đọc xong trích đoạn.');
    };

    utterance.onerror = (e) => {
      if (e.error !== 'canceled') {
        setIsPlaying(false);
        setIsPaused(false);
        setStatusMessage('Không thể phát âm thanh: ' + (e.error || 'Lỗi không xác định'));
      }
    };

    synth.speak(utterance);
  };

  const handlePause = () => {
    if (window.speechSynthesis && isPlaying) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      setIsPlaying(false);
      setStatusMessage('Đã tạm dừng đọc.');
    }
  };

  const handleStop = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
      setStatusMessage('');
    }
  };

  const changeSpeed = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (isPlaying) {
      handleStop();
      setTimeout(handlePlay, 100);
    }
  };

  if (!hasSupport) {
    return (
      <div className="flex items-center gap-2 text-xs text-stone-500 bg-stone-100 p-2.5 rounded-lg border border-stone-200">
        <VolumeX className="w-4 h-4 text-stone-400 shrink-0" />
        <span>Trình duyệt hiện tại chưa hỗ trợ Web Speech API để phát giọng đọc tiếng Việt.</span>
      </div>
    );
  }

  return (
    <div className="bg-[#F5F2EA] rounded-xl p-3 border border-[#E7E2D6] space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#9A3412]/10 flex items-center justify-center text-[#9A3412]">
            <Volume2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-stone-800">
              Đọc lời ca bằng giọng đọc máy (speechSynthesis)
            </div>
            <div className="text-[11px] text-stone-500">
              Hỗ trợ học tập, tiếp cận trực quan cho người khiếm thị
            </div>
          </div>
        </div>

        {/* Speed selector */}
        <div className="flex items-center gap-1 text-[11px] font-medium text-stone-600">
          <span className="text-stone-400 mr-1">Tốc độ:</span>
          {[0.8, 0.9, 1.1].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => changeSpeed(s)}
              className={`px-2 py-0.5 rounded transition-colors ${
                speed === s
                  ? 'bg-[#9A3412] text-white font-semibold'
                  : 'bg-stone-200/70 hover:bg-stone-300 text-stone-700'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1 border-t border-[#E7E2D6]/80">
        <div className="flex items-center gap-2">
          {!isPlaying ? (
            <button
              type="button"
              onClick={handlePlay}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#9A3412] text-white text-xs font-medium hover:bg-[#832b0e] transition-colors shadow-sm"
              title="Phát giọng đọc tiếng Việt"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isPaused ? 'Tiếp tục' : 'Nghe đọc lời'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePause}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-700 text-white text-xs font-medium hover:bg-amber-800 transition-colors shadow-sm"
              title="Tạm dừng"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Tạm dừng</span>
            </button>
          )}

          {(isPlaying || isPaused) && (
            <button
              type="button"
              onClick={handleStop}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-medium transition-colors"
              title="Dừng hẳn"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Dừng</span>
            </button>
          )}

          {isPlaying && (
            <div className="flex items-center gap-1 pl-1">
              <span className="w-1 h-3 bg-[#9A3412] animate-pulse rounded-full" />
              <span className="w-1 h-4 bg-[#9A3412] animate-bounce rounded-full" />
              <span className="w-1 h-2 bg-[#9A3412] animate-pulse rounded-full" />
            </div>
          )}
        </div>

        <div className="text-[11px] text-stone-600 truncate max-w-[260px]">
          {statusMessage || (!hasVietnameseVoice ? 'Khuyên dùng trên Chrome/Edge có giọng vi-VN' : 'Sẵn sàng phát')}
        </div>
      </div>

      {!hasVietnameseVoice && (
        <div className="flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50/80 p-2 rounded border border-amber-200">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
          <span>
            Trình duyệt chưa tải gói giọng đọc tiếng Việt tiêu chuẩn (vi-VN). Giọng phát có thể mang ngữ điệu mặc định của hệ điều hành.
          </span>
        </div>
      )}
    </div>
  );
}
