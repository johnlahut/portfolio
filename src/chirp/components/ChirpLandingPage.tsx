import '@fontsource-variable/manrope';
import '@fontsource-variable/plus-jakarta-sans';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Bell, Play, ScanFace, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import { ChirpLogo } from './ChirpLogo';

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

type Feature = {
  icon: LucideIcon;
  iconClass: string;
  iconBg: string;
  title: string;
  titleGradient: string;
  borderColor: string;
  bgGradient: string;
  description: string;
};

const PHOTO_CARDS = [
  {
    src: 'https://images.unsplash.com/photo-1761208663763-c4d30657c910?w=480&q=80',
    alt: 'First Class',
    label: 'First Class 🎒',
    className: 'left-5 top-20 h-[320px] w-[240px] -rotate-[8deg]',
    imgHeight: 'h-[240px]',
  },
  {
    src: 'https://images.unsplash.com/photo-1769720200489-84c8f7b67ccd?w=440&q=80',
    alt: 'Art Class',
    label: 'Art Class 🎨',
    className: 'left-[200px] top-5 h-[290px] w-[220px] rotate-[5deg]',
    imgHeight: 'h-[210px]',
  },
  {
    src: 'https://images.unsplash.com/photo-1736276174371-b4a6cd5f14b3?w=400&q=80',
    alt: 'Story Time',
    label: 'Story Time 📚',
    className: 'left-40 top-60 h-[260px] w-[200px] -rotate-[3deg]',
    imgHeight: 'h-[180px]',
  },
];

const FEATURES: Feature[] = [
  {
    icon: ScanFace,
    iconClass: 'text-[#FF8F5E]',
    iconBg: 'bg-[#E08B5A2E]',
    title: 'Smart Tagging',
    titleGradient: 'from-[#FFBE92] to-[#FFE7CF]',
    borderColor: 'border-chirp-border-warm/20',
    bgGradient:
      'bg-[linear-gradient(160deg,var(--chirp-card),var(--chirp-surface))]',
    description:
      "Our privacy-first AI recognizes faces securely and organizes photos automatically into each child's digital journal.",
  },
  {
    icon: Bell,
    iconClass: 'text-[#C084FC]',
    iconBg: 'bg-[#D8A36D2B]',
    title: 'Instant Updates',
    titleGradient: 'from-[#F0C793] to-[#FFE7CF]',
    borderColor: 'border-chirp-border-warm/20',
    bgGradient:
      'bg-[linear-gradient(160deg,var(--chirp-card),var(--chirp-surface))]',
    description:
      "Parents get that warm fuzzy feeling in real-time with a secure, private feed of their little one's day as it happens.",
  },
  {
    icon: ShieldCheck,
    iconClass: 'text-[#4ADE80]',
    iconBg: 'bg-[#83B6902E]',
    title: 'Privacy First',
    titleGradient: 'from-[#9BCB95] to-[#E9F6E2]',
    borderColor: 'border-chirp-border-green/20',
    bgGradient:
      'bg-[linear-gradient(160deg,var(--chirp-card),var(--chirp-surface))]',
    description:
      'Your data stays safe. We prioritize privacy above all else with encrypted storage and strict access controls.',
  },
];

/* ------------------------------------------------------------------ */
/*  Animation helpers                                                  */
/* ------------------------------------------------------------------ */

