"use client";

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  color: string;
}

interface Spark {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  size: number;
}

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const sparksRef = useRef<Spark[]>([]);
  const animationRef = useRef<number>(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Initialize star particles
    const colors = ['#00D4FF', '#7B61FF', '#F4F7FF', '#8A95B5', '#FF6B35'];
    const particleCount = 100;
    particlesRef.current = Array.from({ length: particleCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2.2 + 0.3,
      speedX: (Math.random() - 0.5) * 0.15,
      speedY: (Math.random() - 0.5) * 0.15,
      opacity: Math.random() * 0.6 + 0.08,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    // Initialize electric sparks
    sparksRef.current = [];

    const animate = () => {
      frameRef.current++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw faint grid lines (control-room monitor feel)
      ctx.globalAlpha = 0.025;
      ctx.strokeStyle = '#00D4FF';
      ctx.lineWidth = 0.5;
      const gridSize = 80;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw star particles
      particlesRef.current.forEach(p => {
        p.x += p.speedX;
        p.y += p.speedY;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        // Twinkling effect
        const twinkle = Math.sin(frameRef.current * 0.02 + p.x * 0.01) * 0.3 + 0.7;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity * twinkle;
        ctx.fill();

        // Star glow for larger particles
        if (p.size > 1.5) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
          const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
          glow.addColorStop(0, p.color);
          glow.addColorStop(1, 'transparent');
          ctx.fillStyle = glow;
          ctx.globalAlpha = p.opacity * twinkle * 0.3;
          ctx.fill();
        }
      });

      // Spawn electric sparks randomly
      if (frameRef.current % 30 === 0 && sparksRef.current.length < 5) {
        sparksRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          life: 0,
          maxLife: 12 + Math.random() * 10,
          size: 2 + Math.random() * 4,
        });
      }

      // Draw electric sparks
      sparksRef.current = sparksRef.current.filter(s => {
        s.life++;
        if (s.life > s.maxLife) return false;

        const progress = s.life / s.maxLife;
        const alpha = progress < 0.3 ? progress / 0.3 : 1 - (progress - 0.3) / 0.7;

        // Bright core
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = alpha;
        ctx.fill();

        // Electric glow ring
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 2, 0, Math.PI * 2);
        const sparkGlow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 2);
        sparkGlow.addColorStop(0, '#00D4FF');
        sparkGlow.addColorStop(0.5, 'rgba(0, 212, 255, 0.3)');
        sparkGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = sparkGlow;
        ctx.globalAlpha = alpha * 0.6;
        ctx.fill();

        // Outer violet halo
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 5, 0, Math.PI * 2);
        const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 5);
        halo.addColorStop(0, 'rgba(123, 97, 255, 0.2)');
        halo.addColorStop(1, 'transparent');
        ctx.fillStyle = halo;
        ctx.globalAlpha = alpha * 0.3;
        ctx.fill();

        return true;
      });

      // Draw nebula clouds
      ctx.globalAlpha = 0.035;
      const gradient1 = ctx.createRadialGradient(
        canvas.width * 0.25, canvas.height * 0.3, 0,
        canvas.width * 0.25, canvas.height * 0.3, canvas.width * 0.3
      );
      gradient1.addColorStop(0, '#00D4FF');
      gradient1.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const gradient2 = ctx.createRadialGradient(
        canvas.width * 0.75, canvas.height * 0.6, 0,
        canvas.width * 0.75, canvas.height * 0.6, canvas.width * 0.25
      );
      gradient2.addColorStop(0, '#7B61FF');
      gradient2.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Orange thrust nebula (bottom center)
      ctx.globalAlpha = 0.02;
      const gradient3 = ctx.createRadialGradient(
        canvas.width * 0.5, canvas.height * 0.85, 0,
        canvas.width * 0.5, canvas.height * 0.85, canvas.width * 0.2
      );
      gradient3.addColorStop(0, '#FF6B35');
      gradient3.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient3;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.globalAlpha = 1;
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}
