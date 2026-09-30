import React, { useRef, useState, useEffect } from 'react';
import { 
  Award, 
  Printer, 
  Download, 
  CheckCircle2, 
  ShieldCheck, 
  QrCode, 
  X, 
  Sparkles,
  ExternalLink,
  Layers,
  FileCheck,
  ArrowDownToLine,
  LogOut
} from 'lucide-react';
import { TeamCertificateData } from '../types';
import confetti from 'canvas-confetti';

interface CertificateRendererProps {
  certificate: TeamCertificateData;
  onClose?: () => void;
  isModal?: boolean;
}

export const CertificateRenderer: React.FC<CertificateRendererProps> = ({
  certificate,
  onClose,
  isModal = true,
}) => {
  const certRef = useRef<HTMLDivElement>(null);
  const cfg = certificate.config;
  const [viewMode, setViewMode] = useState<'template' | 'document'>(
    cfg.sampleUploadedImage ? 'template' : 'document'
  );
  const [downloading, setDownloading] = useState(false);

  // Toggle certificate print mode on body
  useEffect(() => {
    document.body.classList.add('certificate-print-mode');
    return () => {
      document.body.classList.remove('certificate-print-mode');
    };
  }, []);

  // Close on ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handlePrint = () => {
    try {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {}
    window.print();
  };

  // Direct PNG Image Download using HTML Canvas
  const handleDownloadImage = async () => {
    setDownloading(true);
    try {
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.5 }
        });
      } catch {}

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');

      // High resolution canvas (1920 x 1080 standard certificate landscape)
      canvas.width = 1920;
      canvas.height = 1080;

      if (viewMode === 'template' && cfg.sampleUploadedImage) {
        // Mode A: Render Template Image + Dynamic Overlays
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = cfg.sampleUploadedImage!;
        });

        // Draw background template image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Draw recipient typography overlay based on placement
        const p = cfg.namePlacement || {
          xPercent: 50,
          yPercent: 48,
          fontSizePx: 26,
          color: '#1e293b',
          fontFamily: 'serif',
          fontWeight: 'bold',
          textAlign: 'center',
          includeParticipants: true,
          participantsYOffsetPx: 30,
          participantsFontSizePx: 14,
        };

        const targetX = (canvas.width * (p.xPercent ?? 50)) / 100;
        const targetY = (canvas.height * (p.yPercent ?? 48)) / 100;

        ctx.fillStyle = p.color || '#1e293b';
        ctx.textAlign = (p.textAlign as CanvasTextAlign) || 'center';
        ctx.textBaseline = 'middle';

        // Scale font size proportionally from UI (base canvas is 1920px wide vs ~800px UI)
        const scaleFactor = 2.4;
        const fontSize = Math.round((p.fontSizePx ?? 26) * scaleFactor);
        const fontName = p.fontFamily === 'sans-serif' ? 'sans-serif' : p.fontFamily === 'monospace' ? 'monospace' : 'Times New Roman, serif';
        ctx.font = `bold ${fontSize}px ${fontName}`;
        ctx.fillText(certificate.teamName, targetX, targetY);

        // Subtitle / members
        if (p.includeParticipants !== false) {
          const subFontSize = Math.round((p.participantsFontSizePx ?? 14) * scaleFactor);
          ctx.font = `600 ${subFontSize}px sans-serif`;
          ctx.fillStyle = p.color ? p.color : '#334155';
          const memberText = certificate.participant2 
            ? `${certificate.participant1} & ${certificate.participant2}`
            : certificate.participant1;
          ctx.fillText(memberText, targetX, targetY + (p.participantsYOffsetPx ? p.participantsYOffsetPx * scaleFactor : 50));

          ctx.font = `normal ${Math.round(subFontSize * 0.8)}px sans-serif`;
          ctx.fillText(`${certificate.college} • Score: ${certificate.totalScore} pts (Rank #${certificate.rank})`, targetX, targetY + (p.participantsYOffsetPx ? p.participantsYOffsetPx * scaleFactor : 50) + 35);
        }

        // Add verification ID in corner
        ctx.font = 'bold 18px monospace';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'right';
        ctx.fillText(`CERT-ID: ${certificate.certificateId} • VERIFIED`, canvas.width - 40, canvas.height - 30);

      } else {
        // Mode B: Full Standard Document Certificate
        // Draw elegant parchment background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Outer borders
        ctx.strokeStyle = '#C83A87';
        ctx.lineWidth = 6;
        ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

        ctx.strokeStyle = '#55C7D9';
        ctx.lineWidth = 2;
        ctx.strokeRect(45, 45, canvas.width - 90, canvas.height - 90);

        // Header Title
        ctx.textAlign = 'center';
        ctx.fillStyle = '#C83A87';
        ctx.font = 'bold 28px monospace';
        ctx.fillText(cfg.institution || 'ACHARIYA COLLEGE OF ENGINEERING TECHNOLOGY', canvas.width / 2, 110);

        ctx.fillStyle = '#64748B';
        ctx.font = 'bold 22px monospace';
        ctx.fillText(cfg.department || 'DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING', canvas.width / 2, 150);

        ctx.fillStyle = '#0891B2';
        ctx.font = 'bold 20px monospace';
        ctx.fillText("CONDUCTING ACETCM'26 • NATIONAL LEVEL TECHNICAL SYMPOSIUM", canvas.width / 2, 190);

        ctx.fillStyle = '#172033';
        ctx.font = 'bold 46px sans-serif';
        ctx.fillText(cfg.symposiumName || "ACETCM'26", canvas.width / 2, 260);

        ctx.fillStyle = '#C83A87';
        ctx.font = 'bold 26px sans-serif';
        ctx.fillText(cfg.eventTitle || "TECH BRIDGE '26 • VISUAL TECHNICAL REBUS COMPETITION", canvas.width / 2, 305);

        // Award badge
        ctx.fillStyle = '#C83A87';
        ctx.font = 'bold 28px monospace';
        ctx.fillText(`★ ${awardInfo.text} ★`, canvas.width / 2, 370);

        // Certification citation
        ctx.fillStyle = '#475569';
        ctx.font = 'italic 24px serif';
        ctx.fillText('This is to officially certify that the team', canvas.width / 2, 440);

        // Team Name
        ctx.fillStyle = '#C83A87';
        ctx.font = 'bold 54px serif';
        ctx.fillText(`"${certificate.teamName}"`, canvas.width / 2, 510);

        // Members & College
        ctx.fillStyle = '#1E293B';
        const memberText = certificate.participant2 
          ? `Comprising: ${certificate.participant1} & ${certificate.participant2}`
          : `Participant: ${certificate.participant1}`;
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText(memberText, canvas.width / 2, 580);

        ctx.fillStyle = '#475569';
        ctx.font = 'normal 22px sans-serif';
        ctx.fillText(`representing ${certificate.college} (${certificate.department}, ${certificate.year})`, canvas.width / 2, 630);

        ctx.font = 'italic 20px serif';
        ctx.fillText('has actively participated and demonstrated exemplary aptitude in technical rebus decoding at ACETCM\'26.', canvas.width / 2, 675);

        // Score summary
        ctx.font = 'bold 20px monospace';
        ctx.fillStyle = '#0891B2';
        ctx.fillText(`Final Score: ${certificate.totalScore} Points | Rank #${certificate.rank} | Team ID: ${certificate.teamId}`, canvas.width / 2, 720);

        // Signatories line
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(150, 920);
        ctx.lineTo(550, 920);
        ctx.moveTo(canvas.width - 550, 920);
        ctx.lineTo(canvas.width - 150, 920);
        ctx.stroke();

        ctx.font = 'bold 20px sans-serif';
        ctx.fillStyle = '#1E293B';
        ctx.textAlign = 'center';
        ctx.fillText('Mrs. K. Janani', 350, 950);
        ctx.fillText('Ms. Angel R & Mr. Thirumurugan S', canvas.width - 350, 950);

        ctx.font = 'normal 16px sans-serif';
        ctx.fillStyle = '#64748B';
        ctx.fillText('AP / CSE • Event Coordinator', 350, 980);
        ctx.fillText('Student Coordinators (9487883582 / 9042789495)', canvas.width - 350, 980);

        // II Year note
        ctx.font = 'normal 14px monospace';
        ctx.fillText('II Year Coordinators: A. Kamalambiga | R. Dharshini | P. Arthi | Gowsikram V | Swedha Sree. M', canvas.width / 2, 1020);

        // Footer verification
        ctx.font = '14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`SERIAL: ${certificate.certificateId}`, 50, 1055);
        ctx.textAlign = 'right';
        ctx.fillText(`VERIFICATION: ${certificate.verificationHash}`, canvas.width - 50, 1055);
      }

      // Download file
      const link = document.createElement('a');
      link.download = `${certificate.teamName.replace(/\s+/g, '_')}_TECH_BRIDGE_26_CERTIFICATE.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      // Fallback to print
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  const getAwardLabel = (category: string) => {
    switch (category) {
      case 'FIRST_PLACE':
        return { text: 'FIRST PLACE WINNER', color: 'text-amber-400', badge: 'GOLD LAUREL' };
      case 'SECOND_PLACE':
        return { text: 'FIRST RUNNER-UP', color: 'text-slate-300', badge: 'SILVER LAUREL' };
      case 'THIRD_PLACE':
        return { text: 'SECOND RUNNER-UP', color: 'text-amber-600', badge: 'BRONZE LAUREL' };
      case 'DISTINCTION':
        return { text: 'CERTIFICATE OF DISTINCTION', color: 'text-cyan-400', badge: 'TOP PERFORMER' };
      default:
        return { text: 'CERTIFICATE OF MERIT & PARTICIPATION', color: 'text-emerald-400', badge: 'HONORABLE CONTENDER' };
    }
  };

  const awardInfo = getAwardLabel(certificate.awardCategory);
  const placement = cfg.namePlacement || {
    xPercent: 50,
    yPercent: 48,
    fontSizePx: 26,
    color: '#1e293b',
    fontFamily: 'serif',
    fontWeight: 'bold',
    textAlign: 'center',
    includeParticipants: true,
    participantsYOffsetPx: 30,
    participantsFontSizePx: 14,
  };

  const getFontFamilyStyle = (font?: string) => {
    switch (font) {
      case 'sans-serif':
        return 'font-sans';
      case 'monospace':
        return 'font-mono';
      case 'cursive':
        return 'font-serif italic';
      default:
        return 'font-serif';
    }
  };

  const content = (
    <div className="w-full max-w-4xl mx-auto bg-white text-[#24324A] rounded-2xl border border-[#E8E3EF] shadow-2xl overflow-hidden print:bg-white print:text-black print:border-none print:shadow-none print:m-0 print:p-0 print:max-w-none">
      {/* Top Action Toolbar (Hidden in Print) */}
      <div className="p-3 sm:p-4 bg-[#F7F3FC] border-b border-[#E8E3EF] flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#C83A87]/10 text-[#C83A87]">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold font-tech tracking-wider text-[#24324A]">
              OFFICIAL SYMPOSIUM CERTIFICATE
            </div>
            <div className="text-[10px] font-mono text-[#667085]">
              ID: {certificate.certificateId} &bull; Team: {certificate.teamName}
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {cfg.sampleUploadedImage && (
            <div className="flex rounded-xl bg-white border border-[#E8E3EF] p-0.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setViewMode('template')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  viewMode === 'template' ? 'bg-[#C83A87] text-white font-bold' : 'text-[#667085] hover:text-[#24324A]'
                }`}
              >
                TEMPLATE
              </button>
              <button
                type="button"
                onClick={() => setViewMode('document')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  viewMode === 'document' ? 'bg-[#C83A87] text-white font-bold' : 'text-[#667085] hover:text-[#24324A]'
                }`}
              >
                DOCUMENT
              </button>
            </div>
          )}

          {/* Download Image Button */}
          <button
            type="button"
            onClick={handleDownloadImage}
            disabled={downloading}
            className="px-3.5 py-2 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-white font-bold text-xs font-tech tracking-wider flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
            title="Download high-resolution image"
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>{downloading ? 'SAVING...' : 'DOWNLOAD PNG'}</span>
          </button>

          {/* Print / Save PDF Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#C83A87] to-[#8B5CF6] hover:brightness-110 text-white font-bold text-xs font-tech tracking-wider flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
            title="Print or save as PDF"
          >
            <Printer className="w-4 h-4" />
            <span>PRINT / PDF</span>
          </button>

          {/* Close / Exit Button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 transition border border-slate-200 hover:border-rose-300 font-bold text-xs flex items-center gap-1 cursor-pointer"
              title="Close Certificate"
            >
              <X className="w-4 h-4" />
              <span>EXIT</span>
            </button>
          )}
        </div>
      </div>

      {/* Mode A: Uploaded Sample Template Overlay Mode */}
      {viewMode === 'template' && cfg.sampleUploadedImage ? (
        <div 
          ref={certRef}
          className="relative w-full overflow-hidden bg-white print:m-0 print:p-0"
        >
          {/* Base Sample Certificate Image */}
          <img 
            src={cfg.sampleUploadedImage} 
            alt="Official Certificate Template" 
            className="w-full h-auto block select-none pointer-events-none"
          />

          {/* Dynamic Participant / Team Name Overlay */}
          <div 
            className="absolute transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none"
            style={{
              left: `${placement.xPercent ?? 50}%`,
              top: `${placement.yPercent ?? 48}%`,
              width: '80%',
            }}
          >
            {/* Team Name */}
            <div 
              className={`${getFontFamilyStyle(placement.fontFamily)} tracking-wide transition-all`}
              style={{
                fontSize: `${placement.fontSizePx ?? 26}px`,
                color: placement.color || '#1e293b',
                fontWeight: placement.fontWeight === 'normal' ? 'normal' : 'bold',
                textAlign: placement.textAlign || 'center',
                lineHeight: 1.2,
              }}
            >
              {certificate.teamName}
            </div>

            {/* Comprising Members (if enabled) */}
            {placement.includeParticipants !== false && (
              <div 
                className="mt-1.5 font-sans font-semibold tracking-normal"
                style={{
                  fontSize: `${placement.participantsFontSizePx ?? 14}px`,
                  color: placement.color ? `${placement.color}dd` : '#334155',
                  textAlign: placement.textAlign || 'center',
                }}
              >
                <span>{certificate.participant1}</span>
                {certificate.participant2 && (
                  <span> & {certificate.participant2}</span>
                )}
                <span className="block text-[11px] font-normal opacity-90">
                  {certificate.college} &bull; Score: {certificate.totalScore} pts (Rank #{certificate.rank})
                </span>
              </div>
            )}
          </div>

          {/* Discreet Verification Seal in Bottom Corner */}
          <div className="absolute bottom-3 right-4 pointer-events-none text-right opacity-80 print:opacity-100">
            <div className="text-[8px] font-mono text-slate-700 bg-white/80 px-2 py-0.5 rounded backdrop-blur-xs border border-slate-200 inline-block">
              CERT-ID: {certificate.certificateId} &bull; VERIFIED
            </div>
          </div>
        </div>
      ) : (
        /* Mode B: Full Standard Vector & Typography Layout */
        <div 
          ref={certRef}
          className="relative p-8 sm:p-12 min-h-[620px] flex flex-col justify-between overflow-hidden bg-white print:bg-white print:text-black print:p-8"
        >
          {/* Decorative Watermark & Borders */}
          <div className="absolute inset-3 border-2 border-[#C83A87]/30 rounded-xl pointer-events-none print:border-black/50" />
          <div className="absolute inset-5 border border-[#55C7D9]/30 rounded-lg pointer-events-none print:border-black/30" />
          <div className="absolute top-4 left-4 text-[#C83A87]/70 text-[9px] font-mono tracking-widest print:text-gray-600">
            ◆ ACHARIYA • CSE ◆
          </div>
          <div className="absolute top-4 right-4 text-[#C83A87]/70 text-[9px] font-mono tracking-widest print:text-gray-600">
            ◆ ACETCM'26 • TECH BRIDGE ◆
          </div>

          {/* Certificate Header */}
          <div className="text-center relative z-10 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F7F3FC] border border-[#E8E3EF] text-[#C83A87] text-[11px] sm:text-xs font-mono font-bold tracking-widest uppercase print:bg-gray-100 print:text-black print:border-black">
              <ShieldCheck className="w-3.5 h-3.5" />
              {cfg.institution || "ACHARIYA COLLEGE OF ENGINEERING TECHNOLOGY"}
            </div>

            <h2 className="text-xs sm:text-sm font-mono text-[#667085] uppercase tracking-widest font-semibold print:text-gray-700">
              {cfg.department || "DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING"}
            </h2>

            <div className="text-[11px] font-mono font-bold text-[#55C7D9] tracking-wider uppercase">
              CONDUCTING ACETCM'26 • NATIONAL LEVEL SYMPOSIUM
            </div>

            <div className="pt-1">
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-wider font-tech text-[#24324A] print:text-black">
                {cfg.symposiumName || "ACETCM'26"}
              </h1>
              <p className="text-xs sm:text-sm font-tech text-[#C83A87] tracking-widest mt-0.5 print:text-gray-800">
                {cfg.eventTitle || "TECH BRIDGE '26 • VISUAL TECHNICAL REBUS COMPETITION"}
              </p>
            </div>

            <div className="pt-2">
              <span className={`inline-block text-xs sm:text-sm font-extrabold uppercase px-4 py-1.5 rounded-full border border-[#E8E3EF] bg-[#F7F3FC] tracking-widest text-[#C83A87] print:border-black print:bg-gray-100 print:text-black`}>
                ★ {awardInfo.text} ★
              </span>
            </div>
          </div>

          {/* Certificate Recipient & Citation Body */}
          <div className="text-center relative z-10 my-6 space-y-4 max-w-2xl mx-auto">
            <p className="text-xs sm:text-sm text-[#667085] italic print:text-gray-700">
              This is to officially certify that the team
            </p>

            <div className="py-2">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#C83A87] font-tech tracking-wider print:text-black">
                "{certificate.teamName}"
              </div>
              <div className="text-xs font-mono text-[#667085] mt-1 print:text-gray-700">
                (Team ID: {certificate.teamId} • Final Score: {certificate.totalScore} pts • Rank #{certificate.rank})
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 text-sm sm:text-base font-bold text-[#24324A] print:text-black">
              <span>Comprising</span>
              <span className="px-3 py-1 bg-[#F7F3FC] border border-[#E8E3EF] rounded-lg text-[#24324A] print:bg-transparent print:border-black print:text-black">
                {certificate.participant1}
              </span>
              {certificate.participant2 && (
                <>
                  <span>&</span>
                  <span className="px-3 py-1 bg-[#F7F3FC] border border-[#E8E3EF] rounded-lg text-[#24324A] print:bg-transparent print:border-black print:text-black">
                    {certificate.participant2}
                  </span>
                </>
              )}
            </div>

            <p className="text-xs sm:text-sm text-[#667085] leading-relaxed print:text-gray-800">
              representing <strong className="text-[#24324A] print:text-black font-semibold">{certificate.college}</strong> ({certificate.department}, {certificate.year}),
              has actively participated and demonstrated exemplary aptitude in technical rebus decoding, logic analysis, and rapid speed deduction at the ACETCM'26 Tech Bridge arena.
            </p>
          </div>

          {/* Certificate Footer: Seal & Signatories */}
          <div className="relative z-10 pt-6 border-t border-[#E8E3EF] print:border-black space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 items-end gap-4 text-center">
              {/* Signatory 1: Event Coordinator */}
              <div className="space-y-1">
                <div className="h-8 flex items-center justify-center text-xs italic font-serif text-[#C83A87] print:text-black">
                  [Signature Verified]
                </div>
                <div className="border-t border-[#E8E3EF] pt-1 print:border-black">
                  <div className="text-xs font-bold text-[#24324A] print:text-black">
                    {cfg.signatory1?.name || "Mrs. K. Janani"}
                  </div>
                  <div className="text-[10px] text-[#667085] font-mono print:text-gray-600">
                    {cfg.signatory1?.designation || "AP / CSE"} • {cfg.signatory1?.title || "Event Coordinator"}
                  </div>
                </div>
              </div>

              {/* Official Seal / Security */}
              <div className="flex flex-col items-center justify-center space-y-1 py-1">
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#C83A87]/60 flex flex-col items-center justify-center text-[#C83A87] bg-[#F7F3FC] print:border-black print:text-black">
                  <ShieldCheck className="w-6 h-6" />
                  <span className="text-[6.5px] font-mono font-bold tracking-tighter text-center leading-tight">
                    ACHARIYA<br/>ACETCM'26
                  </span>
                </div>
                <div className="text-[9px] font-mono text-[#667085] tracking-wider print:text-gray-600">
                  DATE: {cfg.date || "MARCH 2026"}
                </div>
              </div>

              {/* Signatory 2 & 3: Student Coordinators */}
              <div className="space-y-1">
                <div className="h-8 flex items-center justify-center text-xs italic font-serif text-[#C83A87] print:text-black">
                  [Signature Verified]
                </div>
                <div className="border-t border-[#E8E3EF] pt-1 print:border-black">
                  <div className="text-xs font-bold text-[#24324A] print:text-black">
                    Ms. Angel R &bull; Mr. Thirumurugan S
                  </div>
                  <div className="text-[9px] text-[#667085] font-mono print:text-gray-600">
                    Student Coordinators (9487883582 / 9042789495)
                  </div>
                </div>
              </div>
            </div>

            {/* II Year Coordinators Note on Certificate */}
            <div className="pt-2 border-t border-[#E8E3EF] print:border-black/20 text-center">
              <div className="text-[9.5px] font-mono text-[#667085] print:text-gray-700">
                <span className="font-semibold text-[#24324A] print:text-black">II Year Coordinators:</span> A. Kamalambiga | R. Dharshini | P. Arthi | Gowsikram V | Swedha Sree. M
              </div>
            </div>

            <div className="flex items-center justify-between text-[8.5px] font-mono text-[#667085] pt-2 print:text-gray-600">
              <span>CERTIFICATE SERIAL: {certificate.certificateId}</span>
              <span>ACHARIYA COLLEGE OF ENGINEERING TECHNOLOGY • CSE SYMPOSIUM</span>
              <span>VERIFICATION CODE: {certificate.verificationHash}</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Exit Bar for Easy One-Click Dismissal */}
      {onClose && (
        <div className="p-3 bg-[#F8FAFC] border-t border-[#E8E3EF] flex items-center justify-between print:hidden">
          <div className="text-xs text-[#64748B] font-mono">
            Press <kbd className="px-1.5 py-0.5 bg-white border border-[#CBD5E1] rounded text-[10px] font-bold">ESC</kbd> or click Exit to return to arena
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#172033] hover:bg-[#0F172A] text-white font-tech font-bold text-xs tracking-wider flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>EXIT CERTIFICATE</span>
          </button>
        </div>
      )}
    </div>
  );

  if (!isModal) {
    return content;
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div className="w-full max-h-[92vh] overflow-y-auto my-auto py-2">
        {content}
      </div>
    </div>
  );
};

