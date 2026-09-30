import React, { useState } from 'react';

export interface ResponsiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Base source image path (e.g., '/tech_bridge_landing.webp') */
  src: string;
  /** Image alternative text for accessibility */
  alt: string;
  /** Optional array of responsive widths available (e.g., [360, 480, 768, 1080, 1440]) */
  widths?: number[];
  /** Responsive sizes query (e.g., '(max-width: 480px) 100vw, (max-width: 768px) 95vw, 1080px') */
  sizes?: string;
  /** Explicit AVIF srcset override */
  avifSrcSet?: string;
  /** Explicit WebP srcset override */
  webpSrcSet?: string;
  /** Fallback image path in case of loading error */
  fallbackSrc?: string;
  /** High priority LCP hint (sets fetchPriority="high", loading="eager", decoding="async") */
  priority?: boolean;
  /** CSS aspect-ratio string to prevent Cumulative Layout Shift (CLS) */
  aspectRatio?: string;
  /** Additional wrapper class for the picture container */
  containerClassName?: string;
}

/**
 * Helper to generate responsive srcset string from a base URL and array of widths
 * Example: '/tech_bridge_landing.webp', [360, 480, 768] -> '/tech_bridge_landing_360w.webp 360w, ...'
 */
export function buildResponsiveSrcSet(basePath: string, widths: number[], format?: 'avif' | 'webp'): string {
  // Strip extension and any existing width suffix
  const cleanPath = basePath.replace(/\.(avif|webp|jpe?g|png)$/i, '').replace(/(_\d+w|_mobile)$/i, '');
  const ext = format || (basePath.split('.').pop()?.toLowerCase() || 'webp');
  
  return widths
    .map((w) => `${cleanPath}_${w}w.${ext} ${w}w`)
    .join(', ');
}

/**
 * ResponsiveImage Component
 * Serves optimized modern formats (AVIF, WebP) with precise srcset and sizes attributes,
 * minimizing transfer bytes for mobile/desktop viewports and improving LCP.
 */
export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  src,
  alt,
  widths,
  sizes = '(max-width: 480px) 100vw, (max-width: 768px) 95vw, (max-width: 1200px) 80vw, 1080px',
  avifSrcSet,
  webpSrcSet,
  fallbackSrc,
  priority = false,
  aspectRatio,
  containerClassName = '',
  className = '',
  style,
  loading,
  decoding,
  fetchPriority,
  onError,
  ...restProps
}) => {
  const [currentSrc, setCurrentSrc] = useState<string>(src);
  const [hasError, setHasError] = useState<boolean>(false);

  // Automatically derive AVIF and WebP srcsets if widths are provided and no explicit override is given
  const resolvedAvifSrcSet = avifSrcSet || (widths && widths.length > 0 ? buildResponsiveSrcSet(src, widths, 'avif') : undefined);
  const resolvedWebpSrcSet = webpSrcSet || (widths && widths.length > 0 ? buildResponsiveSrcSet(src, widths, 'webp') : undefined);
  const resolvedImgSrcSet = resolvedWebpSrcSet;

  // LCP Priority settings
  const resolvedLoading: 'lazy' | 'eager' = loading || (priority ? 'eager' : 'lazy');
  const resolvedDecoding: 'async' | 'sync' | 'auto' = decoding || 'async';
  const resolvedFetchPriority: 'high' | 'low' | 'auto' = fetchPriority || (priority ? 'high' : 'auto');

  const combinedStyle: React.CSSProperties = {
    ...(aspectRatio ? { aspectRatio } : {}),
    ...style,
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!hasError && fallbackSrc) {
      setHasError(true);
      setCurrentSrc(fallbackSrc);
    }
    if (onError) {
      onError(e);
    }
  };

  return (
    <picture className={containerClassName}>
      {/* 1. Ultra-light modern AVIF format with viewport width matching */}
      {resolvedAvifSrcSet && (
        <source
          type="image/avif"
          srcSet={resolvedAvifSrcSet}
          sizes={sizes}
        />
      )}

      {/* 2. Modern WebP format fallback */}
      {resolvedWebpSrcSet && (
        <source
          type="image/webp"
          srcSet={resolvedWebpSrcSet}
          sizes={sizes}
        />
      )}

      {/* 3. Base Image with responsive srcset and sizes */}
      <img
        src={currentSrc}
        alt={alt}
        srcSet={resolvedImgSrcSet}
        sizes={sizes}
        loading={resolvedLoading}
        decoding={resolvedDecoding}
        fetchPriority={resolvedFetchPriority}
        style={combinedStyle}
        className={className}
        onError={handleError}
        {...restProps}
      />
    </picture>
  );
};
