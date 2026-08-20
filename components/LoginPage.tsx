import React, { useState, useEffect, useRef } from 'react';
import { 
  Lock, 
  User, 
  ShieldAlert, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  ChevronRight, 
  ChevronLeft,
  Sparkles,
  Gauge,
  Cpu,
  ArrowRight
} from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

interface InteractiveParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life?: number; // Spark particles fade and die
  color: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Focus states for inputs
  const [userFocused, setUserFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // Multi-step flip state
  const [step, setStep] = useState<'username' | 'password'>('username');
  const [isFlipping, setIsFlipping] = useState(false);

  // References for focus redirection
  const usernameInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  // Track coordinates for cursor glow flare and parallax calculations
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [cardRotate, setCardRotate] = useState({ x: 0, y: 0 });

  // Automotive telemetry statuses
  const [engineTemp, setEngineTemp] = useState(92);
  const [turboBoost, setTurboBoost] = useState(0.4);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loginCardRef = useRef<HTMLDivElement | null>(null);

  // Typing animation phrases with high-tech automotive wording
  const phrases = [
    "Welcome to Garir Dokan Imports...",
    "Readying Custom Duty Ledger Profiles...",
    "Validating Chassis Port Keys...",
    "Supercar Documents Ready for Customs Terminal.",
  ];
  const [displayedText, setDisplayedText] = useState('');
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState(100);

  // Simulation loop for high-tech telemetry values
  useEffect(() => {
    const interval = setInterval(() => {
      setEngineTemp((prev) => {
        const offset = Math.random() > 0.5 ? 0.5 : -0.5;
        const next = prev + offset;
        return next > 96 ? 95 : next < 88 ? 89 : next;
      });
      setTurboBoost((prev) => {
        const offset = (Math.random() - 0.5) * 0.15;
        const next = prev + offset;
        return next > 1.2 ? 1.1 : next < 0.1 ? 0.2 : next;
      });
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  // Typer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const handleType = () => {
      const currentPhrase = phrases[phraseIdx];
      if (!isDeleting) {
        setDisplayedText(currentPhrase.substring(0, displayedText.length + 1));
        setTypingSpeed(90);

        if (displayedText === currentPhrase) {
          setTypingSpeed(2200);
          setIsDeleting(true);
        }
      } else {
        setDisplayedText(currentPhrase.substring(0, displayedText.length - 1));
        setTypingSpeed(45);

        if (displayedText === '') {
          setIsDeleting(false);
          setPhraseIdx((prev) => (prev + 1) % phrases.length);
          setTypingSpeed(400);
        }
      }
    };

    timer = setTimeout(handleType, typingSpeed);
    return () => clearTimeout(timer);
  }, [displayedText, isDeleting, phraseIdx]);

  // Track global coordinates & handle card perspective tilt
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });

      // Calculate subtle card 3D rotation based on mouse orientation relative to window center
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const diffX = e.clientX - centerX;
      const diffY = e.clientY - centerY;

      // Limit max angle to +/- 8 degrees for supreme high-end elegance
      const rotateY = (diffX / centerX) * 8;
      const rotateX = -(diffY / centerY) * 8;

      setCardRotate({ x: rotateX, y: rotateY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Auto-focus username input on mount
  useEffect(() => {
    usernameInputRef.current?.focus();
  }, []);

  // HTML5 Interactive Canvas particles with hyper-responsive cursor attraction and trail spark emitter
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: InteractiveParticle[] = [];
    const maxParticles = 55;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    // Populate default drifting particles
    for (let i = 0; i < maxParticles; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.9,
        vy: (Math.random() - 0.5) * 0.9,
        size: Math.random() * 2.2 + 1.2,
        alpha: Math.random() * 0.45 + 0.15,
        color: 'rgba(239, 68, 68, ', // Red nodes
      });
    }

    const mouseRef = { x: -1000, y: -1000, active: false };

    const handleCanvasMouseMove = (e: MouseEvent) => {
      mouseRef.x = e.clientX;
      mouseRef.y = e.clientY;
      mouseRef.active = true;

      // Emit interactive sparks as cursor moves
      if (Math.random() > 0.3) {
        particles.push({
          x: e.clientX + (Math.random() - 0.5) * 15,
          y: e.clientY + (Math.random() - 0.5) * 15,
          vx: (Math.random() - 0.5) * 2.2,
          vy: (Math.random() - 0.5) * 2.2 - 0.6, // Float slightly upwards
          size: Math.random() * 3 + 1.5,
          alpha: 1.0,
          life: 1.0,
          color: Math.random() > 0.4 ? 'rgba(239, 68, 68, ' : 'rgba(255, 255, 255, ',
        });
      }
    };

    const handleCanvasMouseLeave = () => {
      mouseRef.active = false;
    };

    window.addEventListener('mousemove', handleCanvasMouseMove);
    window.addEventListener('mouseleave', handleCanvasMouseLeave);

    const drawParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Draw web connection lines (with higher responsiveness to mouse nodes)
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        if (p1.life !== undefined && p1.life <= 0) continue;

        // Draw node-to-node links
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          if (p2.life !== undefined && p2.life <= 0) continue;

          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 135) {
            ctx.beginPath();
            const alphaVal = 0.08 * (1 - dist / 135) * (p1.alpha + p2.alpha) / 2;
            ctx.strokeStyle = `rgba(239, 68, 68, ${alphaVal})`;
            ctx.lineWidth = 0.8;
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }

        // Draw direct cursor anchors connecting nearby dots to mouse coordinate
        if (mouseRef.active && mouseRef.x > 0) {
          const mdx = p1.x - mouseRef.x;
          const mdy = p1.y - mouseRef.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);

          if (mdist < 220) {
            ctx.beginPath();
            const cursorAlpha = 0.16 * (1 - mdist / 220);
            ctx.strokeStyle = `rgba(220, 38, 38, ${cursorAlpha})`;
            ctx.lineWidth = 1.1;
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(mouseRef.x, mouseRef.y);
            ctx.stroke();
          }
        }
      }

      // 2. Render dots and calculate fluid mechanics
      particles.forEach((p, idx) => {
        if (p.life !== undefined) {
          p.life -= 0.02; // Decay over time
          p.alpha = p.life;
          p.x += p.vx;
          p.y += p.vy;

          if (p.life <= 0) {
            particles.splice(idx, 1);
            return;
          }
        } else {
          p.x += p.vx;
          p.y += p.vy;

          // Strong responsive cursor magnetic vortex behavior
          if (mouseRef.active && mouseRef.x > 0) {
            const mdx = mouseRef.x - p.x;
            const mdy = mouseRef.y - p.y;
            const mdist = Math.sqrt(mdx * mdx + mdy * mdy);

            if (mdist < 280) {
              const pullStrength = (280 - mdist) / 280;
              p.vx += (mdx / mdist) * pullStrength * 0.12;
              p.vy += (mdy / mdist) * pullStrength * 0.12;

              // Apply a light swirling orbit vector to the swarm
              p.vx += (-mdy / mdist) * pullStrength * 0.08;
              p.vy += (mdx / mdist) * pullStrength * 0.08;
            }
          }

          p.vx *= 0.94;
          p.vy *= 0.94;

          p.vx += (Math.random() - 0.5) * 0.08;
          p.vy += (Math.random() - 0.5) * 0.08;

          const bounceTolerance = 6;
          if (p.x < bounceTolerance) { p.x = bounceTolerance; p.vx *= -1; }
          if (p.x > canvas.width - bounceTolerance) { p.x = canvas.width - bounceTolerance; p.vx *= -1; }
          if (p.y < bounceTolerance) { p.y = bounceTolerance; p.vy *= -1; }
          if (p.y > canvas.height - bounceTolerance) { p.y = canvas.height - bounceTolerance; p.vy *= -1; }
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.alpha})`;
        ctx.fill();
        
        if (p.size > 2.5) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 1.8, 0, Math.PI * 2);
          ctx.fillStyle = `${p.color}${p.alpha * 0.22})`;
          ctx.fill();
        }
      });

      animationFrameId = requestAnimationFrame(drawParticles);
    };

    drawParticles();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleCanvasMouseMove);
      window.removeEventListener('mouseleave', handleCanvasMouseLeave);
    };
  }, []);

  // Flip from username view to password view
  const triggerFlipToPassword = () => {
    if (!username.trim()) {
      setErrorMsg('Unauthorized: Username is required.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }

    setErrorMsg('');
    setIsFlipping(true);

    setTimeout(() => {
      setStep('password');
      // Briefly wait for render & focus password input field
      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 50);
    }, 250); // Exact 90deg perpendicular moment

    setTimeout(() => {
      setIsFlipping(false);
    }, 500);
  };

  // Flip back to username
  const triggerFlipToUsername = () => {
    setErrorMsg('');
    setIsFlipping(true);

    setTimeout(() => {
      setStep('username');
      setTimeout(() => {
        usernameInputRef.current?.focus();
      }, 50);
    }, 250);

    setTimeout(() => {
      setIsFlipping(false);
    }, 500);
  };

  // Handle Username Submission / Enter Key Press
  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerFlipToPassword();
  };

  // Final validation authentication check
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsShaking(false);

    if (!password.trim()) {
      setErrorMsg('Unauthorized: Passcode is required.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      if (username === 'garir_dokan' && password === 'garirdokan07') {
        setIsSuccess(true);
        setIsLoading(false);
        sessionStorage.setItem('gd_auth', 'true');
        
        setTimeout(() => {
          onLoginSuccess();
        }, 1300);
      } else {
        setIsLoading(false);
        setErrorMsg('Invalid authorization passcode. Access denied.');
        setIsShaking(true);
        
        setTimeout(() => {
          setIsShaking(false);
        }, 500);
      }
    }, 1300);
  };

  // Compute 3D rotation matrix including flip angle offsets
  const getCardTransform = () => {
    let rotX = cardRotate.x;
    let rotY = cardRotate.y;

    if (isFlipping) {
      // Perpendicular 3D spin view
      return `perspective(1000px) rotateX(${rotX}deg) rotateY(90deg) scale(0.93)`;
    }
    
    return `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  };

  return (
    <div className="relative min-h-screen bg-[#060608] flex items-center justify-center overflow-hidden font-sans select-none pb-12">
      {styleBlock}

      {/* HTML5 Interactive canvas particle backdrop with vortex physics */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 pointer-events-none z-0" 
      />

      {/* Neon glowing grid floor lines to give extreme automotive supercar depth */}
      <div className="cyberwave-grid absolute inset-0 pointer-events-none opacity-20 z-0" />

      {/* Extreme ambient mouse-following neon light flare */}
      <div 
        className="hidden md:block pointer-events-none absolute w-[550px] h-[550px] bg-red-700/[0.045] blur-[140px] rounded-full z-0 transition-all duration-300"
        style={{
          left: `${mousePos.x - 275}px`,
          top: `${mousePos.y - 275}px`,
        }}
      />

      {/* Floating backlights - Breathing Crimson Red */}
      <div className="absolute left-[-200px] top-1/4 w-[500px] h-[500px] bg-red-800/[0.02] rounded-full blur-[180px] pointer-events-none" />
      <div className="absolute right-[-200px] bottom-1/4 w-[500px] h-[500px] bg-red-800/[0.02] rounded-full blur-[180px] pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-lg px-6 py-10 flex flex-col items-center">
        
        {/* GARIR DOKAN LOGO ACCENTS */}
        <div className="w-full max-w-md mb-8 flex flex-col items-center">
          
          <div className="relative inline-flex items-center justify-center mb-4 group">
            <div className="absolute -inset-2 bg-gradient-to-r from-red-700 to-red-900 rounded-3xl blur-[12px] opacity-60 group-hover:opacity-100 transition duration-1000"></div>
            
            <div className="relative w-20 h-20 bg-[#09090b] rounded-2xl flex flex-col items-center justify-center border border-white/10 shadow-xl overflow-hidden">
              <div className="absolute top-0 bottom-0 left-[-40px] w-8 bg-gradient-to-r from-transparent via-red-600/35 to-transparent skew-x-12 animate-scanner" />
              <div className="car-wheel-spin w-14 h-14 border border-red-700/40 rounded-full flex items-center justify-center relative">
                <div className="absolute w-full h-[1px] bg-red-600/60" />
                <div className="absolute w-full h-[1px] bg-red-600/60 rotate-45" />
                <div className="absolute w-full h-[1px] bg-red-600/60 rotate-90" />
                <div className="absolute w-full h-[1px] bg-red-600/60 rotate-[135deg]" />
                <div className="w-7 h-7 bg-[#050507] border border-red-700 rounded-full flex items-center justify-center z-10">
                  <span className="text-[9px] font-black text-red-500">GD</span>
                </div>
              </div>
            </div>
          </div>

          <h1 className="text-4xl font-black tracking-tight text-white uppercase font-sans flex items-center gap-1">
            GARIR <span className="text-red-700 text-shadow-red relative font-extrabold">DOKAN
              <span className="absolute left-0 right-0 bottom-1 h-[2px] bg-red-600/30 w-full rounded" />
            </span>
          </h1>
          <p className="text-[10px] uppercase tracking-[0.45em] font-black text-gray-500 mt-2">
            PREMIUM AUTOMOTIVE IMPORT CONTROL
          </p>

          {/* Typing terminal column */}
          <div className="mt-4 h-5 flex items-center justify-center">
            <span className="text-xs font-mono font-bold text-red-500 tracking-wide relative flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-red-500 animate-pulse" />
              <span>{displayedText}</span>
              <span className="w-[6px] h-3.5 bg-red-700 inline-block animate-pulse" />
            </span>
          </div>

          {/* DYNAMIC SPORTS CAR SILHOUETTE SECTION */}
          <div className="w-full mt-4 bg-gradient-to-b from-black/60 to-transparent border-t border-b border-white/5 py-4 px-2 select-none relative overflow-hidden flex flex-col items-center">
            <div className="absolute inset-0 pointer-events-none bg-radial-vignette opacity-20" />
            
            <div className="car-glow-silhouette w-72 h-14 relative flex items-center justify-center">
              <svg viewBox="0 0 400 90" className="w-full h-full text-zinc-800" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M150,25 C170,18 230,18 250,25" stroke="#333" strokeWidth="1.5" />
                <path d="M150,25 L120,40 L90,42 L50,55" stroke="#222" strokeWidth="1" />
                <path d="M250,25 L280,40 L310,42 L350,55" stroke="#222" strokeWidth="1" />
                
                <path d="M40,65 C60,54 340,54 360,65 C380,70 380,78 360,82 C340,86 60,86 40,82 C20,78 20,70 40,65 Z" stroke="rgba(239, 68, 68, 0.45)" strokeWidth="2" className="animate-pulse" />
                <path d="M120,65 C150,56 250,56 280,65" stroke="rgba(239, 68, 68, 0.7)" strokeWidth="2.5" />
                
                <circle cx="95" cy="74" r="13" stroke="#222" strokeWidth="3" />
                <circle cx="305" cy="74" r="13" stroke="#222" strokeWidth="3" />
                
                <circle cx="95" cy="74" r="9" stroke="rgba(239, 68, 68, 0.3)" strokeWidth="1" strokeDasharray="3 3" className="car-wheel-spin origin-center" style={{ transformOrigin: '95px 74px' }} />
                <circle cx="305" cy="74" r="9" stroke="rgba(239, 68, 68, 0.3)" strokeWidth="1" strokeDasharray="3 3" className="car-wheel-spin origin-center" style={{ transformOrigin: '305px 74px' }} />

                <path d="M50,68 L70,66" stroke="#fff" strokeWidth="2.5" className="headlight-glow" />
                <path d="M350,68 L330,66" stroke="#fff" strokeWidth="2.5" className="headlight-glow" />

                <polygon points="50,68 15,80 10,65" fill="rgba(239, 68, 68, 0.12)" className="laser-beam-left" />
                <polygon points="350,68 385,80 390,65" fill="rgba(239, 68, 68, 0.12)" className="laser-beam-right" />
              </svg>
            </div>
            <div className="flex gap-4 text-[8px] font-mono text-gray-500 uppercase tracking-widest mt-1">
              <span className="flex items-center gap-1"><Cpu className="w-2.5 h-2.5 text-red-500" /> Aerodynamic profile active</span>
              <span className="flex items-center gap-1"><Gauge className="w-2.5 h-2.5 text-red-500" /> hypercar lock down ready</span>
            </div>
          </div>

        </div>

        {/* GLASSMORPHISM CARD - STUNNING 3D ROTATION PARALLAX FRAME */}
        <div 
          id="login-card"
          ref={loginCardRef}
          className={`w-full bg-[#0a0a0c]/90 border border-white/5 rounded-3xl p-8 backdrop-blur-2xl crimson-glow-ring transition-all duration-300 ease-out relative overflow-hidden max-w-md ${
            isShaking ? 'shake-active' : ''
          } ${isSuccess ? 'scale-[0.96] opacity-90' : ''}`}
          style={{
            transform: getCardTransform(),
          }}
        >
          {/* Subtle neon blue/red running border laser line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-600/70 to-transparent" />
          
          {/* Card subtle scanline overlay texture */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.012] bg-[linear-gradient(to_bottom,transparent_50%,#fff_50%)] bg-[length:100%_4px]" />

          {/* Success Access Granted Loading Modal Screen */}
          {isSuccess && (
            <div className="absolute inset-0 bg-[#060608]/95 flex flex-col items-center justify-center z-40 transition-all duration-300">
              <div className="w-20 h-20 bg-red-950/30 border border-red-500/60 rounded-full flex items-center justify-center text-red-500 animate-pulse mb-4 shadow-[0_0_40px_rgba(239,68,68,0.35)]">
                <ShieldCheck className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-lg font-black uppercase tracking-[0.45em] text-white">
                Access Granted
              </h2>
              <div className="w-48 h-[2px] bg-red-950/80 rounded-full mt-4 overflow-hidden relative">
                <div className="absolute top-0 bottom-0 left-0 w-1/2 bg-red-600 rounded-full animate-loader-slide" />
              </div>
              <p className="text-[10px] font-mono text-gray-500 mt-3 uppercase tracking-widest">
                Decrypting local vehicle logs...
              </p>
            </div>
          )}

          {/* Secure lock header info within card */}
          <div className="flex items-center justify-between mb-8 pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
              <p className="text-[10px] font-black uppercase tracking-widest text-[#d1d5db]">
                Secure Entry Portal
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-red-950/40 border border-red-900/30 px-2.5 py-0.5 rounded-full">
              <span className="text-[8px] font-bold tracking-wider uppercase text-red-500 font-mono">
                {step === 'username' ? 'STEP_01 / USER' : 'STEP_02 / PASS'}
              </span>
            </div>
          </div>

          {/* DYNAMIC CARD CONTENT BASED ON STEPPED AUTH FLIP */}
          {step === 'username' ? (
            <form onSubmit={handleUsernameSubmit} className="space-y-6 animate-slide-in">
              {/* Username Input Field */}
              <div className="relative group/field">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                  <User className={`w-4 h-4 transition-colors duration-300 ${
                    userFocused || username ? 'text-red-500' : 'text-gray-500'
                  }`} />
                </div>
                
                <input
                  id="username-input"
                  ref={usernameInputRef}
                  type="text"
                  autoComplete="off"
                  className={`w-full bg-[#0c0c10] text-[#f3f4f6] text-sm font-bold pl-11 pr-4 py-4 rounded-xl border outline-none transition-all duration-300 placeholder-transparent ${
                    username 
                      ? 'border-red-900/40 focus:border-red-600' 
                      : 'border-white/5 focus:border-red-800/40 focus:shadow-[0_0_15px_rgba(185,28,28,0.15)]'
                  }`}
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setUserFocused(true)}
                  onBlur={() => setUserFocused(false)}
                />
                
                <label 
                  htmlFor="username-input"
                  className={`absolute left-11 transition-all duration-300 pointer-events-none origin-left ${
                    userFocused || username
                      ? 'top-[-10px] text-[10px] bg-[#0a0a0c] px-2 text-red-500 font-black tracking-widest uppercase scale-90'
                      : 'top-4 text-sm text-gray-500 font-bold'
                  }`}
                >
                  Username
                </label>
              </div>

              {errorMsg && (
                <div className="bg-gradient-to-r from-red-950/40 to-red-900/10 border border-red-900/40 p-4 rounded-xl flex items-start gap-3 animate-slide-in shadow-inner">
                  <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5 animate-bounce" />
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase text-red-400 tracking-wider">
                      Security Fault
                    </p>
                    <p className="text-xs font-bold text-gray-400 mt-1">
                      {errorMsg}
                    </p>
                  </div>
                </div>
              )}

              {/* Next step slider button */}
              <button
                type="submit"
                className="w-full relative py-4 rounded-xl font-black text-xs uppercase tracking-[0.3em] text-white bg-red-700 hover:bg-gradient-to-r hover:from-red-800 hover:to-red-650 active:scale-97 shadow-red-700/10 hover:shadow-red-700/25 flex items-center justify-center gap-3 transition-all duration-300 group/btn"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4 transform group-hover/btn:translate-x-1.5 transition-transform" />
              </button>
            </form>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="space-y-6 animate-slide-in">
              {/* Password Input Field */}
              <div className="relative group/field1">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                  <Lock className={`w-4 h-4 transition-colors duration-300 ${
                    passwordFocused || password ? 'text-red-500' : 'text-gray-500'
                  }`} />
                </div>

                <input
                  id="password-input"
                  ref={passwordInputRef}
                  type={showPassword ? 'text' : 'password'}
                  className={`w-full bg-[#0c0c10] text-[#f3f4f6] text-sm font-bold pl-11 pr-12 py-4 rounded-xl border outline-none transition-all duration-300 placeholder-transparent ${
                    password 
                      ? 'border-red-900/40 focus:border-red-600' 
                      : 'border-white/5 focus:border-red-800/40 focus:shadow-[0_0_15px_rgba(185,28,28,0.15)]'
                  }`}
                  placeholder="Passcode"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  disabled={isLoading || isSuccess}
                />

                <label 
                  htmlFor="password-input"
                  className={`absolute left-11 transition-all duration-300 pointer-events-none origin-left ${
                    passwordFocused || password
                      ? 'top-[-10px] text-[10px] bg-[#0a0a0c] px-2 text-red-500 font-black tracking-widest uppercase scale-90'
                      : 'top-4 text-sm text-gray-500 font-bold'
                  }`}
                >
                  Passcode
                </label>

                {password && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-red-500 transition-colors"
                    disabled={isLoading || isSuccess}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>

              {errorMsg && (
                <div className="bg-gradient-to-r from-red-950/40 to-red-900/10 border border-red-900/40 p-4 rounded-xl flex items-start gap-3 animate-slide-in shadow-inner">
                  <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5 animate-bounce" />
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase text-red-400 tracking-wider">
                      Security Fault
                    </p>
                    <p className="text-xs font-bold text-gray-400 mt-1">
                      {errorMsg}
                    </p>
                  </div>
                </div>
              )}

              {/* Action buttons list */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={triggerFlipToUsername}
                  disabled={isLoading || isSuccess}
                  className="px-4 py-4 rounded-xl border border-white/5 bg-transparent hover:bg-white/5 transition-colors text-gray-400 hover:text-white flex items-center justify-center"
                  title="Back to Username"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <button
                  type="submit"
                  disabled={isLoading || isSuccess}
                  className={`flex-1 relative py-4 rounded-xl font-black text-xs uppercase tracking-[0.3em] text-white flex items-center justify-center gap-2 shadow-2xl transition-all duration-300 overflow-hidden group/btn ${
                    isLoading 
                      ? 'bg-red-850/60 cursor-not-allowed shadow-none' 
                      : 'bg-red-700 hover:bg-gradient-to-r hover:from-red-800 hover:to-red-650 active:scale-97 shadow-red-700/10 hover:shadow-red-700/25'
                  }`}
                >
                  <div className="absolute top-0 bottom-0 left-[-40px] w-12 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 translate-x-[200%] group-hover/btn:animate-[scanner_1.5s_infinite]" />
                  
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span>Initialize Connection</span>
                      <ChevronRight className="w-4 h-4 transform group-hover/btn:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Security Info Panel Footer Details */}
        <div className="mt-8 text-center opacity-30 flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest font-mono">
            SECURE DIRECT IMPORT LINE &bull; AES_256 &bull; CLIENT AUTH
          </span>
        </div>

      </div>

      {/* INFINITE SPEEDWAY RUNNING CAR HIGH-TECH BOTTOM OVERLAY */}
      <div className="absolute bottom-0 left-0 right-0 h-14 bg-[#040405] border-t border-white/5 flex items-center justify-between px-6 z-10 overflow-hidden select-none">
        
        {/* Animated scrolling highway simulation lanes in background */}
        <div className="absolute inset-0 scrolling-road-lines opacity-10 pointer-events-none" />
        
        {/* Real-time status tags */}
        <div className="flex items-center gap-4 text-[9px] font-mono text-gray-500 font-bold z-10 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
            <span className="uppercase text-white">CUSTOMS SEC_LINK_07</span>
          </div>
          <span className="hidden sm:inline text-zinc-600">SYS_LOC: PORT_AUTHORITY_S7</span>
        </div>

        {/* Bottom Cruising Hypercar Miniature Silhouette Animation */}
        <div className="relative w-36 h-full flex items-center justify-end z-10 overflow-hidden group">
          <div className="cruising-mini-car flex items-end">
            <svg viewBox="0 0 100 35" className="w-16 h-8 text-red-600 filter drop-shadow-[0_0_10px_rgba(239,68,68,0.7)]" fill="currentColor">
              <path d="M5,25 Q15,12 35,12 L65,13 Q80,14 85,20 L95,21 Q98,22 98,25 L95,27 Q90,27 88,27 C88,23 80,23 80,27 L25,27 C25,23 17,23 17,27 L5,27 Z" />
              <path d="M5,24 L10,24" stroke="#fff" strokeWidth="1" />
              <circle cx="21" cy="27" r="3.5" fill="#111" stroke="#ef4444" strokeWidth="0.8" />
              <circle cx="84" cy="27" r="3.5" fill="#111" stroke="#ef4444" strokeWidth="0.8" />
            </svg>
            <div className="absolute bottom-3 right-16 w-8 h-[2px] bg-gradient-to-l from-red-650 to-transparent opacity-80 animate-laser-trail" />
          </div>
        </div>

      </div>

    </div>
  );
};

// CSS Stylesheet string block injection to host standard and customized animations
const styleBlock = (
  <style>{`
    @keyframes loginShake {
      0%, 100% { transform: translateX(0); }
      15%, 45%, 75% { transform: translateX(-9px) rotate(-0.5deg); }
      30%, 60%, 90% { transform: translateX(9px) rotate(0.5deg); }
    }
    
    .shake-active {
      animation: loginShake 0.45s cubic-bezier(.36,.07,.19,.97) both;
    }

    .crimson-glow-ring {
      box-shadow: 0 0 50px rgba(185, 28, 28, 0.16), 
                  0 0 15px rgba(0, 0, 0, 0.6), 
                  inset 0 0 20px rgba(185, 28, 28, 0.04);
    }

    .text-shadow-red {
      text-shadow: 0 0 20px rgba(220, 38, 38, 0.7);
    }

    /* Interactive highway laser lanes at the bottom */
    .scrolling-road-lines {
      background: linear-gradient(90deg, transparent 0%, transparent 40%, rgba(220,38,38,0.2) 40%, rgba(220,38,38,0.2) 60%, transparent 60%, transparent 100%);
      background-size: 50px 100%;
      animation: highwayCruise 0.8s linear infinite;
    }

    @keyframes highwayCruise {
      0% { background-position: 0 0; }
      100% { background-position: -50px 0; }
    }

    .cruising-mini-car {
      animation: miniCarDrift 4s ease-in-out infinite alternate;
    }

    @keyframes miniCarDrift {
      0% { transform: translateX(-15px) translateY(1px); }
      50% { transform: translateX(5px) translateY(-1px); }
      100% { transform: translateX(-2px) translateY(1px); }
    }

    @keyframes laser-trail {
      0% { width: 10px; opacity: 0.3; }
      50% { width: 35px; opacity: 0.8; }
      100% { width: 10px; opacity: 0.3; }
    }

    .animate-laser-trail {
      animation: laser-trail 0.7s infinite alternate;
    }

    /* Alloy rim wheel rotational mechanics */
    .car-wheel-spin {
      animation: spinWheel 1.2s linear infinite;
    }

    @keyframes spinWheel {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Inner scanning lasers details */
    @keyframes scanner {
      0% { transform: skewX(-12deg) translateX(-150%); }
      100% { transform: skewX(-12deg) translateX(250%); }
    }

    .animate-scanner {
      animation: scanner 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }

    @keyframes loader-slide {
      0% { left: -50%; width: 50%; }
      100% { left: 100%; width: 50%; }
    }

    .animate-loader-slide {
      animation: loader-slide 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }

    /* Holographic radar style grid */
    .cyberwave-grid {
      background-image: 
        linear-gradient(rgba(220, 38, 38, 0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(220, 38, 38, 0.05) 1px, transparent 1px);
      background-size: 40px 40px;
      perspective: 500px;
      transform: rotateX(60deg) scale(2) translateY(-20%);
    }

    .headlight-glow {
      filter: drop-shadow(0 0 12px rgba(255,255,255,1));
      animation: headlightPulse 2.5s infinite ease-in-out;
    }

    @keyframes headlightPulse {
      0%, 100% { opacity: 0.8; }
      50% { opacity: 1; }
    }

    .laser-beam-left {
      transform-origin: 50px 68px;
      animation: beamSweepLeft 4s infinite ease-in-out;
    }

    .laser-beam-right {
      transform-origin: 350px 68px;
      animation: beamSweepRight 4s infinite ease-in-out;
    }

    @keyframes beamSweepLeft {
      0%, 100% { transform: rotate(-3deg) scaleY(0.9); }
      50% { transform: rotate(4deg) scaleY(1.1); }
    }

    @keyframes beamSweepRight {
      0%, 100% { transform: rotate(3deg) scaleY(0.9); }
      50% { transform: rotate(-4deg) scaleY(1.1); }
    }

    @keyframes slideIn {
      from { transform: translateY(10px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .animate-slide-in {
      animation: slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  `}</style>
);
