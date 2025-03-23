'use client';
import React from 'react';
import {
  motion,
  useAnimationFrame,
  useMotionTemplate,
  useMotionValue,
  useTransform,
} from 'framer-motion';
import { useRef } from 'react';
import { cn } from '@/lib/utils';

export const MovingBorder = ({
  children,
  duration = 2000,
  rx = '16px',
  ry = '16px',
  containerClassName,
  borderClassName,
  borderWidth = 80, // New prop for border width in pixels
  borderHeight = 24, // New prop for border height in pixels
  ...otherProps
}: {
  children: React.ReactNode;
  duration?: number;
  rx?: string;
  ry?: string;
  containerClassName?: string;
  borderClassName?: string;
  borderWidth?: number;
  borderHeight?: number;
  [key: string]: any;
}) => {
  const pathRef = useRef<any>();
  const progress = useMotionValue<number>(0);
  const colorProgress = useMotionValue<number>(0);

  // Control both position and color with animation frame
  useAnimationFrame((time) => {
    const length = pathRef.current?.getTotalLength();
    if (length) {
      const pxPerMillisecond = length / duration;
      progress.set((time * pxPerMillisecond) % length);

      // Update color progress (cycles every 10 seconds)
      const colorDuration = 10000;
      colorProgress.set((time % colorDuration) / colorDuration);
    }
  });

  // Transform color progress to hue rotation (0-360)
  const hue = useTransform(colorProgress, [0, 1], [0, 360]);

  const x = useTransform(
    progress,
    (val) => pathRef.current?.getPointAtLength(val).x
  );
  const y = useTransform(
    progress,
    (val) => pathRef.current?.getPointAtLength(val).y
  );

  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`;
  const backgroundColor = useMotionTemplate`hsl(${hue}, 80%, 60%)`;

  return (
    <div
      className={cn(
        'relative p-[1px] overflow-hidden rounded-lg',
        containerClassName
      )}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="absolute h-full w-full"
        width="100%"
        height="100%"
        {...otherProps}
      >
        <rect
          fill="none"
          width="100%"
          height="100%"
          rx={rx}
          ry={ry}
          ref={pathRef}
        />
      </svg>
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          display: 'inline-block',
          transform,
        }}
      >
        <motion.div
          style={{
            backgroundColor,
            filter: 'blur(8px)',
            width: `${borderWidth}px`,
            height: `${borderHeight}px`,
          }}
          className={cn('opacity-[0.8]', borderClassName)}
        />
      </motion.div>
      <div className="relative">{children}</div>
    </div>
  );
};

export const AnimatedInputBorder = ({
  children,
  className,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}) => {
  return (
    <MovingBorder
      containerClassName={className}
      borderClassName="opacity-70"
      duration={3500}
      rx="50px"
      ry="50px"
      borderWidth={160}
      borderHeight={160}
      {...props}
    >
      {children}
    </MovingBorder>
  );
};
