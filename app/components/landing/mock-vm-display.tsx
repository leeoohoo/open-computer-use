"use client"

import { motion } from "framer-motion"
import Image from "next/image"

export function MockVMDisplay() {
  return (
    <motion.div 
      className="relative w-full"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* GIF Content */}
      <div className="relative rounded-xl overflow-hidden shadow-2xl">
        <Image
          src="/Pi7_Gif.gif"
          alt="AI Agent Demo"
          width={1200}
          height={675}
          className="w-full h-auto"
          unoptimized // Important for GIFs to animate
          priority
        />
      </div>
    </motion.div>
  )
}
