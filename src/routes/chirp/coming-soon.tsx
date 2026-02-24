import { Link, createFileRoute } from '@tanstack/react-router';
import { motion } from 'motion/react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { ChirpLogo } from '~/chirp/components/ChirpLogo';

const PREVIEW_CARDS = [
  {
    src: 'https://images.unsplash.com/photo-1680298695395-e6250f105d26?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NDM0ODN8MHwxfHJhbmRvbXx8fHx8fHx8fDE3NzE3Mjc0ODJ8&ixlib=rb-4.1.0&q=80&w=1080',
    filename: 'image_0248.jpg',
    status: 'Status: Queued',
    className: 'left-14 top-[86px] h-[300px] w-[232px] -rotate-[8deg]',
    imageClassName: 'h-[200px]',
    statusClassName:
      'border-chirp-border/50 bg-chirp-panel text-chirp-text-muted',
  },
  {
    src: 'https://images.unsplash.com/photo-1544959112-aeaba2de733f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NDM0ODN8MHwxfHJhbmRvbXx8fHx8fHx8fDE3NzE3Mjc0ODN8&ixlib=rb-4.1.0&q=80&w=1080',
    filename: 'batch_11_993.png',
    status: 'Status: Complete',
    className: 'left-[258px] top-[42px] h-[302px] w-[294px] rotate-[6deg]',
    imageClassName: 'h-[206px]',
    statusClassName:
      'border-chirp-border-green/40 bg-chirp-border-green/10 text-chirp-border-green',
  },
];

const ease = [0.25, 0.1, 0.25, 1] as const;
const springy = { type: 'spring', stiffness: 120, damping: 14 } as const;

export const Route = createFileRoute('/chirp/coming-soon')({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div
      className="
      relative min-h-screen w-full overflow-hidden bg-chirp-page font-sans
    "
    >
      <div className="pointer-events-none absolute inset-0">
        <div
          className="
          absolute -top-24 -left-24 h-[420px] w-[560px] rounded-full
          bg-[radial-gradient(ellipse,var(--chirp-accent-start)_0%,transparent_70%)]
          opacity-20 blur-[2px]
        "
        />
        <div
          className="
          absolute top-10 right-8 h-[300px] w-[420px] rounded-full
          bg-[radial-gradient(ellipse,var(--chirp-border-warm)_0%,transparent_72%)]
          opacity-[0.12] blur-[2px]
        "
        />
        <div
          className="
          absolute top-2/3 left-1/2 h-[300px] w-[840px] -translate-x-1/2
          -translate-y-1/2 rounded-full
          bg-[radial-gradient(ellipse,var(--chirp-border)_0%,transparent_72%)]
          opacity-15
        "
        />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-col">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="
            flex h-[72px] w-full items-center justify-between px-6
            md:px-16
          "
        >
          <Link to="/chirp">
            <div className="flex items-center gap-2.5">
              <ChirpLogo />
              <span
                className="
                font-brand text-[15px] font-semibold text-chirp-text
              "
              >
                Chirp
              </span>
            </div>
          </Link>
        </motion.header>

        <main
          className="
          flex w-full flex-1 flex-col gap-14 px-6 pt-12 pb-16
          md:px-16
          lg:flex-row lg:items-center lg:justify-between lg:pt-14
        "
        >
          <section className="flex w-full max-w-[560px] flex-col gap-6">
            <motion.h1
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.6, ease }}
              className="
                max-w-[560px] bg-linear-[90deg] from-chirp-text
                via-chirp-border-warm to-chirp-accent-end bg-clip-text pb-4
                font-heading text-[42px] leading-[1.04] font-extrabold
                tracking-[-1.1px] text-transparent
                md:text-[64px]
              "
            >
              Coming soon
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.5, ease }}
              className="
                max-w-[520px] text-base leading-[1.6] text-chirp-text-body
                md:text-[17px]
              "
            >
              Your memories, beautifully organized. Upload photos, bring your
              own collection, or mix both. We handle the intelligence and
              indexing—you focus on sharing what matters.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.5, ease }}
              className="
                flex w-full max-w-[500px] flex-col gap-2
                sm:flex-row sm:items-center
              "
            >
              <Input
                type="email"
                placeholder="name@company.com"
                className="
                  h-[42px] rounded-[10px] border-chirp-border-warm/40
                  bg-chirp-surface px-3 text-sm text-chirp-text
                  placeholder:text-chirp-text-faint
                  sm:w-[340px]
                "
              />
              <Button
                className="
                h-[42px] rounded-[10px] border border-chirp-border-warm/45
                bg-linear-[135deg] from-chirp-accent-start to-chirp-accent-end
                px-5 text-sm font-semibold text-chirp-page
                hover:opacity-90
                sm:w-[132px]
              "
              >
                Notify me
              </Button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65, duration: 0.5, ease }}
              className="text-sm font-medium text-chirp-text-dim"
            >
              Early access in Summer 2026. Sign up to stay informed.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.7, duration: 0.6, ease }}
              style={{ originX: 0 }}
              className="
                h-[10px] w-full max-w-[440px] overflow-hidden rounded-full
                border border-chirp-border/70 bg-chirp-surface
              "
            >
              <div
                className="
                h-full w-[70%] rounded-full bg-linear-[90deg]
                from-chirp-accent-start to-chirp-accent-end
              "
              />
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.75, duration: 0.5, ease }}
              className="text-xs text-chirp-text-dim"
            >
              Queueing, processing, and delivery are being tuned for
              reliability.
            </motion.p>
          </section>

          <section className="relative h-[420px] w-full max-w-[640px]">
            <div
              className="
              absolute top-[42px] left-[70px] h-[320px] w-[420px] rounded-full
              bg-[radial-gradient(circle,var(--chirp-accent)_0%,transparent_72%)]
              opacity-25
            "
            />

            {PREVIEW_CARDS.map((card, i) => (
              <motion.div
                key={card.filename}
                initial={{ opacity: 0, scale: 0.8, rotate: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.2, ...springy }}
                className={`
                  absolute overflow-hidden rounded-2xl border
                  border-chirp-border-warm/40 bg-chirp-surface py-0 shadow-2xl
                  ${card.className}
                `}
              >
                <img
                  src={card.src}
                  alt={card.filename}
                  className={`
                    w-full object-cover
                    ${card.imageClassName}
                  `}
                />
                <CardContent className="space-y-1 px-3 py-3">
                  <p className="text-xs font-semibold text-chirp-text">
                    {card.filename}
                  </p>
                  <Badge
                    variant="outline"
                    className={`
                      h-6 rounded-full px-2.5 text-[11px]
                      ${card.statusClassName}
                    `}
                  >
                    {card.status}
                  </Badge>
                </CardContent>
              </motion.div>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
}
