"use client";
import React from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  MotionValue,
} from "framer-motion";
import { Play } from "@phosphor-icons/react";
import { CoastyIcon } from "@/components/icons/coasty";
import Link from "next/link";

// Main component that handles client-side detection
export const HeroParallaxChat = ({
  demos,
}: {
  demos: {
    title: string;
    chatId: string;
    description?: string;
    thumbnail?: string;
  }[];
}) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Show static version during SSR and initial mount
  if (!mounted) {
    return (
      <div className="h-[60vh] py-16 overflow-x-auto antialiased relative flex items-center">
        <div className="flex flex-row space-x-8 px-20">
          {demos.map((demo, index) => (
            <StaticChatPreviewCard
              demo={demo}
              key={`${demo.chatId}-${index}`}
            />
          ))}
        </div>
      </div>
    );
  }

  // Once mounted, show the animated version
  return <AnimatedHeroParallax demos={demos} />;
};

// Animated version that uses scroll hooks
const AnimatedHeroParallax = ({
  demos,
}: {
  demos: {
    title: string;
    chatId: string;
    description?: string;
    thumbnail?: string;
  }[];
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Simplified spring config for better performance
  const springConfig = { stiffness: 150, damping: 20 };

  const translateX = useSpring(
    useTransform(scrollYProgress, [0, 1], [200, -200]),
    springConfig
  );
  
  // Simplified transformations for single row
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.6, 1, 1, 0.6]);
  
  return (
    <div
      ref={ref}
      className="h-[60vh] py-16 overflow-hidden antialiased relative flex items-center justify-center"
    >
      <motion.div
        style={{
          opacity,
        }}
        className="w-full"
      >
        <motion.div className="flex flex-row space-x-20 px-20">
          {demos.map((demo, index) => (
            <ChatPreviewCard
              demo={demo}
              translate={translateX}
              key={`${demo.chatId}-${index}`}
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
};

// Optimized card component
export const ChatPreviewCard = ({
  demo,
  translate,
}: {
  demo: {
    title: string;
    chatId: string;
    description?: string;
    thumbnail?: string;
  };
  translate: MotionValue<number>;
}) => {
  return (
    <motion.div
      style={{
        x: translate,
      }}
      whileHover={{
        y: -10,
        transition: { duration: 0.2, ease: "easeOut" }
      }}
      className="group h-96 w-[30rem] relative shrink-0"
    >
      <Link
        href={`https://coasty.ai/share/${demo.chatId}`}
        target="_blank"
        className="block relative h-full w-full rounded-xl overflow-hidden border border-border/50 bg-card hover:shadow-2xl transition-shadow duration-300"
      >
        {/* Simplified background - no complex gradients or animations */}
        <div className="absolute inset-0 bg-gradient-to-br from-background to-muted/30">
          {/* Simple grid pattern */}
          <div 
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
              backgroundSize: '30px 30px',
            }}
          />
        </div>
        
        {/* Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
          <div className="text-center space-y-4">
            {/* Icon */}
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <CoastyIcon className="h-10 w-10 text-primary/60" />
            </div>
            
            {/* Title */}
            <h3 className="text-2xl font-bold text-foreground line-clamp-2 max-w-sm mx-auto">
              {demo.title}
            </h3>
            
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 border border-border/50">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-muted-foreground font-mono">
                Live Demo
              </span>
            </div>
          </div>
        </div>
        
        {/* Simple hover overlay - CSS only, no motion */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors duration-300 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary shadow-xl">
              <Play
                weight="fill"
                className="h-8 w-8 text-primary-foreground ml-1"
              />
            </div>
          </div>
        </div>
        
        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background/90 to-transparent">
          <h2 className="text-xl font-bold text-foreground mb-2">
            {demo.title}
          </h2>
          {demo.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {demo.description}
            </p>
          )}
        </div>
      </Link>
    </motion.div>
  );
};

// Static fallback component for SSR/production
export const StaticChatPreviewCard = ({
  demo,
}: {
  demo: {
    title: string;
    chatId: string;
    description?: string;
    thumbnail?: string;
  };
}) => {
  return (
    <div className="group h-96 w-[30rem] relative shrink-0 hover:-translate-y-2 transition-transform duration-200">
      <Link
        href={`https://coasty.ai/share/${demo.chatId}`}
        target="_blank"
        className="block relative h-full w-full rounded-xl overflow-hidden border border-border/50 bg-card hover:shadow-2xl transition-shadow duration-300"
      >
        {/* Simplified background - no complex gradients or animations */}
        <div className="absolute inset-0 bg-gradient-to-br from-background to-muted/30">
          {/* Simple grid pattern */}
          <div 
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
              backgroundSize: '30px 30px',
            }}
          />
        </div>
        
        {/* Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
          <div className="text-center space-y-4">
            {/* Icon */}
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <CoastyIcon className="h-10 w-10 text-primary/60" />
            </div>
            
            {/* Title */}
            <h3 className="text-2xl font-bold text-foreground line-clamp-2 max-w-sm mx-auto">
              {demo.title}
            </h3>
            
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 border border-border/50">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-muted-foreground font-mono">
                Live Demo
              </span>
            </div>
          </div>
        </div>
        
        {/* Simple hover overlay - CSS only */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors duration-300 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary shadow-xl">
              <Play
                weight="fill"
                className="h-8 w-8 text-primary-foreground ml-1"
              />
            </div>
          </div>
        </div>
        
        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background/90 to-transparent">
          <h2 className="text-xl font-bold text-foreground mb-2">
            {demo.title}
          </h2>
          {demo.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {demo.description}
            </p>
          )}
        </div>
      </Link>
    </div>
  );
};