"use client";

import React from "react";

interface LaunchpadLogoProps {
  className?: string;
  variant?: "full" | "icon" | "mark";
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
}

/**
 * The stylized rocket chevron "A" glyph from the official Launchpad brand logo.
 */
export function LaunchpadChevronGlyph({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Left facet gradient: Deep fiery red-orange to bright crimson */}
        <linearGradient id="lpChevronLeft" x1="20" y1="90" x2="50" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#D92205" />
          <stop offset="50%" stopColor="#EA2B0F" />
          <stop offset="100%" stopColor="#FF5A36" />
        </linearGradient>
        {/* Right facet gradient: Blazing rocket orange to solar amber */}
        <linearGradient id="lpChevronRight" x1="80" y1="90" x2="50" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF5A00" />
          <stop offset="60%" stopColor="#FF7A00" />
          <stop offset="100%" stopColor="#FFA600" />
        </linearGradient>
        {/* Outer ambient glow */}
        <filter id="lpGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Glow Layer */}
      <path
        d="M50 8 L88 88 L58 88 L50 48 L42 88 L12 88 Z"
        fill="#FF6A00"
        opacity="0.3"
        filter="url(#lpGlow)"
      />

      {/* Left Facet Plane */}
      <path
        d="M50 8 L50 48 L42 88 L12 88 Z"
        fill="url(#lpChevronLeft)"
      />

      {/* Right Facet Plane */}
      <path
        d="M50 8 L88 88 L58 88 L50 48 Z"
        fill="url(#lpChevronRight)"
      />
    </svg>
  );
}

export function LaunchpadLogo({
  className = "",
  variant = "full",
  size = "md",
}: LaunchpadLogoProps) {
  if (variant === "icon") {
    const iconSizes = {
      sm: "w-6 h-6",
      md: "w-8 h-8",
      lg: "w-10 h-10",
      xl: "w-12 h-12",
    };
    return <LaunchpadChevronGlyph className={`${iconSizes[size]} ${className}`} />;
  }

  // Sizing for full logo image
  const heights = {
    sm: "h-7",
    md: "h-9",
    lg: "h-12",
    xl: "h-16",
  };

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      {/* High-res transparent dark mode brand logo */}
      <div className={`relative ${heights[size]} w-auto flex items-center`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/launchpad-logo.png"
          alt="LAUNCHPAD - IDEAS BUILD SCALE"
          className="h-full w-auto object-contain"
        />
      </div>
    </div>
  );
}

export default LaunchpadLogo;