const ease = [0.25, 0.1, 0.25, 1] as const;
const springy = { type: 'spring', stiffness: 120, damping: 14 } as const;
const viewport = { once: true, margin: '-80px' } as const;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ChirpLandingPage() {
  return (
    <div
      className="
      relative mx-auto min-h-screen w-full max-w-7xl overflow-x-hidden
      bg-chirp-page font-sans
    "
    >
      {/* ── Navbar ───────────────────────────────────────────────── */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="
          flex h-[72px] w-full items-center justify-between px-5
          md:px-20
        "
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <ChirpLogo />
          <span className="font-brand text-xl font-bold text-chirp-text">
            Chirp
          </span>
        </div>

        {/* Login */}
        <Link to="/chirp/login">
          <Button
            className="
            h-auto rounded-full border-0 bg-linear-[135deg]
            from-chirp-accent-start to-chirp-accent-end px-6 py-2.5 text-sm
            font-semibold text-white
            hover:opacity-90
          "
          >
            Log in
          </Button>
        </Link>
      </motion.nav>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section
        className="
        flex min-h-0 w-full flex-col items-center gap-10 px-5 py-10
        md:min-h-[620px] md:flex-row md:items-center md:gap-[60px] md:px-20
        md:py-[60px]
      "
      >
        {/* Left content */}
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          {/* Headlines */}
          <div
            className="
            flex w-full flex-col
            md:w-min md:whitespace-nowrap
          "
          >
            <motion.h1
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.6, ease }}
              className="
                m-0 font-heading text-[40px] leading-[1.05] font-extrabold
                tracking-[-1.5px] text-chirp-text
                md:text-[68px]
              "
            >
              Little moments,
            </motion.h1>
            <motion.h1
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.6, ease }}
              className="
                m-0 bg-linear-to-r from-[#F8DD9A] via-[#F0C071] to-[#E5865A]
                bg-clip-text pb-2 font-heading text-[40px] leading-[1.05]
                font-extrabold tracking-[-1.5px] text-transparent
                md:text-[68px]
              "
            >
              big memories.
            </motion.h1>
          </div>

          {/* Subline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5, ease }}
            className="
              m-0 text-[15px] leading-[1.6] text-chirp-text-body
              md:text-[17px]
            "
          >
            The privacy-first photo journal for modern daycares
            <br />
            that turns scattered snapshots into organized,
            <br />
            automated memories.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5, ease }}
            className="
              flex flex-col items-stretch gap-4
              sm:flex-row sm:items-center
            "
          >
            <Link to="/chirp/gallery">
              <Button
                className="
                h-auto gap-2 rounded-full border-0 bg-linear-[135deg]
                from-chirp-accent-start to-chirp-accent-end px-7 py-3.5
                text-[15px] font-bold text-white
                hover:opacity-90
              "
              >
                Start Your Chirp
                <ArrowRight size={16} />
              </Button>
            </Link>
            <Link to="/chirp/coming-soon">
              <Button
                variant="outline"
                className="
                  h-auto gap-2 rounded-full border-chirp-accent/40
                  bg-transparent px-7 py-3.5 text-[15px] font-medium
                  text-[#E8E0FF]
                  hover:bg-chirp-accent/6
                "
              >
                <span
                  className="
                  inline-flex size-5 shrink-0 items-center justify-center
                  rounded-full bg-linear-[135deg] from-[#7C3AED] to-[#FF6B35]
                "
                >
                  <Play size={10} fill="#fff" className="text-white" />
                </span>
                See how it works
              </Button>
            </Link>
          </motion.div>
        </div>

        {/* Right: Hero visual */}
        <div
          className="
          relative hidden h-[500px] w-[430px] shrink-0
          lg:block
        "
        >
          {/* Glow */}
          <div
            className="
            pointer-events-none absolute top-[100px] left-[110px] size-[300px]
            rounded-full
            bg-[radial-gradient(ellipse,var(--chirp-accent)_0%,transparent)]
          "
          />

          {/* Photo cards */}
          {PHOTO_CARDS.map((card, i) => (
            <motion.div
              key={card.alt}
              initial={{ opacity: 0, scale: 0.8, rotate: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                delay: 0.5 + i * 0.2,
                ...springy,
              }}
              className={`
                absolute overflow-hidden rounded-2xl border
                border-chirp-border-warm/25 bg-chirp-surface
                shadow-[0_12px_40px_rgba(0,0,0,0.3)]
                ${card.className}
              `}
            >
              <img
                src={card.src}
                alt={card.alt}
                className={`
                  w-full object-cover
                  ${card.imgHeight}
                `}
              />
              <div className="flex items-center px-4 py-3">
                <span className="text-[13px] font-medium text-chirp-text-body">
                  {card.label}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Divider ──────────────────────────────────────────────── */}
      <Separator
        className="
        h-px w-full
        bg-[linear-gradient(90deg,transparent,var(--chirp-accent)_34%,#F0C071_56%,#D78D60_76%,transparent)]
      "
      />

      {/* ── Features ─────────────────────────────────────────────── */}
      <section
        className="
        flex w-full flex-col items-center gap-10
        bg-[linear-gradient(180deg,var(--chirp-section),var(--chirp-section-mid)_50%,var(--chirp-section))]
        px-5 py-14
        md:gap-[60px] md:p-20
      "
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewport}
          transition={{ duration: 0.6, ease }}
          className="flex max-w-[600px] flex-col items-center gap-4"
        >
          <h2
            className="
            m-0 bg-linear-to-l from-chirp-text via-chirp-border-warm
            to-chirp-accent-end bg-clip-text text-center font-heading
            text-[28px] font-extrabold tracking-[-1px] text-transparent
            md:text-[44px]
          "
          >
            Why daycares love Chirp
          </h2>
          <p
            className="
            m-0 text-center text-base leading-[1.6] text-chirp-text-body
          "
          >
            Designed for busy staff and anxious parents alike. We handle the
            memories so
            <br />
            you can focus on the moments.
          </p>
        </motion.div>

        {/* Cards */}
        <div
          className="
          flex w-full flex-col gap-6
          md:flex-row
        "
        >
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={viewport}
              transition={{ delay: i * 0.15, duration: 0.5, ease }}
              className="flex-1"
            >
              <Card
                className={`
                  ring-0
                  ${feature.bgGradient}
                  gap-0 overflow-visible rounded-2xl border
                  ${feature.borderColor}
                  h-full p-0 text-base
                `}
              >
                <CardContent className="flex flex-col gap-5 p-8">
                  <div
                    className={`
                      flex size-12 items-center justify-center rounded-xl
                      ${feature.iconBg}
                    `}
                  >
                    <feature.icon size={24} className={feature.iconClass} />
                  </div>
                  <CardTitle
                    className={`
                      bg-linear-to-b
                      ${feature.titleGradient}
                      bg-clip-text font-heading text-[22px] font-extrabold
                      text-transparent
                    `}
                  >
                    {feature.title}
                  </CardTitle>
                  <CardDescription
                    className="
                    text-sm leading-[1.6] text-chirp-text-muted
                  "
                  >
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section
        className="
        flex w-full flex-col items-center
        bg-[linear-gradient(180deg,var(--chirp-section),var(--chirp-section-mid))]
        px-5 py-10
        md:px-20
      "
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={viewport}
          transition={{ duration: 0.6, ease }}
          className="w-full"
        >
          <Card
            className="
            flex w-full flex-col items-center gap-6 overflow-visible rounded-3xl
            border border-chirp-border-warm/18
            bg-[linear-gradient(135deg,#4A2F27,#5B3428_52%,#3F2E25)] p-0
            text-base ring-0
          "
          >
            <CardContent
              className="
              flex flex-col items-center gap-6 px-6 py-10
              md:px-20 md:py-16
            "
            >
              <h2
                className="
                m-0 bg-linear-to-b from-[#FFC59A] via-[#F6CF9B] to-[#FDE6BF]
                bg-clip-text text-center font-heading text-[26px] font-extrabold
                tracking-[-0.5px] text-transparent
                md:text-[40px]
              "
              >
                Ready to capture the joy?
              </h2>
              <p
                className="
                m-0 text-center text-base leading-[1.6] text-chirp-text-body
              "
              >
                Join modern daycares transforming how they share
                <br />
                memories with families.
              </p>
              <Link to="/chirp/coming-soon">
                <Button
                  className="
                  h-auto rounded-full border-0 bg-linear-[135deg]
                  from-chirp-accent-start to-chirp-accent-end px-8 py-4
                  text-base font-bold text-white
                  hover:opacity-90
                "
                >
                  Get Started for Free
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={viewport}
        transition={{ duration: 0.5 }}
        className="
          flex w-full flex-col items-center gap-6 border-t
          border-chirp-border/50 px-5 py-10
          md:flex-row md:justify-between md:gap-0 md:px-20
        "
      >
        <div className="flex items-center gap-2.5">
          <ChirpLogo size="sm" />
          <span className="font-brand text-sm font-semibold text-chirp-text-dim">
            Chirp
          </span>
        </div>

        <span className="text-xs text-chirp-text-faint">
          © 2026 Chirp Inc. All rights reserved.
        </span>
      </motion.footer>
    </div>
  );
}
